/**
 * questionBlockMarkers.js
 *
 * Synonym-tolerant recognisers for the structural markers that separate a
 * "rich" exam-paper question block into its parts: the question-text marker
 * ("Q." / "Q1."), the option markers ("(1)".."(4)" or "(a)".."(d)"), and the
 * solution marker ("Sol." / "SOL. (a)").
 *
 * Same philosophy as questionTemplateFields.resolveFieldKey(): a small,
 * explicit list of accepted variants, matched case-insensitively with
 * whitespace normalised — NOT a fuzzy/AI guess. Anything that doesn't match
 * one of these is left alone (the caller decides what to do with unmatched
 * text), so a document that drifts from the convention fails a *specific*
 * question loudly (reported in the bulk-upload "failed" list) rather than
 * silently mis-parsing it.
 *
 * Every variant accepted here was found by testing against a REAL uploaded
 * document, not guessed — see git history / implementation notes for which
 * document introduced which variant.
 */

"use strict";

// ─── Letter <-> option-number mapping ──────────────────────────────────────

const LETTER_TO_NUMBER = { a: 1, b: 2, c: 3, d: 4 };

// ─── Question-text marker ──────────────────────────────────────────────────

// Matches at the START of a paragraph's text only. Real documents drift:
// "Q.", "Q1.", "Q 12:", a bare "Q" + wide tab/space gap (no punctuation),
// or the full word "Question".
const QUESTION_MARKER_RE = /^\s*(?:Q(?:uestion)?\s*\d*\s*[.:)]|Q\s{2,})\s*/i;

function stripQuestionMarker(text) {
  const m = QUESTION_MARKER_RE.exec(text);
  return m ? text.slice(m[0].length) : null; // null = marker not found
}

// ─── Solution marker (carries the correct option right after it) ──────────

// "Sol.     (3)"  /  "Sol: (3)"  /  "Solution (3)"  /  "Ans. (3)"  /  "SOL. (a)"
// The correct option may be given as a number (1-4) or a letter (a-d) —
// captures whichever, the caller gets a normalised 1-4 either way.
const SOLUTION_MARKER_RE =
  /^\s*(?:Sol(?:ution)?|Ans(?:wer)?)\s*[.:)]?\s*\(?\s*([1-4]|[a-dA-D])\s*\)?\s*\.?\s*/i;

/**
 * @param {string} text
 * @returns {{ optionNumber: number, rest: string } | null}
 */
function stripSolutionMarker(text) {
  const m = SOLUTION_MARKER_RE.exec(text);
  if (!m) return null;
  const raw = m[1];
  const optionNumber = /[1-4]/.test(raw) ? Number(raw) : LETTER_TO_NUMBER[raw.toLowerCase()];
  return { optionNumber, rest: text.slice(m[0].length) };
}

// ─── Option markers ─────────────────────────────────────────────────────────

// "(1)"  "1)"  "1."  "(a)"  "a)"  "a."  — captures the option number/letter,
// requires a following space/tab/EQ-placeholder or end of segment so
// "1.5 m/s" or "a device" in running text never gets mistaken for a marker.
const OPTION_MARKER_RE = /\(?\s*([1-4]|[a-dA-D])\s*[).]\s*/;

/**
 * Splits a chunk of text (already separated on tab characters, or a table
 * cell's text) into { number, rest } if it starts with a recognisable
 * option marker — numeric (1-4) or lettered (a-d / A-D), normalised to 1-4
 * either way so callers never need to care which style a document used.
 * @param {string} segment
 * @returns {{ number: number, rest: string } | null}
 */
function stripOptionMarker(segment) {
  const m = OPTION_MARKER_RE.exec(segment);
  // Marker must be at (or very near) the start — allow up to 2 leading chars
  // of stray whitespace/punctuation, no more, or we risk matching a number
  // that appears mid-sentence.
  if (!m || m.index > 2) return null;
  const raw = m[1];
  const number = /[1-4]/.test(raw) ? Number(raw) : LETTER_TO_NUMBER[raw.toLowerCase()];
  return { number, rest: segment.slice(m.index + m[0].length) };
}

// ─── Decorative noise ───────────────────────────────────────────────────────

// A line that's ENTIRELY made of dash/underscore/box-drawing/dot characters
// (section dividers some authors insert between questions) — never real
// content, and if left in would otherwise glue onto the end of whatever
// text block precedes it. Requires at least 4 repeats so normal punctuation
// like "--" or "..." in prose is never caught by this.
const DECORATIVE_LINE_RE = /^[\s\-–—_.=*~─━□]{4,}$/;

function isDecorativeSeparator(text) {
  return DECORATIVE_LINE_RE.test(text.trim());
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
  isDecorativeSeparator,
  looksLikeFieldLabel,
};
