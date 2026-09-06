/**
 * studentRosterTemplate.js
 *
 * Generates the downloadable "sample student roster" (xlsx / docx) the admin
 * fills in for bulk student import. Header row matches studentRosterParser.js's
 * accepted aliases, so the template and parser can't drift apart.
 *
 * Cached per format per process lifetime.
 */

"use strict";

const ExcelJS = require("exceljs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} = require("docx");

const COLUMNS = ["Name", "Email", "Phone", "Temp Password"];
const EXAMPLES = [
  ["Aarav Sharma", "aarav.sharma@example.com", "9876543210", ""],
  ["Diya Patel", "diya.patel@example.com", "9123456780", "ChangeMe#2026"],
];
const NOTES = [
  "Fill one student per row. Do NOT rename or reorder the header row.",
  '"Name" and "Email" are required. "Phone" is optional.',
  '"Temp Password" is optional — leave it blank and a secure password is generated and emailed to the student. If you set one, it must be at least 8 characters.',
  "Emails already registered on the platform are skipped and reported back.",
  "The target batch is chosen in the upload dialog, not in this file.",
  "Up to 500 students per file.",
];

// ─── XLSX ────────────────────────────────────────────────────────────────────

async function buildXlsx() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Exam Neeti";

  const ws = wb.addWorksheet("Students");
  ws.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Email", key: "email", width: 34 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Temp Password", key: "password", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
  EXAMPLES.forEach((r) => ws.addRow(r));

  const info = wb.addWorksheet("Instructions");
  info.getColumn(1).width = 110;
  info.addRow(["How to use this template"]).font = { bold: true, size: 14 };
  info.addRow([]);
  NOTES.forEach((n) => info.addRow([`• ${n}`]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

const cell = (text, bold = false) =>
  new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
  });

async function buildDocx() {
  const rows = [
    new TableRow({ tableHeader: true, children: COLUMNS.map((c) => cell(c, true)) }),
    ...EXAMPLES.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    new TableRow({ children: COLUMNS.map(() => cell("")) }),
    new TableRow({ children: COLUMNS.map(() => cell("")) }),
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Exam Neeti — Bulk Student Roster")] }),
        new Paragraph({ children: [new TextRun({ text: "Fill in the table below (one student per row) and upload it from the Bulk Import dialog.", size: 22 })] }),
        new Paragraph({ children: [] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
          },
          rows,
        }),
        new Paragraph({ children: [] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Notes")] }),
        ...NOTES.map((n) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: n, size: 20 })] })),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

// ─── Cached accessor ─────────────────────────────────────────────────────────

const cache = { xlsx: null, docx: null };

async function getStudentTemplateBuffer(format) {
  if (format !== "xlsx" && format !== "docx") {
    throw Object.assign(new Error("format must be xlsx or docx"), { statusCode: 400 });
  }
  if (!cache[format]) {
    cache[format] = format === "xlsx" ? await buildXlsx() : await buildDocx();
  }
  return cache[format];
}

module.exports = { getStudentTemplateBuffer };
