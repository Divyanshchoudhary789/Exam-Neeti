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
  // Not Joi-required — a bulk-upload row missing this gets defaulted to
  // "medium" (see BULK_UPLOAD_DEFAULT_DIFFICULTY in question.controller.js)
  // so the question still lands as a draft instead of failing the row; the
  // admin can set the real difficulty during review. Manual single-question
  // create/edit still always sends an explicit value (the form defaults its
  // dropdown to "Medium"), so this only actually matters for bulk upload.
  { key: "difficulty",       label: "Difficulty (optional — defaults to Medium)", required: false },
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
  // Comma-separated past-exam years this exact question was asked in, e.g.
  // "2019, 2022". Optional — most questions have none. See
  // questionDocxParser.js's extractYearsAndStrip for the Format B
  // equivalent (an inline/standalone "[2022]" tag instead of a table field).
  { key: "previousYears",    label: "Previous Years (e.g. 2019, 2022)", required: false },
  // Image columns — no cell TEXT expected; a picture anchored inside that
  // row's cell in this column is what gets extracted and uploaded to
  // Cloudinary. See questionXlsxParser.js's image-matching logic.
  { key: "questionImage",    label: "Question Image (optional)",    required: false },
  { key: "solutionImage",    label: "Solution Image (optional)",    required: false },
];

/**
 * Extra label variants seen in real teacher-authored documents, beyond the
 * field's own canonical key/label — discovered by testing against actual
 * uploaded papers (not guessed). E.g. one real document used "Concept" for
 * what this schema calls "Topic", "Question type" for "Question Category",
 * and combined "Ideal time: 90 sec" wording. Keep adding here as new real
 * documents surface new variants — this list is the single place that
 * controls how tolerant label-matching is.
 */
const LABEL_ALIASES = {
  topic:            ["concept"],
  questionCategory: ["question type", "category"],
  questionVariant:  ["variant"],
  idealTimeSeconds: ["ideal time", "time", "time limit"],
  classLevel:       ["class"],
  marks:            ["mark", "positive marks"],
  negativeMarks:    ["negative mark", "penalty"],
  previousYears:    ["years", "year", "pyq years", "pyq year", "asked in years", "previous year", "year asked", "yearasked"],
};

/** Lowercase, strip everything but letters/digits — makes matching tolerant
 *  of "Subject *", "subject", "Subject", extra spaces, etc. */
function normalizeLabel(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Build a lookup from the normalized key, the normalized label, AND every
// alias, to the canonical key — so a header can match any of these forms.
const KEY_LOOKUP = {};
for (const f of FIELD_DEFS) {
  KEY_LOOKUP[normalizeLabel(f.key)] = f.key;
  KEY_LOOKUP[normalizeLabel(f.label)] = f.key;
  for (const alias of LABEL_ALIASES[f.key] || []) {
    KEY_LOOKUP[normalizeLabel(alias)] = f.key;
  }
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
