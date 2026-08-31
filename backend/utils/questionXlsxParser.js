/**
 * questionXlsxParser.js
 *
 * Parses the bulk-upload Excel template into raw row objects.
 * Does NOT validate business rules (required fields, enums, LaTeX) — that's
 * the bulk-upload controller's job, reusing the same createQuestionSchema +
 * math pipeline the single-question create flow already uses. This module's
 * only responsibility is: turn a workbook into { field: rawStringValue }
 * objects, faithfully and predictably.
 */

"use strict";

const ExcelJS   = require("exceljs");
const AppError  = require("./AppError");
const { resolveFieldKey } = require("./questionTemplateFields");

const SHEET_NAME = "Questions";

/** Renders any ExcelJS cell value (string, number, rich text, formula
 *  result, Date, hyperlink) down to a plain trimmed string. */
function cellText(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((rt) => rt.text).join("");
    if (v.result !== undefined && v.result !== null) return String(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }
  return String(v).trim();
}

/**
 * @param {Buffer} buffer
 * @returns {Array<{ _rowNumber: number, [field: string]: string }>}
 */
async function parseQuestionsXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets.find(
    (ws) => ws.name.trim().toLowerCase() === SHEET_NAME.toLowerCase()
  );
  if (!worksheet) {
    throw new AppError(
      `Sheet named "${SHEET_NAME}" not found. Please use the downloaded template without renaming its sheets.`,
      400
    );
  }

  const headerRow = worksheet.getRow(1);
  const columnKeys = {};      // columnIndex -> canonical (fixed-schema) field key
  const customColumns = {};   // columnIndex -> raw header label (admin-defined custom fields)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellText(cell);
    const key = resolveFieldKey(header);
    if (key) columnKeys[colNumber] = key;
    // Not one of the fixed schema fields — could be a runtime-defined
    // custom field (e.g. "Sub Topic", "Chapter Weightage"); the caller
    // matches these against the live QuestionFieldDefinition list, since
    // this parser only knows the static field set.
    else if (header) customColumns[colNumber] = header;
  });

  if (Object.keys(columnKeys).length === 0) {
    throw new AppError(
      `No recognised columns found in the "${SHEET_NAME}" sheet's header row. Please use the downloaded template.`,
      400
    );
  }

  // ── Anchored pictures (diagrams pasted into "Question Image" /
  //    "Solution Image" columns) — Excel has no equivalent of Word's
  //    inline-within-text equation objects, so this rich pipeline's Excel
  //    side only adds IMAGE support; formulas still go through the
  //    existing, already-accurate typed-shorthand/LaTeX pipeline
  //    (processMathField) — unchanged, and unlike Word's legacy MathType
  //    objects, this was already working correctly, so there is no OCR
  //    step to add here. Best-effort: never throws — a workbook with no
  //    images, or an ExcelJS version quirk reading them, degrades to
  //    "no images found" rather than failing the whole upload.
  const imagesByRow = new Map(); // rowNumber -> { questionImage?, solutionImage? }
  try {
    const questionImageCol = Number(Object.entries(columnKeys).find(([, k]) => k === "questionImage")?.[0]) || null;
    const solutionImageCol = Number(Object.entries(columnKeys).find(([, k]) => k === "solutionImage")?.[0]) || null;

    if (questionImageCol || solutionImageCol) {
      const media = workbook.model.media || [];
      for (const img of worksheet.getImages()) {
        const mediaEntry = media[img.imageId] || media.find((m) => m?.index === Number(img.imageId));
        if (!mediaEntry || !mediaEntry.buffer) continue;

        // ExcelJS image anchors are 0-based fractional {col, row} — round
        // the top-left corner to the nearest 1-based cell.
        const anchorRow = Math.round(img.range.tl.row) + 1;
        const anchorCol = Math.round(img.range.tl.col) + 1;

        const entry = imagesByRow.get(anchorRow) || {};
        if (questionImageCol && Math.abs(anchorCol - questionImageCol) <= 1) {
          entry.questionImage = { buffer: mediaEntry.buffer, ext: mediaEntry.extension };
        } else if (solutionImageCol && Math.abs(anchorCol - solutionImageCol) <= 1) {
          entry.solutionImage = { buffer: mediaEntry.buffer, ext: mediaEntry.extension };
        }
        imagesByRow.set(anchorRow, entry);
      }
    }
  } catch {
    // Image extraction is a best-effort enhancement — never block text parsing over it.
  }

  const rows = [];
  const totalRows = worksheet.rowCount;

  for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const rawRow = { _rowNumber: rowNumber };
    let hasAnyValue = false;

    for (const [colNumber, key] of Object.entries(columnKeys)) {
      const text = cellText(row.getCell(Number(colNumber)));
      rawRow[key] = text;
      if (text !== "") hasAnyValue = true;
    }

    for (const [colNumber, label] of Object.entries(customColumns)) {
      const text = cellText(row.getCell(Number(colNumber)));
      if (text === "") continue;
      rawRow._customFieldCandidates = rawRow._customFieldCandidates || {};
      rawRow._customFieldCandidates[label] = text;
      hasAnyValue = true;
    }

    const images = imagesByRow.get(rowNumber);
    if (images?.questionImage) { rawRow._questionImageFile = images.questionImage; hasAnyValue = true; }
    if (images?.solutionImage) { rawRow._solutionImageFile = images.solutionImage; hasAnyValue = true; }

    if (!hasAnyValue) continue; // fully blank row — skip silently
    rows.push(rawRow);
  }

  return rows;
}

module.exports = { parseQuestionsXlsx };
