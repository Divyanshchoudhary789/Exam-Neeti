/**
 * questionTemplateGenerator.js
 *
 * Generates the downloadable "sample bulk-upload template" files (xlsx and
 * docx), each with an instructions section and 2 filled worked examples
 * (one plain-text, one demonstrating inline LaTeX). Field list comes from
 * questionTemplateFields.js — the SAME module the parsers use to recognise
 * columns/labels — so the template and the parser can never drift apart.
 *
 * Generated once per process lifetime and cached in memory (buffers are
 * small and static per format) rather than shipped as a committed binary —
 * regenerating from this file is how the template stays in sync when fields
 * change, and the codebase has no existing static-asset-serving convention
 * to piggyback on.
 */

"use strict";

const ExcelJS = require("exceljs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = require("docx");

const { FIELD_DEFS } = require("./questionTemplateFields");
const { SUBJECTS, CLASS_LEVELS, DIFFICULTY } = require("../config/constants");

// ─── Worked examples (shown filled-in on the template) ────────────────────────

const EXAMPLES = [
  {
    subject: "physics",
    classLevel: "XI",
    chapter: "Laws of Motion",
    topic: "Newton's Second Law",
    questionCategory: "Conceptual",
    questionVariant: "Direct application",
    difficulty: "easy",
    idealTimeSeconds: "45",
    questionText: "A block of mass 2 kg is pushed with a force of 10 N on a frictionless surface. What is its acceleration, in metres per second squared?",
    optionA: "3", optionB: "5", optionC: "8", optionD: "10",
    correctAnswer: "B",
    marks: "4", negativeMarks: "1",
    solutionText: "By Newton's second law, F = ma, so a = F/m = 10/2 = 5 m/s^2.",
    sourceRef: "Sample Template",
  },
  {
    subject: "physics",
    classLevel: "XI",
    chapter: "Work, Energy and Power",
    topic: "Kinetic Energy",
    questionCategory: "Formula-based",
    questionVariant: "Direct substitution",
    difficulty: "medium",
    idealTimeSeconds: "60",
    questionText: "A particle of mass $m$ moves with velocity $v$. Its kinetic energy is given by $KE = \\frac{1}{2}mv^2$. If $m = 2$ kg and $v = 3$ m/s, find the kinetic energy.",
    optionA: "$6\\ J$", optionB: "$9\\ J$", optionC: "$12\\ J$", optionD: "$18\\ J$",
    correctAnswer: "B",
    marks: "4", negativeMarks: "1",
    solutionText: "$KE = \\frac{1}{2}mv^2 = \\frac{1}{2}(2)(3)^2 = 9\\ J$",
    sourceRef: "Sample Template",
  },
];

const LATEX_CHEATSHEET = [
  ["frac(1,2)",  "\\frac{1}{2}"],
  ["sqrt(x)",    "\\sqrt{x}"],
  ["vec(F)",     "\\vec{F}"],
  ["x^(n+1)",    "x^{n+1}"],
  ["alpha, beta","\\alpha, \\beta (all Greek letters)"],
  ["->",         "\\to"],
  ["<=, >=",     "\\leq, \\geq"],
];

// ─── xlsx ──────────────────────────────────────────────────────────────────────

function colLetter(idx1) {
  let s = "";
  let n = idx1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function generateQuestionsXlsxBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exam Neeti";
  workbook.created = new Date();

  // ── Instructions sheet ──────────────────────────────────────────────────
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 32 }, { width: 90 }];
  const titleRow = instructions.addRow(["Exam Neeti — Bulk Question Upload Template"]);
  titleRow.font = { bold: true, size: 14 };
  instructions.addRow([]);
  instructions.addRow(["How to use this file", ""]).font = { bold: true };
  [
    "Fill in the \"Questions\" sheet — one row per question. Do not rename or remove sheets.",
    "Fields marked * are required. Leave optional fields blank if not applicable.",
    "Any formula MUST already be written as LaTeX wrapped in $...$ (e.g. $\\frac{1}{2}mv^2$) — do not use Word's equation editor.",
    "Do NOT put images in this file. Add question/option/solution images later on the \"My Questions\" review page after uploading.",
    "Two example rows are already filled in on the Questions sheet — replace them with your own questions (or delete them) before uploading.",
  ].forEach((line) => instructions.addRow(["", `• ${line}`]));

  instructions.addRow([]);
  instructions.addRow(["Field reference", ""]).font = { bold: true };
  const fieldHeaderRow = instructions.addRow(["Field", "Required / Notes"]);
  fieldHeaderRow.font = { bold: true };
  for (const f of FIELD_DEFS) {
    instructions.addRow([f.label.replace(" *", ""), f.required ? "Required" : "Optional"]);
  }

  instructions.addRow([]);
  instructions.addRow(["Allowed values", ""]).font = { bold: true };
  instructions.addRow(["Subject", Object.values(SUBJECTS).join(", ")]);
  instructions.addRow(["Class Level", Object.values(CLASS_LEVELS).join(", ")]);
  instructions.addRow(["Difficulty", Object.values(DIFFICULTY).join(", ")]);
  instructions.addRow(["Correct Answer", "A, B, C, or D"]);

  instructions.addRow([]);
  instructions.addRow(["LaTeX shorthand cheat-sheet (optional convenience — full LaTeX also works)", ""]).font = { bold: true };
  const chHeaderRow = instructions.addRow(["Type this", "Renders as"]);
  chHeaderRow.font = { bold: true };
  for (const [a, b] of LATEX_CHEATSHEET) instructions.addRow([a, b]);

  // ── Questions sheet ─────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Questions");
  const headers = FIELD_DEFS.map((f) => f.label);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A56DB" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  headerRow.height = 24;

  for (const ex of EXAMPLES) {
    sheet.addRow(FIELD_DEFS.map((f) => ex[f.key] ?? ""));
  }

  FIELD_DEFS.forEach((f, idx) => {
    const col = sheet.getColumn(idx + 1);
    col.width = Math.min(Math.max(f.label.length + 4, 18), 45);
    col.alignment = { vertical: "middle", wrapText: true };
  });

  // Dropdown data validation for enum-like columns, rows 2-250.
  // NOTE: exceljs's dataValidations.add() takes ONE cell address at a time
  // (it internally rebuilds contiguous ranges when writing) — passing a
  // range string like "A2:A500" directly crashes its internal optimiser.
  const dvColumns = {
    subject:       Object.values(SUBJECTS).join(","),
    classLevel:    Object.values(CLASS_LEVELS).join(","),
    difficulty:    Object.values(DIFFICULTY).join(","),
    correctAnswer: "A,B,C,D",
  };
  const DV_LAST_ROW = 250;
  FIELD_DEFS.forEach((f, idx) => {
    if (!dvColumns[f.key]) return;
    const letter = colLetter(idx + 1);
    const validation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${dvColumns[f.key]}"`],
    };
    for (let row = 2; row <= DV_LAST_ROW; row++) {
      sheet.getCell(`${letter}${row}`).dataValidation = validation;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── docx ──────────────────────────────────────────────────────────────────────

const LABEL_COL_WIDTH = 2600;
const VALUE_COL_WIDTH = 6600;

function fieldRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: LABEL_COL_WIDTH, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: VALUE_COL_WIDTH, type: WidthType.DXA },
        children: [new Paragraph({ text: value || "" })],
      }),
    ],
  });
}

function exampleTable(example) {
  const rows = FIELD_DEFS.map((f) => fieldRow(f.label, example[f.key]));
  return new Table({
    columnWidths: [LABEL_COL_WIDTH, VALUE_COL_WIDTH],
    rows,
  });
}

async function generateQuestionsDocxBuffer() {
  const bullet = (text) => new Paragraph({ text: `•  ${text}`, spacing: { after: 100 } });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: "Exam Neeti — Bulk Question Upload Template", heading: HeadingLevel.TITLE }),
          new Paragraph({ text: "How to use this file", heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
          bullet("Each question must be exactly ONE 2-column table (Field | Value), in the exact format shown below. Do not merge cells or change the field labels."),
          bullet("Fields marked * are required. Leave the value cell blank for optional fields you don't need."),
          bullet("Any formula MUST already be written as LaTeX wrapped in $...$ (e.g. $\\frac{1}{2}mv^2$) — do not use Word's equation editor (Insert > Equation), and do not paste MathType objects."),
          bullet("Do NOT put images in this file. Add question/option/solution images later on the \"My Questions\" review page after uploading."),
          bullet(`Allowed Subject values: ${Object.values(SUBJECTS).join(", ")}`),
          bullet(`Allowed Class Level values: ${Object.values(CLASS_LEVELS).join(", ")}`),
          bullet(`Allowed Difficulty values: ${Object.values(DIFFICULTY).join(", ")}`),
          bullet("Correct Answer must be A, B, C, or D."),
          new Paragraph({ text: "Two worked examples follow — copy a table, fill in your own values, and repeat for every question. Delete these two example tables (or leave them; the parser treats every table as one question) before uploading your real set.", spacing: { before: 100, after: 300 } }),

          new Paragraph({ text: "Example Question 1 (plain text, no formulas)", heading: HeadingLevel.HEADING_2 }),
          exampleTable(EXAMPLES[0]),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          new Paragraph({ text: "Example Question 2 (with inline LaTeX formulas)", heading: HeadingLevel.HEADING_2 }),
          exampleTable(EXAMPLES[1]),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ─── Public API — generate once, cache in memory ──────────────────────────────

const cache = { xlsx: null, docx: null };

/**
 * @param {"xlsx"|"docx"} format
 * @returns {Promise<Buffer>}
 */
async function getQuestionTemplateBuffer(format) {
  if (cache[format]) return cache[format];

  const buffer = format === "xlsx"
    ? await generateQuestionsXlsxBuffer()
    : await generateQuestionsDocxBuffer();

  cache[format] = buffer;
  return buffer;
}

module.exports = { getQuestionTemplateBuffer };
