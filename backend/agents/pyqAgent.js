const { supabaseAdmin } = require('../config/supabase');
const { generateCompletion } = require('../config/ollama');
const { SOURCES } = require('../utils/sources');

const MODEL = process.env.OLLAMA_PYQ_MODEL
  || process.env.OLLAMA_QUIZ_MODEL
  || process.env.OLLAMA_DEFAULT_MODEL
  || 'qwen2.5:1.5b';

const BATCH_SIZE = 5;       // 1.5B model handles up to 5 MCQs per call cleanly.
const MAX_BATCHES = 12;     // hard cap so a runaway loop can't spam Ollama (12 * 5 = 60).

// Companies we recognize — used to inject style hints into the prompt.
// Falls back to a generic "placement test" tone when the company is unknown.
const COMPANY_STYLE_HINTS = {
  TCS: 'TCS NQT-style: foundation aptitude, four-option MCQs, one correct answer, mid difficulty, decimal-precision distractors common.',
  Infosys: 'Infosys (InfyTQ / Specialist Programmer)-style: logical reasoning + quantitative aptitude, mid difficulty, conceptual rather than calculation-heavy.',
  Wipro: 'Wipro Elite NLTH-style: aptitude + logical reasoning, four options, mostly arithmetic-heavy with one trick distractor.',
  Accenture: 'Accenture Hiring Assessment-style: quantitative aptitude + verbal, easy-to-mid difficulty, four options.',
  Cognizant: 'Cognizant GenC-style: aptitude + quants + logical reasoning, mid difficulty, four options, neat numerical answers.',
  Capgemini: 'Capgemini-style: pseudocode + quantitative aptitude, mid difficulty, four options.',
  HCL: 'HCL Tech-style: aptitude + reasoning, mid difficulty, four options.',
};

function styleHintFor(company) {
  if (!company) return 'Generic placement-test aptitude MCQs at intermediate difficulty.';
  // Try exact match, else case-insensitive prefix match.
  if (COMPANY_STYLE_HINTS[company]) return COMPANY_STYLE_HINTS[company];
  const key = Object.keys(COMPANY_STYLE_HINTS).find(
    (k) => k.toLowerCase() === company.toLowerCase(),
  );
  return key ? COMPANY_STYLE_HINTS[key] : `Placement-test style aptitude MCQs in the typical recruitment-exam pattern of ${company}, intermediate difficulty.`;
}

function buildCompanyStylePrompt({ company, topic, year, batchSize }) {
  const styleHint = styleHintFor(company);
  const yearLine = year ? `Target year framing: ${year}. Use number ranges, currency, and contextual references that fit ${year} or earlier.` : '';
  return `Generate ${batchSize} multiple-choice placement-practice questions.

Company: ${company}
Topic: ${topic}
Style: ${styleHint}
${yearLine}

Rules:
- Each question must have EXACTLY 4 options labeled "A) ...", "B) ...", "C) ...", "D) ...".
- "correct_answer" must be one of "A", "B", "C", "D".
- Provide a one-sentence explanation.
- Do not repeat questions. Vary the numerical values and framing.
- Output ONLY a valid JSON array, no extra prose, no markdown.

Return ONLY a JSON array in this shape:
[{"question":"...?","options":["A) ...","B) ...","C) ...","D) ..."],"correct_answer":"A","explanation":"Brief reason"}]`;
}

function parseExtractionResponse(response) {
  if (typeof response !== 'string') return [];
  const stripped = response.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  const m = stripped.match(/\[[\s\S]*\]/);
  const candidate = m ? m[0] : stripped;
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateMcq(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.question !== 'string' || q.question.trim().length < 5) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (q.options.some((o) => typeof o !== 'string' || o.trim().length === 0)) return false;
  if (q.correct_answer == null || String(q.correct_answer).trim() === '') return false;
  return true;
}

function normaliseKey(text) {
  return String(text || '').trim().toLowerCase();
}

async function loadExistingKeys({ company, topic }) {
  const { data } = await supabaseAdmin
    .from('question_bank')
    .select('question_text')
    .eq('company_name', company)
    .eq('topic', topic)
    .eq('question_type', 'mcq');
  return new Set((data || []).map((r) => normaliseKey(r.question_text)));
}

/**
 * Run the PYQ agent for a single (company, topic, year) tuple.
 * Generates company-style placement MCQs locally via Ollama (no internet).
 *
 * @param {object} args
 * @param {string} args.company        — must match company_rounds.company_name
 * @param {string} args.topic          — topic label, e.g. "Number System"
 * @param {number} [args.year]         — placement-year framing, e.g. 2024
 * @param {number} [args.target_count] — soft cap on how many to insert in this run
 * @param {Function} [args.onProgress] — ({stage, message, count}) => void
 * @param {Function} [args.shouldCancel] — () => boolean; checked between batches
 * @returns {Promise<{inserted: number, attempted: number, log: any[], error?: string}>}
 */
async function run({ company, topic, year, target_count = 30, onProgress, shouldCancel }) {
  const log = [];
  const emit = (stage, message, count) => {
    const entry = { ts: new Date().toISOString(), stage, message, count };
    log.push(entry);
    try { onProgress && onProgress(entry); } catch { /* progress is best-effort */ }
  };

  let attempted = 0;
  let inserted = 0;

  if (!target_count || target_count <= 0) {
    emit('done', 'No questions needed for this year', 0);
    return { inserted, attempted, log };
  }

  try {
    const existingKeys = await loadExistingKeys({ company, topic });
    const inBatchSeen = new Set();
    const totalBatches = Math.min(MAX_BATCHES, Math.ceil(target_count / BATCH_SIZE));

    emit('generating', `Will generate up to ${totalBatches} batches of ${BATCH_SIZE} for ${company} / ${topic}${year ? ` (${year})` : ''}`, 0);

    for (let batch = 1; batch <= totalBatches && inserted < target_count; batch++) {
      if (shouldCancel && shouldCancel()) {
        emit('cancelled', `Cancelled before batch ${batch}`, inserted);
        break;
      }

      const need = Math.min(BATCH_SIZE, target_count - inserted);
      const prompt = buildCompanyStylePrompt({ company, topic, year, batchSize: need });

      // ── 1. Generate ──────────────────────────────────────────────
      let response;
      try {
        response = await generateCompletion(MODEL, prompt, {
          temperature: 0.4,
          format: 'json',
          max_tokens: 2048,
          timeoutMs: 120_000,
          cache: false, // we want variety across batches even when prompt is similar
        });
      } catch (err) {
        emit('generating', `Batch ${batch}/${totalBatches} failed: ${err.message}`, inserted);
        continue; // try next batch — generation can be flaky
      }

      const parsed = parseExtractionResponse(response);
      attempted += parsed.length;

      // ── 2. Validate + dedupe ─────────────────────────────────────
      const batchRows = [];
      for (const q of parsed) {
        if (!validateMcq(q)) continue;
        const key = normaliseKey(q.question);
        if (existingKeys.has(key) || inBatchSeen.has(key)) continue;
        inBatchSeen.add(key);
        batchRows.push({
          question_text: q.question.trim(),
          question_type: 'mcq',
          difficulty_level: 'medium',
          category: 'aptitude',
          test_type: 'company-specific',
          company_name: company,
          topic,
          set_number: null,
          source: SOURCES.PLACEMENT_STYLE_LLM,
          year_source: year || null,
          _key: key, // stripped before insert
          answers_json: {
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation || '',
            generation_year: year || null,
          },
        });
        if (inserted + batchRows.length >= target_count) break;
      }

      if (batchRows.length === 0) {
        emit('generating', `Batch ${batch}/${totalBatches} → kept 0/${parsed.length} (all duplicates or invalid)`, inserted);
        continue;
      }

      // ── 3. Stream-insert this batch immediately ──────────────────
      const insertRows = batchRows.map(({ _key, ...rest }) => rest);
      const { data, error: insErr } = await supabaseAdmin
        .from('question_bank')
        .insert(insertRows)
        .select('id');

      if (insErr) {
        // Abort the entire run — caller gets the exact error to surface.
        emit('inserting', `Insert failed: ${insErr.message}`, inserted);
        return { inserted, attempted, log, error: `Insert failed: ${insErr.message}` };
      }

      const justInserted = (data || []).length;
      inserted += justInserted;
      // Commit the keys to dedup set only after a successful insert.
      for (const r of batchRows) existingKeys.add(r._key);

      emit('inserted', `Batch ${batch}/${totalBatches} → inserted ${justInserted} (total ${inserted}/${target_count})`, inserted);
    }

    if (inserted === 0) {
      return { inserted, attempted, log, error: 'LLM produced no valid MCQs' };
    }

    emit('done', `Inserted ${inserted} placement-style MCQs`, inserted);
    return { inserted, attempted, log };
  } catch (err) {
    emit('error', err.message || String(err), inserted);
    return { inserted, attempted, log, error: err.message || String(err) };
  }
}

module.exports = { run };
