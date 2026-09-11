/**
 * syllabusMatcher.js
 *
 * Reconciles free-text chapter/topic strings (as typed by a teacher in a
 * bulk-upload Word/Excel document) against the canonical NEET syllabus
 * taxonomy stored in SyllabusConfig — so a typo like "Thermodynamcs" or a
 * casing/spacing difference like "laws of motion" doesn't create a second,
 * slightly-different chapter string sitting alongside the real one.
 *
 * Mismatched chapter/topic strings across questions are exactly what forces
 * questionReconstruction.service.js's tier engine to fall through its fuzzy
 * tiers (2-4) instead of getting a clean Tier-1 exact match during exam
 * generation — this module fixes that upstream, at data-entry time, using
 * the same normalization idea as that service's isFlexibleMatch(), plus
 * Levenshtein-distance similarity for genuine typo tolerance.
 */

"use strict";

/** Lowercase, "&"→"and", strip punctuation, collapse whitespace. */
function normalizeStr(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classic Levenshtein edit distance (rows-only DP, O(min(m,n)) memory). */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 1.0 = identical (after normalization), 0.0 = nothing in common. */
function similarityRatio(a, b) {
  const nA = normalizeStr(a);
  const nB = normalizeStr(b);
  if (!nA && !nB) return 1;
  if (!nA || !nB) return 0;
  const dist = levenshtein(nA, nB);
  const maxLen = Math.max(nA.length, nB.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

const STOP_WORDS = new Set(["and", "or", "of", "in", "the", "a", "to", "for", "with", "on", "at"]);

/** Fraction of b's meaningful words that appear (or stem-match) in a. */
function wordOverlapRatio(a, b) {
  const nA = normalizeStr(a);
  const nB = normalizeStr(b);
  if (!nA || !nB) return 0;
  const wordsB = nB.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const wordsASet = new Set(nA.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
  if (wordsB.length === 0) return 0;
  let matched = 0;
  for (const w of wordsB) {
    for (const wa of wordsASet) {
      if (wa === w || wa.startsWith(w) || w.startsWith(wa)) { matched++; break; }
    }
  }
  return matched / wordsB.length;
}

/**
 * Finds the best candidate match for `raw` among `candidates` (a deduped
 * list of canonical strings for one subject+classLevel scope).
 *
 * confidence:
 *   "exact"  — identical once normalized (case/punctuation/whitespace-insensitive)
 *   "strong" — a typo/substring/near-duplicate of exactly one candidate,
 *              safe to silently auto-apply
 *   "weak"   — some resemblance but not safe to auto-apply — surfaced for
 *              manual review instead of guessed at
 *   "none"   — nothing close enough to suggest anything
 */
function bestMatch(raw, candidates) {
  const value = String(raw || "").trim();
  if (!value || !Array.isArray(candidates) || candidates.length === 0) {
    return { matched: null, original: value, confidence: "none", score: 0 };
  }

  const nRaw = normalizeStr(value);
  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const nCand = normalizeStr(candidate);
    if (nCand === nRaw) {
      return { matched: candidate, original: value, confidence: "exact", score: 1 };
    }
    const sim = similarityRatio(value, candidate);
    const overlap = wordOverlapRatio(value, candidate);
    const containment = (nCand.includes(nRaw) || nRaw.includes(nCand)) ? 0.9 : 0;
    const score = Math.max(sim, overlap, containment);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (bestScore >= 0.82) return { matched: best, original: value, confidence: "strong", score: bestScore };
  if (bestScore >= 0.55) return { matched: best, original: value, confidence: "weak", score: bestScore };
  return { matched: null, original: value, confidence: "none", score: bestScore };
}

module.exports = { normalizeStr, levenshtein, similarityRatio, wordOverlapRatio, bestMatch };
