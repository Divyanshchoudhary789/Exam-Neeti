/**
 * questionTemplateFields.js
 *
 * Single source of truth for the bulk-upload template's field list — used by
 * BOTH the xlsx/docx parsers (to recognise columns/labels) AND the template
 * generator (to produce the headers/labels admins see). Keeping this in one
 * place is what guarantees the downloadable template and the parser never
 * drift out of sync with each other.
 *
 * key   — canonical field name used internally after parsing
 * label — human-readable header/label shown in the generated template
 * required — whether createQuestionSchema (Joi) requires this field
 */

"use strict";

const FIELD_DEFS = [
  { key: "subject",          label: "Subject *",                   required: true  },
  { key: "classLevel",       label: "Class Level *",                required: true  },
  { key: "chapter",          label: "Chapter *",                    required: true  },
  { key: "topic",            label: "Topic *",                      required: true  },
  { key: "questionCategory", label: "Question Category",            required: false },
  { key: "questionVariant",  label: "Question Variant",             required: false },
  { key: "difficulty",       label: "Difficulty *",                 required: true  },
  { key: "idealTimeSeconds", label: "Ideal Time (seconds)",         required: false },
  { key: "questionText",     label: "Question Text *",              required: true  },
  { key: "optionA",          label: "Option A *",                   required: true  },
  { key: "optionB",          label: "Option B *",                   required: true  },
  { key: "optionC",          label: "Option C *",                   required: true  },
  { key: "optionD",          label: "Option D *",                   required: true  },
  { key: "correctAnswer",    label: "Correct Answer (A/B/C/D) *",   required: true  },
  { key: "marks",            label: "Marks *",                      required: true  },
  { key: "negativeMarks",    label: "Negative Marks",               required: false },
  { key: "solutionText",     label: "Solution Text",                required: false },
  { key: "sourceRef",        label: "Source Reference",             required: false },
];

/** Lowercase, strip everything but letters/digits — makes matching tolerant
 *  of "Subject *", "subject", "Subject", extra spaces, etc. */
function normalizeLabel(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Build a lookup from BOTH the normalized key and the normalized label to
// the canonical key, so a header can match either form.
const KEY_LOOKUP = {};
for (const f of FIELD_DEFS) {
  KEY_LOOKUP[normalizeLabel(f.key)] = f.key;
  KEY_LOOKUP[normalizeLabel(f.label)] = f.key;
}

/**
 * @param {string} headerText  A column header (xlsx) or a table's first-cell
 *                             label (docx)
 * @returns {string|null}  The canonical field key, or null if unrecognised
 */
function resolveFieldKey(headerText) {
  return KEY_LOOKUP[normalizeLabel(headerText)] || null;
}

module.exports = { FIELD_DEFS, normalizeLabel, resolveFieldKey };
