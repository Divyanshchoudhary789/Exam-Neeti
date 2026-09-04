/**
 * analyticsFormulas.js
 *
 * Single source of truth for the formula CONSTANTS that come from the product
 * formula documents (Exam Neeti Analytics Formula Guide, Difficulty Probability
 * Multiplier V1, ROI Classification Framework).
 *
 * Runtime-tunable per-sprint overrides still live in FormulaConfig documents and
 * are merged on top of these by the analytics/probability services — this file
 * only defines the defaults so every service agrees on the same numbers.
 */

"use strict";

// ── NEET scoring ────────────────────────────────────────────────────────────
const NEET_MARKS = Object.freeze({ correct: 4, incorrect: -1 });

// ── Difficulty Probability Multiplier V1 ────────────────────────────────────
// Medium/Hard P(correct) are DERIVED from the Easy P(correct) using scaling
// multipliers (NOT percentage-point subtraction — see "Difficulty Probability
// Multiplier V1": flat −15% / −35% deductions go unrealistic at low starting
// probabilities).
//   P(Medium) = P(Easy) × 0.80
//   P(Hard)   = P(Easy) × 0.60
const DIFFICULTY_MULTIPLIERS = Object.freeze({
  easy: 1.0,
  medium: 0.8,
  hard: 0.6,
});

// Probability is clamped so a 0% / 100% chapter never hard-zeros ROI or breaks
// downstream ratios.
const PROBABILITY_CLAMP = Object.freeze({ min: 0.05, max: 0.99 });

/**
 * Derives {pEasy, pMedium, pHard} from an easy-question probability using the
 * V1 multipliers. Every value is clamped.
 *
 * @param {number} pEasy                 probability of solving an EASY question (0..1)
 * @param {object} [multipliers]         optional override of DIFFICULTY_MULTIPLIERS
 * @returns {{pEasy:number, pMedium:number, pHard:number}}
 */
function deriveDifficultyProbabilities(pEasy, multipliers = DIFFICULTY_MULTIPLIERS) {
  const clamp = (v) =>
    Math.max(PROBABILITY_CLAMP.min, Math.min(PROBABILITY_CLAMP.max, v));
  const base = clamp(Number(pEasy) || 0);
  return {
    pEasy: base,
    pMedium: clamp(base * (multipliers.medium ?? DIFFICULTY_MULTIPLIERS.medium)),
    pHard: clamp(base * (multipliers.hard ?? DIFFICULTY_MULTIPLIERS.hard)),
  };
}

// Fallback P(correct) per difficulty when a student has NO probability estimate
// for a chapter yet (no questionnaire, no objective data). Anchored on an
// Easy=0.60 prior and scaled by the same V1 multipliers so it stays consistent
// with a real derived probability.
const FALLBACK_P_EASY = 0.6;
const FALLBACK_P_CORRECT = Object.freeze({
  easy: FALLBACK_P_EASY,
  medium: FALLBACK_P_EASY * DIFFICULTY_MULTIPLIERS.medium,
  hard: FALLBACK_P_EASY * DIFFICULTY_MULTIPLIERS.hard,
});

// ── ROI Classification Framework ───────────────────────────────────────────
// "A fixed absolute ROI threshold should not be used" — questions are classified
// RELATIVE to the other questions in the same test:
//   Top 25% ROI            → HIGH
//   25th–75th percentile   → MEDIUM
//   Bottom 25% ROI         → LOW
const ROI_CLASSIFICATION = Object.freeze({
  method: "percentile", // "percentile" (framework) | "absolute" (legacy fixed cutoffs)
  highPercentile: 75, // ROI at/above this percentile rank → HIGH
  lowPercentile: 25, //  ROI at/below this percentile rank → LOW
  // Only used when method === "absolute":
  absoluteHigh: 2.5, // expected marks / minute
  absoluteLow: 1.5,
});

// Expected solving time (seconds) per difficulty — used as the ROI denominator
// ("expected solving time in minutes") when a question has no stored
// idealTimeSeconds and no actual attempt time (e.g. an unattempted question).
const EXPECTED_TIME_SECONDS_BY_DIFFICULTY = Object.freeze({
  easy: 45,
  medium: 75,
  hard: 120,
  default: 60,
});

/**
 * Best available "expected solving time" for a response, in MINUTES (floored at
 * 0.1 so ROI never divides by ~0).
 * Priority: stored ideal time → difficulty default → actual time spent.
 */
function expectedTimeMinutes(response) {
  const ideal = Number(response?.idealTimeSeconds);
  if (Number.isFinite(ideal) && ideal > 0) return Math.max(ideal / 60, 0.1);

  const byDifficulty =
    EXPECTED_TIME_SECONDS_BY_DIFFICULTY[String(response?.difficulty || "").toLowerCase()];
  if (byDifficulty) return Math.max(byDifficulty / 60, 0.1);

  const actual = Number(response?.timeSpentSeconds);
  if (Number.isFinite(actual) && actual > 0) return Math.max(actual / 60, 0.1);

  return EXPECTED_TIME_SECONDS_BY_DIFFICULTY.default / 60;
}

/**
 * Classifies a list of items into high / medium / low ROI buckets by percentile
 * rank of their ROI value (ROI Classification Framework). Ties are resolved by
 * position so the split stays ~25 / 50 / 25 even with equal ROI values.
 *
 * @param {Array}    items          any objects
 * @param {function} getRoi         item → numeric ROI
 * @param {object}   [opts]         { highPercentile, lowPercentile }
 * @returns {{ high:Set, medium:Set, low:Set, classOf:Map, cutoffs:{high:number,low:number} }}
 *          Sets/Map are keyed by the item's array index.
 */
function classifyRoiByPercentile(items, getRoi, opts = {}) {
  const highP = opts.highPercentile ?? ROI_CLASSIFICATION.highPercentile;
  const lowP = opts.lowPercentile ?? ROI_CLASSIFICATION.lowPercentile;

  const high = new Set();
  const medium = new Set();
  const low = new Set();
  const classOf = new Map();

  const n = items.length;
  if (n === 0) return { high, medium, low, classOf, cutoffs: { high: 0, low: 0 } };

  const ranked = items
    .map((item, index) => ({ index, roi: Number(getRoi(item)) || 0 }))
    .sort((a, b) => b.roi - a.roi);

  // Number of questions in the top / bottom buckets (rounded, at least 1 when
  // there is more than one question so "high" and "low" are never both empty).
  const highCount = n === 1 ? 1 : Math.max(1, Math.round((n * (100 - highP)) / 100));
  const lowCount = n === 1 ? 0 : Math.max(1, Math.round((n * lowP) / 100));

  ranked.forEach((entry, rank) => {
    let cls;
    if (rank < highCount) cls = "high";
    else if (rank >= n - lowCount) cls = "low";
    else cls = "medium";
    classOf.set(entry.index, cls);
    (cls === "high" ? high : cls === "low" ? low : medium).add(entry.index);
  });

  return {
    high,
    medium,
    low,
    classOf,
    cutoffs: {
      high: ranked[Math.min(highCount, n) - 1]?.roi ?? 0,
      low: ranked[Math.max(n - lowCount, 0)]?.roi ?? 0,
    },
  };
}

module.exports = {
  NEET_MARKS,
  DIFFICULTY_MULTIPLIERS,
  PROBABILITY_CLAMP,
  deriveDifficultyProbabilities,
  FALLBACK_P_EASY,
  FALLBACK_P_CORRECT,
  ROI_CLASSIFICATION,
  EXPECTED_TIME_SECONDS_BY_DIFFICULTY,
  expectedTimeMinutes,
  classifyRoiByPercentile,
};
