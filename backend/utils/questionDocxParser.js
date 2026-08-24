/**
 * questionDocxParser.js
 *
 * Parses the bulk-upload Word template into raw row objects.
 *
 * The template format is a NEW, structured format we control — NOT an
 * attempt to parse arbitrary exam-paper prose. Each question is exactly one
 * 2-column table (Field | Value), with fixed field labels. This is what
 * makes reliable parsing possible at all (arbitrary Word docs using legacy
 * MathType OLE-embedded equations are NOT reliably parseable — confirmed by
 * direct inspection of a real exam paper during feature research).
 *
 * Text-reconstruction rule (get this wrong and LaTeX silently corrupts):
 *   - <w:t> runs WITHIN one <w:p> paragraph → joined with NO separator.
 *     Word constantly splits words/LaTeX commands across runs (spell-check
 *     boundaries, revision marks); inserting a space would turn "\frac"
 *     into "\f rac".
 *   - Separate <w:p> paragraphs WITHIN one cell → joined with "\n".
 *
 * Does NOT validate business rules — same division of responsibility as
 * questionXlsxParser.js.
 */

"use strict";

const JSZip    = require("jszip");
const AppError = require("./AppError");
const { resolveFieldKey } = require("./questionTemplateFields");

// ─── Generic non-greedy block extractor ───────────────────────────────────────

/** Extracts all `<w:TAG ...>...</w:TAG>` blocks (non-nested — fine for our
 *  own controlled template, which never nests tables/cells). */
function extractBlocks(xml, tagName) {
  const re = new RegExp(`<w:${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:${tagName}>`, "g");
  const blocks = [];
  let m;
  while ((m = re.exec(xml)) !== null) blocks.push(m[1]);
  return blocks;
}

// ─── XML entity decoding ───────────────────────────────────────────────────────

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&"); // must be last
}

// ─── Cell text extraction ──────────────────────────────────────────────────────

/** Extracts the full text of one <w:tc>...</w:tc> cell body, applying the
 *  run/paragraph joining rule described in the file header. */
function extractCellText(tcXml) {
  const paragraphs = extractBlocks(tcXml, "p");
  const paraTexts = paragraphs.map((pXml) => {
    // A manual line-break within a paragraph is a real separator, unlike a
    // run split — normalise both <w:br/> and <w:tab/> before extracting runs.
    const normalized = pXml
      .replace(/<w:br(?:\s[^>]*)?\/>/g, "\n")
      .replace(/<w:tab(?:\s[^>]*)?\/>/g, "\t");

    const runRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let text = "";
    let m;
    while ((m = runRe.exec(normalized)) !== null) {
      text += decodeXmlEntities(m[1]);
    }
    return text;
  });

  return paraTexts.join("\n").trim();
}

// ─── Table → question row ──────────────────────────────────────────────────────

/** Parses one <w:tbl> block into a raw field-key → value object.
 *  Returns null if the table has no recognisable fields (e.g. a decorative
 *  or instructions table that isn't a question table). */
function parseTable(tblXml, tableIndex) {
  const rows = extractBlocks(tblXml, "tr");
  const rawRow = { _rowNumber: tableIndex };
  let matchedAny = false;

  for (const rowXml of rows) {
    const cells = extractBlocks(rowXml, "tc");
    if (cells.length !== 2) continue; // not a Field|Value row — skip

    const label = extractCellText(cells[0]);
    const value = extractCellText(cells[1]);
    const key = resolveFieldKey(label);
    if (!key) continue;

    rawRow[key] = value;
    matchedAny = true;
  }

  return matchedAny ? rawRow : null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ _rowNumber: number, [field: string]: string }>>}
 */
async function parseQuestionsDocx(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError("Could not read the uploaded .docx file — it may be corrupted.", 400);
  }

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new AppError("This does not look like a valid .docx file (missing word/document.xml).", 400);
  }

  const xml = await docXmlFile.async("string");
  const tables = extractBlocks(xml, "tbl");

  if (tables.length === 0) {
    throw new AppError(
      "No question tables found in the document. Please use the downloaded template — each question must be a 2-column table.",
      400
    );
  }

  const rows = [];
  let questionIndex = 0;
  for (const tblXml of tables) {
    questionIndex += 1;
    const parsed = parseTable(tblXml, questionIndex);
    if (parsed) rows.push(parsed);
  }

  if (rows.length === 0) {
    throw new AppError(
      "Found tables in the document, but none matched the expected question field labels. Please use the downloaded template.",
      400
    );
  }

  return rows;
}

module.exports = { parseQuestionsDocx };
