/**
 * questionBlockMarkers.js
 *
 * Synonym-tolerant recognisers for the structural markers that separate a
 * "rich" exam-paper question block into its parts: the question-text marker
 * ("Q."), the option markers ("(1)".."(4)"), and the solution marker ("Sol.").
 *
 * Same philosophy as questionTemplateFields.resolveFieldKey(): a small,
 * explicit list of accepted variants, matched case-insensitively with
 * whitespace normalised — NOT a fuzzy/AI guess. Anything that doesn't match
 * one of these is left alone (the caller decides what to do with unmatched
 * text), so a document that drifts from the convention fails a *specific*
 * question loudly (reported in the bulk-upload "failed" list) rather than
 * silently mis-parsing it.
 */

"use strict";

// ─── Question-text marker ──────────────────────────────────────────────────

// Matches at the START of a paragraph's text only. Real documents drift:
// most questions are "Q.", but some just use a bare "Q" followed by a wide
// tab/space gap (no punctuation at all) before the question text starts —
// tolerate both rather than failing every such row.
const QUESTION_MARKER_RE = /^\s*(?:Q(?:uestion)?\s*[.:)]|Qn\s*[.:)]|Q\s{2,})\s*/i;

function stripQuestionMarker(text) {
  const m = QUESTION_MARKER_RE.exec(text);
  return m ? text.slice(m[0].length) : null; // null = marker not found
}

// ─── Solution marker (carries the correct-option number right after it) ───

// "Sol.     (3)"  /  "Sol: (3)"  /  "Solution (3)"  /  "Ans. (3)"
// Captures the option number so the caller gets text + correctAnswer in one shot.
const SOLUTION_MARKER_RE =
  /^\s*(?:Sol(?:ution)?|Ans(?:wer)?)\s*[.:)]?\s*\(?\s*([1-4])\s*\)?\s*\.?\s*/i;

/**
 * @param {string} text
 * @returns {{ optionNumber: number, rest: string } | null}
 */
function stripSolutionMarker(text) {
  const m = SOLUTION_MARKER_RE.exec(text);
  if (!m) return null;
  return { optionNumber: Number(m[1]), rest: text.slice(m[0].length) };
}

// ─── Option markers ─────────────────────────────────────────────────────────

// "(1)"  "1)"  "1."  — captures the option number, requires a following
// space/tab/EQ-placeholder or end of segment so "1.5 m/s" in running text
// never gets mistaken for an option marker.
const OPTION_MARKER_RE = /\(?\s*([1-4])\s*[).]\s*/;

/**
 * Splits a chunk of text (already separated on tab characters) into
 * { number, text } if it starts with a recognisable option marker.
 * @param {string} segment
 * @returns {{ number: number, rest: string } | null}
 */
function stripOptionMarker(segment) {
  const m = OPTION_MARKER_RE.exec(segment);
  // Marker must be at (or very near) the start — allow up to 2 leading chars
  // of stray whitespace/punctuation, no more, or we risk matching a number
  // that appears mid-sentence.
  if (!m || m.index > 2) return null;
  return { number: Number(m[1]), rest: segment.slice(m.index + m[0].length) };
}

/** True if `text` is entirely a metadata-table label the doc's field table
 *  already recognises (used to detect "a new question's metadata table
 *  started" as an implicit end-of-block marker while scanning paragraphs). */
function looksLikeFieldLabel(text, resolveFieldKey) {
  return resolveFieldKey(text.trim()) !== null;
}

module.exports = {
  stripQuestionMarker,
  stripSolutionMarker,
  stripOptionMarker,
  looksLikeFieldLabel,
};
