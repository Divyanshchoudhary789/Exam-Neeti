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

// The rich-format worked example: this is the SAME question convention as
// the reference exam paper this pipeline was built against — a metadata
// table (classification fields ONLY, no question text) followed by natural
// "Q. ... / (1)..(4) / Sol. (N) ..." prose. See questionBlockMarkers.js and
// questionDocxParser.js's parseRichQuestionsDocx for the exact rules.
const RICH_EXAMPLE_METADATA = {
  subject: "physics", classLevel: "XI", chapter: "Laws of Motion",
  topic: "Newton's Second Law", questionCategory: "Conceptual",
  questionVariant: "Direct application", difficulty: "easy", idealTimeSeconds: "45",
};

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
    "Formulas: type them as LaTeX wrapped in $...$ (e.g. $\\frac{1}{2}mv^2$) or the shorthand below — directly in the Question Text / Option / Solution Text cells. Excel has no equivalent of Word's inline equation objects, so this typed-formula approach is what the parser reads (and it's already fully accurate — no OCR/AI involved for text).",
    "Images: paste/insert a picture directly into a cell in the \"Question Image\" or \"Solution Image\" column, on the SAME row as that question. It will be uploaded automatically and attached to that question. Leave these columns empty if a question has no diagram.",
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
          new Paragraph({ text: "Two supported formats — use whichever fits how you already write papers", heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
          bullet("Format A — Structured table (Example 1 & 2 below): each question is one 2-column (Field | Value) table with EVERY field, including Question Text/Options/Solution, as rows in that same table. Formulas here must be typed as LaTeX ($...$) — no Word equation objects."),
          bullet("Format B — Natural exam-paper style (Example 3 below): a metadata table with only the classification fields (Subject/Class/Chapter/Topic/.../Difficulty), followed by the question written the way you'd normally type an exam paper — \"Q.\", four numbered options, \"Sol. (N)\" with the correct option number, then the worked solution."),
          bullet("Format B accepts formulas EITHER typed as LaTeX/shorthand OR inserted directly as real equations (Word's Insert > Equation, or MathType/Equation Editor) right inside the question/option/solution text — the system reads and converts these automatically."),
          bullet("Format B also accepts diagram/photo images pasted directly into the question or solution text, in the right place — no separate upload step needed. An option itself can ALSO be entirely an image (e.g. \"which graph best represents…\" questions) — just paste the picture where that option's text would go."),
          bullet(`Allowed Subject values: ${Object.values(SUBJECTS).join(", ")}`),
          bullet(`Allowed Class Level values: ${Object.values(CLASS_LEVELS).join(", ")}`),
          bullet(`Allowed Difficulty values: ${Object.values(DIFFICULTY).join(", ")}`),
          bullet("Correct Answer must be A, B, C, or D."),
          bullet("Every bulk-uploaded question lands as a DRAFT for review (add/fix anything, verify any auto-converted formula) before it's usable in an exam — nothing goes live automatically."),
          new Paragraph({ text: "Delete whichever example(s) don't match your format before uploading your real set — you can mix both formats in one file if you want.", spacing: { before: 100, after: 300 } }),

          new Paragraph({ text: "Format B is tolerant of these common variations — no need to match one exact style", heading: HeadingLevel.HEADING_2 }),
          bullet("Question marker: \"Q.\", \"Q1.\", \"Q 12:\", the full word \"Question\", a bare \"Q\" followed by a wide gap, or no marker at all (the question just starts right after the metadata table)."),
          bullet("Options: numbered (1)-(4) or lettered (a)-(d)/(A)-(D); as plain paragraphs (tab-separated, space-separated, or with no separator at all between adjacent options) OR as a small table/grid."),
          bullet("Solution marker: \"Sol.\", \"SOL.\", \"Solution\", \"Ans.\", \"Answer\" — with the correct option in parentheses or not, and an optional trailing period or colon."),
          bullet("If your document drifts from all of these, that specific question is reported back to you with a clear reason instead of being silently guessed at — fix it in the source file and re-upload just that question."),

          new Paragraph({ text: "Example Question 1 — Format A, plain text, no formulas", heading: HeadingLevel.HEADING_2 }),
          exampleTable(EXAMPLES[0]),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          new Paragraph({ text: "Example Question 2 — Format A, with inline LaTeX formulas", heading: HeadingLevel.HEADING_2 }),
          exampleTable(EXAMPLES[1]),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          new Paragraph({ text: "Example Question 3 — Format B, natural exam-paper style", heading: HeadingLevel.HEADING_2 }),
          new Table({
            columnWidths: [LABEL_COL_WIDTH, VALUE_COL_WIDTH],
            rows: FIELD_DEFS
              .filter((f) => ["subject","classLevel","chapter","topic","questionCategory","questionVariant","difficulty","idealTimeSeconds"].includes(f.key))
              .map((f) => fieldRow(f.label, RICH_EXAMPLE_METADATA[f.key])),
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Q.   A block of mass 2 kg is pushed with a force of 10 N on a frictionless surface. What is its acceleration? (Insert a real equation here for F = ma if you like — typing it as shown also works.)", spacing: { before: 100 } }),
          new Paragraph({ text: "(1) 3 m/s²          (2) 5 m/s²" }),
          new Paragraph({ text: "(3) 8 m/s²          (4) 10 m/s²" }),
          new Paragraph({ text: "Sol.     (2).", spacing: { before: 100 } }),
          new Paragraph({ text: "By Newton's second law, F = ma, so a = F/m = 10/2 = 5 m/s²." }),
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
