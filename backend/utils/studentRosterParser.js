/**
 * studentRosterParser.js
 *
 * Parses an admin-uploaded student roster (.xlsx or .docx) into a plain
 * `[{ name, email, phone, password }]` array for the bulk-import flow.
 *
 * Both formats are expected to be a single table whose FIRST row is a header
 * ("Name", "Email", "Phone", "Temp Password"). Header matching is
 * case/space/punctuation-insensitive and accepts common aliases, so an admin
 * building the sheet by hand (not from our template) still works.
 */

"use strict";

const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const AppError = require("./AppError");

// canonical field -> accepted header aliases (all normalised the same way)
const FIELD_ALIASES = {
  name: ["name", "fullname", "studentname", "student"],
  email: ["email", "emailaddress", "emailid", "mail"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "whatsapp"],
  password: ["password", "temppassword", "temporarypassword", "initialpassword", "pwd"],
};

const normHeader = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function resolveHeader(header) {
  const n = normHeader(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(n)) return field;
  }
  return null;
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

function cellText(cell) {
  const v = cell && cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((rt) => rt.text).join("");
    if (v.result !== undefined && v.result !== null) return String(v.result);
    if (v.text !== undefined) return String(v.text);
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }
  return String(v);
}

async function parseXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
  if (!ws) throw new AppError("The spreadsheet has no sheets.", 400);

  const colField = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const f = resolveHeader(cellText(cell));
    if (f) colField[col] = f;
  });
  if (!colField || !Object.values(colField).includes("name") || !Object.values(colField).includes("email")) {
    throw new AppError(
      'Could not find "Name" and "Email" columns in the first row. Download the sample format and keep its header row.',
      400
    );
  }

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const rec = { _row: rowNumber };
    let any = false;
    Object.entries(colField).forEach(([col, field]) => {
      const val = cellText(row.getCell(Number(col))).trim();
      if (val) any = true;
      rec[field] = val;
    });
    if (any) rows.push(rec);
  });
  return rows;
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function cellTextFromTc(tcXml) {
  const runRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let out = "";
  let m;
  while ((m = runRe.exec(tcXml)) !== null) out += decodeXml(m[1]);
  return out.trim();
}

async function parseDocx(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError("Could not read the .docx file — it may be corrupted.", 400);
  }
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new AppError("This does not look like a valid .docx file.", 400);
  const xml = await docFile.async("string");

  const tblMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!tblMatch) {
    throw new AppError("No table found in the document. Download the sample format and fill in its table.", 400);
  }
  const tbl = tblMatch[0];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  const trs = [];
  let tm;
  while ((tm = trRe.exec(tbl)) !== null) trs.push(tm[1]);
  if (trs.length < 2) throw new AppError("The table has no data rows.", 400);

  const cellsOf = (trXml) => {
    const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    const cells = [];
    let cm;
    while ((cm = tcRe.exec(trXml)) !== null) cells.push(cellTextFromTc(cm[1]));
    return cells;
  };

  const headerCells = cellsOf(trs[0]);
  const colField = {};
  headerCells.forEach((h, i) => {
    const f = resolveHeader(h);
    if (f) colField[i] = f;
  });
  if (!Object.values(colField).includes("name") || !Object.values(colField).includes("email")) {
    throw new AppError(
      'Could not find "Name" and "Email" columns in the table header. Download the sample format and keep its header row.',
      400
    );
  }

  const rows = [];
  for (let r = 1; r < trs.length; r++) {
    const cells = cellsOf(trs[r]);
    const rec = { _row: r + 1 };
    let any = false;
    Object.entries(colField).forEach(([idx, field]) => {
      const val = (cells[Number(idx)] || "").trim();
      if (val) any = true;
      rec[field] = val;
    });
    if (any) rows.push(rec);
  }
  return rows;
}

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @param {"xlsx"|"docx"} format
 * @returns {Promise<{ students: Array<{name,email,phone,password,_row}>, skipped: Array<{row,reason}> }>}
 */
async function parseStudentRoster(buffer, format) {
  const rawRows = format === "xlsx" ? await parseXlsx(buffer) : await parseDocx(buffer);

  const students = [];
  const skipped = [];
  const seen = new Set();

  for (const row of rawRows) {
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    const phone = (row.phone || "").trim().replace(/[^\d+]/g, "") || null;
    const password = (row.password || "").trim() || null;

    if (!name && !email) continue; // fully blank row
    if (!name || name.length < 2) { skipped.push({ row: row._row, reason: "Missing / too-short name." }); continue; }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { skipped.push({ row: row._row, reason: `Invalid email "${row.email || ""}".` }); continue; }
    if (seen.has(email)) { skipped.push({ row: row._row, reason: `Duplicate of an earlier row (${email}).` }); continue; }
    if (password && password.length < 8) { skipped.push({ row: row._row, reason: "Temp password must be at least 8 characters (leave blank to auto-generate)." }); continue; }
    seen.add(email);

    students.push({ name, email, phone, password, _row: row._row });
  }

  if (students.length === 0 && skipped.length === 0) {
    throw new AppError("No student rows found in the file.", 400);
  }
  return { students, skipped };
}

module.exports = { parseStudentRoster };
