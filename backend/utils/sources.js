/**
 * Canonical `source` values for `question_bank`. Kept in sync with the
 * CHECK constraint defined in scripts/migrations/2026_05_10 and
 * 2026_05_11.
 */
const SOURCES = Object.freeze({
  MANUAL: 'manual',
  AI_GENERATED: 'ai-generated',
  PAST_YEAR_LLM: 'past-year-llm',
  PLACEMENT_STYLE_LLM: 'placement-style-llm',
});

const PYQ_SOURCES = Object.freeze([SOURCES.PAST_YEAR_LLM, SOURCES.PLACEMENT_STYLE_LLM]);

module.exports = { SOURCES, PYQ_SOURCES };
