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
  const columnKeys = {}; // columnIndex -> canonical field key
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = resolveFieldKey(cellText(cell));
    if (key) columnKeys[colNumber] = key;
  });

  if (Object.keys(columnKeys).length === 0) {
    throw new AppError(
      `No recognised columns found in the "${SHEET_NAME}" sheet's header row. Please use the downloaded template.`,
      400
    );
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

    if (!hasAnyValue) continue; // fully blank row — skip silently
    rows.push(rawRow);
  }

  return rows;
}

module.exports = { parseQuestionsXlsx };
