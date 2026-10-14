/**
 * Orbivex chunker — structure-aware, token-budgeted splitting for RAG.
 *
 * The previous implementation sliced lesson text every 400 characters, which
 * cut sentences (and words) in half and threw away the heading a passage sat
 * under. This one:
 *
 *   1. Parses the document into blocks (headings, paragraphs, list runs,
 *      fenced code) instead of treating it as one flat string.
 *   2. Packs blocks into ~350-token windows, never splitting a sentence and
 *      never merging across an h1/h2 boundary.
 *   3. Keeps fenced code atomic — a half-function is worse than no code.
 *   4. Tracks the heading path ("Indexing › B-Trees") so callers can prepend it
 *      before embedding. A chunk reading "It runs in O(log n)" is unretrievable
 *      on its own; with its heading path it is findable.
 *
 * Token counts are estimated at ~4 characters/token rather than by running a
 * real tokenizer — we only need it accurate enough to size windows, and a
 * dependency-free estimate keeps this module cheap to call during indexing.
 */

const DEFAULTS = {
  targetTokens: 350,   // window size
  overlapRatio: 0.15,  // carried into the next chunk, sentence-aligned
  minTokens: 20,       // below this a trailing chunk is merged back
};

const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

/** Split into sentences, keeping the terminator. Abbreviation-naive by design. */
function splitSentences(text) {
  const parts = String(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(text).trim()].filter(Boolean);
}

/**
 * Is this line a section label like "Arrays:" or "Array Indexing:"?
 * Deliberately strict — a short, mostly-word line that ends in a colon and is
 * not itself a sentence — so ordinary prose ending in a colon (e.g. "consider
 * the following:") is not swallowed as a heading. It must also carry no
 * sentence-ending punctuation before the colon.
 */
function isLabelHeading(line) {
  const t = line.trim();
  if (!t.endsWith(':') || t.length > 60) return false;
  const label = t.slice(0, -1).trim();
  if (label.length < 3) return false;             // "x:" is not a heading
  if (/[.!?]/.test(label)) return false;          // not mid-sentence
  if (label.split(/\s+/).length > 7) return false; // headings are short
  // Must start Capitalised — rejects lowercase prose ("consider the following:")
  // — and be mostly words, which rejects code lines like "int x = 5:".
  return /^[A-Z][A-Za-z0-9 ,&/()'-]*$/.test(label);
}

/**
 * Last-resort splitter for a run of text with no sentence boundaries — code
 * listings, colon-lists, ASCII tables. Without this such a block stays whole
 * and can exceed the embedding model's 512-token limit, where `truncate:'END'`
 * silently drops its tail. Splits on line breaks first, then hard characters.
 */
function hardSplit(text, targetTokens) {
  const maxChars = targetTokens * CHARS_PER_TOKEN;
  const out = [];
  let buf = '';

  for (const line of String(text).split('\n')) {
    if (buf && estimateTokens(buf + '\n' + line) > targetTokens) {
      out.push(buf);
      buf = '';
    }
    // A single line longer than the whole budget: slice it hard.
    if (estimateTokens(line) > targetTokens) {
      if (buf) { out.push(buf); buf = ''; }
      for (let i = 0; i < line.length; i += maxChars) out.push(line.slice(i, i + maxChars));
      continue;
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) out.push(buf);
  return out.filter(Boolean);
}

/**
 * Parse text into ordered blocks, carrying the live heading stack on each.
 * @returns {Array<{type, text, level, headingPath: string[]}>}
 */
function parseBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];

  // Dense heading stack of {level, title}. Pushing a heading of level L first
  // pops everything at level >= L, so the path never has holes even when a
  // level-3 label heading appears with no level-1/2 heading above it.
  const headingStack = [];
  const pushHeading = (level, title) => {
    while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
      headingStack.pop();
    }
    headingStack.push({ level, title });
  };
  const currentPath = () => headingStack.map((h) => h.title);

  let paragraph = [];
  let inFence = false;
  let fence = [];
  let fenceMarker = '';

  const flushParagraph = () => {
    const body = paragraph.join('\n').trim();
    if (body) {
      blocks.push({
        type: /^\s*([-*+]|\d+\.)\s/.test(paragraph[0] || '') ? 'list' : 'para',
        text: body,
        level: 0,
        headingPath: currentPath(),
      });
    }
    paragraph = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);

    if (inFence) {
      fence.push(line);
      if (fenceMatch && line.trim().startsWith(fenceMarker)) {
        blocks.push({ type: 'code', text: fence.join('\n'), level: 0, headingPath: currentPath() });
        fence = [];
        inFence = false;
      }
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      inFence = true;
      fenceMarker = fenceMatch[1];
      fence = [line];
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const title = heading[2].trim();
      pushHeading(level, title);
      blocks.push({ type: 'heading', text: title, level, headingPath: currentPath() });
      continue;
    }

    // "Label:" style section header — a short line that is only a label ending
    // in a colon ("Arrays:", "Declaration and Initialization:"). Real Orbivex
    // lessons format sections this way rather than with markdown '#', so
    // without this the heading path is almost always empty. Treated as level 3
    // so a real markdown heading above it still outranks it (and it does not
    // force a new chunk — several short label sections may share one chunk).
    if (isLabelHeading(line)) {
      flushParagraph();
      const title = line.trim().replace(/:\s*$/, '');
      pushHeading(3, title);
      blocks.push({ type: 'heading', text: title, level: 3, headingPath: currentPath() });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  // An unterminated fence still holds real content — keep it rather than drop it.
  if (inFence && fence.length) {
    blocks.push({ type: 'code', text: fence.join('\n'), level: 0, headingPath: [...headingStack] });
  }
  flushParagraph();

  return blocks;
}

/**
 * Break a block that is too large on its own into sentence-aligned pieces.
 * Code is never split — an oversized code block is emitted whole.
 */
function splitOversized(block, targetTokens) {
  // Code stays atomic up to the point it would be silently truncated at embed
  // time; past that, a hard split is better than losing the tail entirely.
  if (block.type === 'code') {
    return estimateTokens(block.text) <= targetTokens
      ? [block]
      : hardSplit(block.text, targetTokens).map((text) => ({ ...block, text }));
  }

  const pieces = [];
  let buffer = [];
  let bufferTokens = 0;

  for (const sentence of splitSentences(block.text)) {
    const t = estimateTokens(sentence);

    // A single "sentence" over budget has no internal sentence breaks (a code
    // listing or colon-list); fall back to the hard splitter rather than emit
    // an oversized chunk.
    if (t > targetTokens) {
      if (buffer.length) { pieces.push({ ...block, text: buffer.join(' ') }); buffer = []; bufferTokens = 0; }
      for (const part of hardSplit(sentence, targetTokens)) pieces.push({ ...block, text: part });
      continue;
    }

    if (bufferTokens + t > targetTokens && buffer.length) {
      pieces.push({ ...block, text: buffer.join(' ') });
      buffer = [];
      bufferTokens = 0;
    }
    buffer.push(sentence);
    bufferTokens += t;
  }
  if (buffer.length) pieces.push({ ...block, text: buffer.join(' ') });

  return pieces;
}

/** Trailing sentences of `text` worth roughly `tokens`, for overlap. */
function tailByTokens(text, tokens) {
  const sentences = splitSentences(text);
  const out = [];
  let total = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const t = estimateTokens(sentences[i]);
    if (total + t > tokens && out.length) break;
    out.unshift(sentences[i]);
    total += t;
  }
  const tail = out.join(' ');
  // On periodless text splitSentences yields one giant "sentence", so the loop
  // above would carry the whole chunk as overlap and double its size. Cap it
  // with a hard character tail.
  if (estimateTokens(tail) > tokens * 1.5) {
    return text.slice(-tokens * CHARS_PER_TOKEN);
  }
  return tail;
}

/**
 * Chunk a document into retrieval windows.
 *
 * @returns {Array<{text: string, headingPath: string[], tokenCount: number, index: number}>}
 */
function chunkDocument(text, options = {}) {
  const { targetTokens, overlapRatio, minTokens } = { ...DEFAULTS, ...options };
  const overlapTokens = Math.round(targetTokens * overlapRatio);

  const blocks = parseBlocks(text);
  if (!blocks.length) return [];

  const chunks = [];
  let current = [];
  let currentTokens = 0;
  let currentPath = [];

  const flush = () => {
    const body = current.join('\n\n').trim();
    if (!body) return;
    chunks.push({ text: body, headingPath: [...currentPath], tokenCount: estimateTokens(body) });
    current = [];
    currentTokens = 0;
  };

  for (const raw of blocks) {
    // A top-level heading starts a genuinely new topic — never pack across it.
    if (raw.type === 'heading' && raw.level <= 2) flush();

    for (const block of splitOversized(raw, targetTokens)) {
      const blockTokens = estimateTokens(block.text);

      if (currentTokens + blockTokens > targetTokens && current.length) {
        const carry = tailByTokens(current.join('\n\n'), overlapTokens);
        flush();
        if (carry) {
          current.push(carry);
          currentTokens = estimateTokens(carry);
        }
      }

      // Label the chunk with the first real heading path it contains. A chunk
      // that opens on a pathless title paragraph but then reaches "Arrays:"
      // should be labelled "Arrays", not left blank.
      if (current.length === 0) currentPath = block.headingPath;
      else if (!currentPath.length && block.headingPath.length) currentPath = block.headingPath;

      current.push(block.text);
      currentTokens += blockTokens;
    }
  }
  flush();

  // A tiny trailing chunk carries little signal — fold it back.
  if (chunks.length > 1 && chunks[chunks.length - 1].tokenCount < minTokens) {
    const tail = chunks.pop();
    const prev = chunks[chunks.length - 1];
    prev.text = `${prev.text}\n\n${tail.text}`;
    prev.tokenCount = estimateTokens(prev.text);
  }

  return chunks.map((c, index) => ({ ...c, index }));
}

/**
 * Text actually sent to the embedding model: the heading path is prepended so
 * the vector carries its context, while the stored `content_chunk` stays clean
 * for display and for the answering prompt.
 */
function buildEmbedText(chunk, prefixParts = []) {
  const path = dedupePath([...prefixParts, ...(chunk.headingPath || [])]);
  return path.length ? `${path.join(' › ')}\n\n${chunk.text}` : chunk.text;
}

/**
 * Drop empties and consecutive repeats. A lesson's top-level heading usually
 * restates its title, which would otherwise render as "Indexing › Indexing".
 */
function dedupePath(parts) {
  const out = [];
  for (const part of parts) {
    const clean = String(part || '').trim();
    if (!clean) continue;
    if (out.length && out[out.length - 1].toLowerCase() === clean.toLowerCase()) continue;
    out.push(clean);
  }
  return out;
}

module.exports = {
  chunkDocument,
  buildEmbedText,
  dedupePath,
  parseBlocks,
  estimateTokens,
  splitSentences,
  isLabelHeading,
  hardSplit,
  DEFAULTS,
};
