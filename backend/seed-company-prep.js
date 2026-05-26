/**
 * Seed script — populates company_rounds from the same dataset the
 * frontend ships in frontend/src/lib/companyPrepData.js. Idempotent:
 * uses (company_slug, round_index) as the upsert key.
 *
 * Run from a host that has SUPABASE_URL and SUPABASE_SERVICE_KEY set:
 *   docker compose exec api node seed-company-prep.js
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mirrors frontend/src/lib/companyPrepData.js. Keep in sync if that file changes.
const COMPANIES = [
  {
    slug: 'tcs',
    name: 'TCS',
    color: '#0B6CB7',
    tier: 'Service-based',
    hiring: '~40,000 hires/year',
    tagline: "India's largest IT services employer — TCS NQT is the gateway.",
    rounds: [
      { title: 'TCS NQT — Numerical Ability', duration: '40 min', summary: 'Quantitative aptitude with a strong arithmetic focus.', topics: ['Number System', 'Percentages', 'Time–Speed–Distance', 'Time & Work', 'Probability', 'Permutation & Combination'] },
      { title: 'Verbal Ability', duration: '30 min', summary: 'Reading comprehension, grammar, sentence correction.', topics: ['Reading Comprehension', 'Sentence Completion', 'Para-jumbles', 'Synonyms & Antonyms'] },
      { title: 'Reasoning Ability', duration: '50 min', summary: 'Logical reasoning and data interpretation.', topics: ['Series', 'Coding–Decoding', 'Blood Relations', 'Syllogisms', 'Data Interpretation'] },
      { title: 'Programming Logic (MCQ)', duration: '15 min', summary: 'Conceptual MCQs on programming fundamentals.', topics: ['OOP Basics', 'DS Basics', 'Time Complexity', 'Algorithms'] },
      { title: 'Hands-on Coding', duration: '90 min', summary: 'Two coding problems — Easy + Medium. Any language.', topics: ['Strings', 'Arrays', 'Math problems', 'Pattern printing', 'Basic DP'] },
      { title: 'Technical Interview', duration: '30–45 min', summary: 'Project deep-dive plus core CS fundamentals.', topics: ['DBMS', 'OOPs', 'OS basics', 'Project walkthrough', 'Resume Q&A'] },
      { title: 'Managerial + HR Round', duration: '20–30 min', summary: 'Communication, situational judgement, relocation, bond.', topics: ['Self-introduction', 'Strengths & Weaknesses', 'Why TCS', 'Service Agreement'] },
    ],
  },
  {
    slug: 'infosys',
    name: 'Infosys',
    color: '#007CC3',
    tier: 'Service-based',
    hiring: '~25,000 hires/year',
    tagline: 'InfyTQ certification + Power Programmer route for top performers.',
    rounds: [
      { title: 'Logical Reasoning', duration: '25 min', summary: 'Puzzle-heavy reasoning section.', topics: ['Seating Arrangement', 'Puzzles', 'Syllogisms', 'Data Sufficiency'] },
      { title: 'Quantitative Aptitude', duration: '35 min', summary: 'Mix of arithmetic and modern math.', topics: ['Profit & Loss', 'Ratios', 'Probability', 'Geometry', 'Mensuration'] },
      { title: 'Verbal Ability', duration: '20 min', summary: 'English usage and reading comprehension.', topics: ['RC Passages', 'Cloze Test', 'Error Spotting', 'Para-jumbles'] },
      { title: 'Pseudo-code MCQ', duration: '10 min', summary: 'Trace the output of pseudocode snippets.', topics: ['Loops', 'Recursion', 'Pointers', 'Array manipulation'] },
      { title: 'Coding (2 Problems)', duration: '45 min', summary: 'One easy + one moderate problem.', topics: ['Strings', 'Arrays', 'Hashmaps', 'Sorting'] },
      { title: 'Technical Interview', duration: '45 min', summary: 'CS fundamentals + project + 1 coding problem.', topics: ['DSA', 'OOPs', 'DBMS', 'OS', 'Networks'] },
      { title: 'HR Round', duration: '20 min', summary: 'Cultural fit, location preference, bond agreement.', topics: ['Why Infosys', 'Career goals', 'Relocation', 'Bond Q&A'] },
    ],
  },
  {
    slug: 'wipro',
    name: 'Wipro',
    color: '#341A4D',
    tier: 'Service-based',
    hiring: '~20,000 hires/year',
    tagline: 'Wipro Elite NTH — single online test gates all three tiers.',
    rounds: [
      { title: 'Aptitude Test', duration: '48 min', summary: 'Quant + Logical + Verbal combined.', topics: ['Quantitative', 'Logical Reasoning', 'English Usage'] },
      { title: 'Written Communication Test', duration: '20 min', summary: 'Essay writing — coherence, grammar, structure.', topics: ['Essay structure', 'Grammar', 'Vocabulary'] },
      { title: 'Coding Round', duration: '60 min', summary: 'Two problems in C/C++/Java/Python.', topics: ['Arrays', 'Strings', 'Math', 'Basic DSA'] },
      { title: 'Business Discussion / Tech Interview', duration: '30–45 min', summary: 'Project walkthrough + DSA + CS fundamentals.', topics: ['Resume questions', 'OOPs', 'DBMS', 'Coding on whiteboard'] },
      { title: 'HR Round', duration: '15–20 min', summary: 'Background, communication, bond.', topics: ['Self-intro', 'Achievements', 'Why Wipro', '15-month bond'] },
    ],
  },
  {
    slug: 'accenture',
    name: 'Accenture',
    color: '#A100FF',
    tier: 'Consulting / IT',
    hiring: '~30,000 hires/year',
    tagline: 'Cognitive + Technical assessment, then a unified interview.',
    rounds: [
      { title: 'Cognitive Assessment', duration: '50 min', summary: 'English, numerical, abstract reasoning.', topics: ['Reading Comprehension', 'Number Series', 'Abstract Patterns'] },
      { title: 'Technical Assessment', duration: '40 min', summary: 'MS Office, networking, pseudo-code, OOPs basics.', topics: ['MS Office', 'Networking basics', 'Pseudocode', 'Cloud basics'] },
      { title: 'Coding Round', duration: '45 min', summary: 'Two problems — one easy, one moderate.', topics: ['Arrays', 'Strings', 'Recursion'] },
      { title: 'Communication Assessment', duration: '30 min', summary: 'Listen-and-respond, sentence build, AI-evaluated.', topics: ['Pronunciation', 'Sentence Mastery', 'Vocabulary'] },
      { title: 'Technical + HR Interview', duration: '30–45 min', summary: 'Combined tech & HR — projects, fundamentals, fit.', topics: ['Resume', 'Mini-DSA', 'OOPs', 'Why Accenture', 'Relocation'] },
    ],
  },
  {
    slug: 'cognizant',
    name: 'Cognizant',
    color: '#1A60C4',
    tier: 'Service-based',
    hiring: '~25,000 hires/year',
    tagline: 'GenC, GenC Next, GenC Elevate — coding strength decides the tier.',
    rounds: [
      { title: 'Aptitude Test', duration: '40 min', summary: 'Quantitative + Logical reasoning.', topics: ['Arithmetic', 'Series', 'Puzzles', 'Probability'] },
      { title: 'Verbal Ability', duration: '20 min', summary: 'English grammar + RC.', topics: ['RC', 'Error spotting', 'Synonyms / Antonyms'] },
      { title: 'Coding Round', duration: '60 min', summary: '2 problems. Solving both upgrades you to GenC Next.', topics: ['Strings', 'Arrays', 'Hashing', 'Greedy', 'Basic DP'] },
      { title: 'Technical Interview', duration: '45 min', summary: 'DSA + CS fundamentals + project drilldown.', topics: ['DSA', 'OOPs', 'DBMS', 'OS', 'Project deep-dive'] },
      { title: 'HR Round', duration: '20 min', summary: 'Communication, location, salary expectation.', topics: ['Self-intro', 'Why Cognizant', 'Strengths', 'Relocation'] },
    ],
  },
  {
    slug: 'capgemini',
    name: 'Capgemini',
    color: '#0070AD',
    tier: 'Consulting / IT',
    hiring: '~20,000 hires/year',
    tagline: 'Game-based aptitude + pseudo-code + behavioural essay.',
    rounds: [
      { title: 'Game-Based Aptitude', duration: '20 min', summary: 'Cognitive ability assessed via 4 quick games.', topics: ['Working memory', 'Attention', 'Reasoning'] },
      { title: 'Pseudo-code Test', duration: '20 min', summary: 'Trace pseudocode output and identify correctness.', topics: ['Loops', 'Conditionals', 'Recursion', 'Arrays'] },
      { title: 'English Communication', duration: '20 min', summary: 'Grammar + RC + Para-jumbles.', topics: ['Grammar', 'RC', 'Sentence ordering'] },
      { title: 'Behavioural Essay', duration: '25 min', summary: 'Write an essay on a given prompt — coherence + grammar.', topics: ['Essay structure', 'Argumentation', 'Grammar'] },
      { title: 'Technical + HR Interview', duration: '30–45 min', summary: 'Combined tech & HR conversation.', topics: ['Project', 'OOPs', 'DBMS', 'Why Capgemini'] },
    ],
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    color: '#FF9900',
    tier: 'Product-based',
    hiring: 'Selective campus / lateral',
    tagline: 'DSA-heavy. Leadership Principles drive the interview tone.',
    rounds: [
      { title: 'Online Assessment — Coding (2 Q)', duration: '90 min', summary: 'Two algorithmic problems. LeetCode Medium level.', topics: ['Arrays & Strings', 'Hashmaps', 'Sliding Window', 'Two Pointers'] },
      { title: 'Online Assessment — Work Style + Logical', duration: '40 min', summary: 'Behavioural fit + reasoning puzzles.', topics: ['Leadership Principles', 'Logical reasoning'] },
      { title: 'DSA Interview Round 1', duration: '60 min', summary: 'Live coding — usually 2 medium problems.', topics: ['Trees', 'Graphs', 'Recursion', 'DP fundamentals'] },
      { title: 'DSA Interview Round 2', duration: '60 min', summary: 'Harder DSA + design discussion.', topics: ['Heaps', 'Tries', 'Graph algorithms', 'Advanced DP'] },
      { title: 'System / LLD Design', duration: '60 min', summary: 'Design a small system or class hierarchy.', topics: ['OOP design', 'Concurrency basics', 'Caching', 'Trade-offs'] },
      { title: 'Bar Raiser (Behavioural)', duration: '60 min', summary: "Deep dive on Amazon's 16 Leadership Principles.", topics: ['Customer Obsession', 'Ownership', 'Bias for Action', 'Dive Deep'] },
    ],
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    color: '#0078D4',
    tier: 'Product-based',
    hiring: 'Selective campus / lateral',
    tagline: 'DSA + system design + culture fit. CodeForces / Codility OA.',
    rounds: [
      { title: 'Online Assessment', duration: '90 min', summary: '3 coding problems on Codility / Mettl.', topics: ['Arrays', 'Strings', 'Greedy', 'Recursion'] },
      { title: 'Technical Interview 1', duration: '60 min', summary: 'DSA — usually trees, graphs, or DP.', topics: ['Binary Trees', 'BFS/DFS', 'DP', 'Backtracking'] },
      { title: 'Technical Interview 2', duration: '60 min', summary: 'DSA + OOPs / LLD discussion.', topics: ['Hard DSA', 'OOP design', 'Concurrency'] },
      { title: 'System Design / As-Appropriate', duration: '60 min', summary: 'High-level system design for senior interns/full-time.', topics: ['Scalability', 'Databases', 'Caching', 'Queues'] },
      { title: 'Hiring Manager / HR', duration: '45 min', summary: 'Project deep-dive, motivation, team fit.', topics: ['Past projects', 'Why Microsoft', 'Growth mindset'] },
    ],
  },
];

// Pull the first integer from a duration string like "30–45 min" → 30.
function parseDuration(d) {
  if (!d) return null;
  const m = String(d).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function buildRows() {
  const rows = [];
  for (const c of COMPANIES) {
    c.rounds.forEach((r, i) => {
      rows.push({
        company_name: c.name,
        company_slug: c.slug,
        company_color: c.color,
        company_tier: c.tier,
        company_tagline: c.tagline,
        company_hiring: c.hiring,
        round_index: i,
        title: r.title,
        summary: r.summary,
        duration_minutes: parseDuration(r.duration),
        topics: r.topics || [],
      });
    });
  }
  return rows;
}

async function seed() {
  const rows = buildRows();
  console.log(`Seeding ${rows.length} rounds across ${COMPANIES.length} companies...\n`);

  const { data, error } = await supabase
    .from('company_rounds')
    .upsert(rows, { onConflict: 'company_slug,round_index' })
    .select();

  if (error) {
    console.error('  [error]', error.message);
    process.exit(1);
  }

  console.log(`  [ok] upserted ${data?.length || 0} rows`);
  console.log('\nDone!');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
