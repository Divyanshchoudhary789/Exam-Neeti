/**
 * checkJson.js — validates a question JSON file and reports all issues
 * Usage: node scripts/checkJson.js --file seedData/questions/chemistry_xii_minor1.json
 */
const fs   = require("fs");
const path = require("path");

const args    = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1]
             || args[args.indexOf("--file") + 1];

if (!fileArg) { console.error("--file required"); process.exit(1); }

const filePath = path.resolve(__dirname, "..", fileArg);
const raw = fs.readFileSync(filePath, "utf-8");

// ── 1. JSON parse test ────────────────────────────────────────────────────────
let questions;
try {
  questions = JSON.parse(raw);
  console.log("✔  JSON parses successfully");
} catch (e) {
  console.error("✖  JSON parse FAILED:", e.message);
  // show context around error position
  const pos = parseInt(e.message.match(/position (\d+)/)?.[1]);
  if (!isNaN(pos)) {
    console.log("\n--- Context around error ---");
    console.log(raw.slice(Math.max(0, pos - 120), pos + 120));
  }
  process.exit(1);
}

// ── 2. Per-question checks ────────────────────────────────────────────────────
const VALID_ANSWERS     = ["A","B","C","D"];
const VALID_DIFFICULTY  = ["easy","medium","hard"];
const VALID_SUBJECT     = ["physics","chemistry","biology"];
const VALID_CLASS       = ["XI","XII"];
const VALID_TYPE        = ["mcq"];

let errorCount = 0;
const chapterSet = new Set();
const sourceRefSet = new Set();

questions.forEach((q, i) => {
  const n = i + 1;
  const err = (msg) => { console.error(`  Q${String(n).padStart(3,"0")} ✖  ${msg}`); errorCount++; };
  const warn = (msg) => console.warn(`  Q${String(n).padStart(3,"0")} ⚠  ${msg}`);

  // Required strings
  ["subject","classLevel","chapter","topic","text","correctAnswer"].forEach(f => {
    if (!q[f]) err(`missing or empty field: "${f}"`);
  });

  // Enum checks
  if (q.subject     && !VALID_SUBJECT.includes(q.subject))    err(`subject "${q.subject}" must be physics/chemistry/biology`);
  if (q.classLevel  && !VALID_CLASS.includes(q.classLevel))   err(`classLevel "${q.classLevel}" must be XI or XII`);
  if (q.difficulty  && !VALID_DIFFICULTY.includes(q.difficulty)) err(`difficulty "${q.difficulty}" must be easy/medium/hard`);
  if (q.correctAnswer && !VALID_ANSWERS.includes(q.correctAnswer)) err(`correctAnswer "${q.correctAnswer}" must be A/B/C/D`);
  if (q.questionType && !VALID_TYPE.includes(q.questionType)) err(`questionType "${q.questionType}" must be mcq`);

  // Type checks
  if (typeof q.marks         !== "number") err(`marks must be a number (got ${typeof q.marks})`);
  if (typeof q.negativeMarks !== "number") err(`negativeMarks must be a number (got ${typeof q.negativeMarks})`);
  if (typeof q.hasLatex      !== "boolean") err(`hasLatex must be boolean (got ${typeof q.hasLatex})`);
  if (q.idealTimeSeconds !== null && typeof q.idealTimeSeconds !== "number") err(`idealTimeSeconds must be a number or null`);

  // Options
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    err(`options must be array of exactly 4 (got ${q.options?.length})`);
  } else {
    q.options.forEach((o, oi) => {
      if (!["A","B","C","D"][oi] === o.key) err(`option[${oi}].key should be ${["A","B","C","D"][oi]}`);
      if (typeof o.text !== "string") err(`option[${oi}].text must be string`);
    });
    // Check options B and C are not identical (Gemini sometimes duplicates)
    const texts = q.options.map(o => o.text.trim());
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    if (dupes.length > 0) warn(`duplicate option texts: ${JSON.stringify(dupes)}`);
  }

  // Solution checks
  if (!q.solution) {
    err(`missing solution object`);
  } else {
    if (typeof q.solution.hasLatex !== "boolean") err(`solution.hasLatex must be boolean`);
    if (!Array.isArray(q.solution.localImagePaths)) err(`solution.localImagePaths must be array`);
    // hasLatex consistency check
    const hasEscapes = (q.solution.text || "").includes("\\(") || (q.solution.text || "").includes("\\[");
    if (hasEscapes && !q.solution.hasLatex) warn(`solution has LaTeX content but hasLatex=false`);
    if (!hasEscapes && q.solution.hasLatex) warn(`solution.hasLatex=true but no \\( found in text`);
  }

  // hasLatex consistency check on question text
  const qHasEscapes = (q.text || "").includes("\\(") || (q.text || "").includes("\\[");
  if (qHasEscapes && !q.hasLatex) warn(`question text has LaTeX but hasLatex=false`);
  if (!qHasEscapes && q.hasLatex) warn(`hasLatex=true but no \\( found in question text`);

  // sourceRef — should not have brackets
  if (q.sourceRef?.startsWith("[")) warn(`sourceRef has brackets: "${q.sourceRef}" — remove [ ] brackets`);

  chapterSet.add(q.chapter);
  sourceRefSet.add(q.sourceRef);
});

// ── 3. Summary ────────────────────────────────────────────────────────────────
console.log(`\n── Summary ──────────────────────────────────`);
console.log(`Total questions : ${questions.length}`);
console.log(`Total errors    : ${errorCount}`);
console.log(`\nChapters found  :`);
[...chapterSet].forEach(c => console.log(`  - "${c}"`));
console.log(`\nSourceRefs found:`);
[...sourceRefSet].forEach(s => console.log(`  - "${s}"`));
console.log(`─────────────────────────────────────────────\n`);
process.exit(errorCount > 0 ? 1 : 0);
