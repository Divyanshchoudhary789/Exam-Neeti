/**
 * Report Generation Service
 *
 * Generates branded PDF and Excel performance reports for students and admins.
 * PDF  → PDFKit   (A4, branded header band, repeating table headers, page footer)
 * XLSX → ExcelJS  (branded title block, styled sheets, auto-fit columns)
 *
 * Reports are produced fully in-memory as Buffers (Render's filesystem is
 * ephemeral) and returned to the caller, which persists the buffer on the
 * Report document so the status is accurate the moment generation finishes.
 */

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { REPORT_FORMAT, REPORT_STATUS } = require("../config/constants");

// ─── Brand constants ─────────────────────────────────────────────────────────
const BRAND = {
  name: "Exam Neeti",
  tagline: "Every Score Has a Strategy",
  indigo: "#4f46e5",
  indigoDark: "#3730a3",
  ink: "#0f172a",
  inkSoft: "#475569",
  inkFaint: "#94a3b8",
  line: "#e2e8f0",
  zebra: "#f8fafc",
  headerBand: "#4f46e5",
};
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

const PAGE = { size: "A4", margin: 48 };
const CONTENT_LEFT = PAGE.margin;
const CONTENT_RIGHT = 595.28 - PAGE.margin; // A4 width − margin
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const CONTENT_BOTTOM = 841.89 - PAGE.margin - 24; // leave room for the footer

const fmtDateTime = (d = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);

// ─── PDF ─────────────────────────────────────────────────────────────────────

const createPDFReport = (reportDoc, data) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve({ buffer, fileSize: buffer.length });
    });
    doc.on("error", reject);

    doc.addPage();

    // ── Branded header band ──────────────────────────────────────────────
    const bandH = 74;
    doc.rect(0, 0, 595.28, bandH).fill(BRAND.headerBand);

    if (LOGO_EXISTS) {
      // White rounded chip behind the logo so it reads on the indigo band.
      doc.roundedRect(CONTENT_LEFT, 16, 42, 42, 8).fill("#ffffff");
      try {
        doc.image(LOGO_PATH, CONTENT_LEFT + 4, 20, { fit: [34, 34], align: "center", valign: "center" });
      } catch {
        /* logo unreadable — the wordmark alone still brands the page */
      }
    }
    const textX = LOGO_EXISTS ? CONTENT_LEFT + 56 : CONTENT_LEFT;
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(17)
      .text(BRAND.name, textX, 20)
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#e0e7ff")
      .text(BRAND.tagline.toUpperCase(), textX, 42, { characterSpacing: 1.5 });

    doc
      .fillColor("#c7d2fe")
      .fontSize(8)
      .text(fmtDateTime(), CONTENT_LEFT, 30, { width: CONTENT_WIDTH, align: "right" })
      .fontSize(7.5)
      .text("CONFIDENTIAL", CONTENT_LEFT, 44, { width: CONTENT_WIDTH, align: "right", characterSpacing: 1 });

    doc.y = bandH + 22;

    // ── Report title + meta block ────────────────────────────────────────
    doc
      .fillColor(BRAND.ink)
      .font("Helvetica-Bold")
      .fontSize(19)
      .text(data.reportTitle || "Performance Report", CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.35);

    if (data.meta && Object.keys(data.meta).length) {
      const entries = Object.entries(data.meta).filter(([, v]) => v !== undefined && v !== null && v !== "");
      const boxY = doc.y;
      const rowH = 15;
      const boxH = entries.length * rowH + 14;
      doc.roundedRect(CONTENT_LEFT, boxY, CONTENT_WIDTH, boxH, 6).fill(BRAND.zebra);
      doc.roundedRect(CONTENT_LEFT, boxY, CONTENT_WIDTH, boxH, 6).strokeColor(BRAND.line).lineWidth(1).stroke();
      let ry = boxY + 8;
      for (const [k, v] of entries) {
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor(BRAND.inkSoft)
          .text(`${k}`, CONTENT_LEFT + 12, ry, { width: 150, continued: false });
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(BRAND.ink)
          .text(String(v), CONTENT_LEFT + 170, ry, { width: CONTENT_WIDTH - 182 });
        ry += rowH;
      }
      doc.y = boxY + boxH + 16;
    } else {
      doc.moveDown(0.5);
    }

    // ── Section renderer ────────────────────────────────────────────────
    const sectionHeading = (title) => {
      if (doc.y > CONTENT_BOTTOM - 60) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(BRAND.indigoDark)
        .text(title, CONTENT_LEFT, doc.y);
      doc.moveDown(0.2);
      doc
        .moveTo(CONTENT_LEFT, doc.y)
        .lineTo(CONTENT_RIGHT, doc.y)
        .lineWidth(1.4)
        .strokeColor(BRAND.indigo)
        .stroke();
      doc.moveDown(0.5);
    };

    // Table with wrapping cells, zebra rows, and a header row that repeats
    // whenever the table spills onto a new page.
    const drawTable = (headers, rows) => {
      const cols = headers.length;
      const colW = CONTENT_WIDTH / cols;
      const padX = 5;
      const padY = 4;

      const cellHeight = (values, font, size) => {
        doc.font(font).fontSize(size);
        let max = 0;
        values.forEach((val) => {
          const h = doc.heightOfString(String(val ?? "—"), { width: colW - padX * 2 });
          if (h > max) max = h;
        });
        return max + padY * 2;
      };

      const drawHeaderRow = () => {
        const h = cellHeight(headers, "Helvetica-Bold", 8);
        const hy = doc.y;
        doc.rect(CONTENT_LEFT, hy, CONTENT_WIDTH, h).fill(BRAND.indigo);
        let x = CONTENT_LEFT;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        headers.forEach((head) => {
          doc.text(String(head), x + padX, hy + padY, { width: colW - padX * 2, lineBreak: false });
          x += colW;
        });
        doc.y = hy + h;
      };

      drawHeaderRow();

      rows.forEach((row, i) => {
        const h = cellHeight(row, "Helvetica", 7.5);
        if (doc.y + h > CONTENT_BOTTOM) {
          doc.addPage();
          drawHeaderRow();
        }
        const y = doc.y;
        if (i % 2 === 0) doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, h).fill(BRAND.zebra);
        doc
          .moveTo(CONTENT_LEFT, y + h)
          .lineTo(CONTENT_RIGHT, y + h)
          .lineWidth(0.5)
          .strokeColor(BRAND.line)
          .stroke();
        let x = CONTENT_LEFT;
        doc.font("Helvetica").fontSize(7.5).fillColor(BRAND.ink);
        row.forEach((cell) => {
          doc.text(String(cell ?? "—"), x + padX, y + padY, { width: colW - padX * 2 });
          x += colW;
        });
        doc.y = y + h;
      });
      doc.moveDown(1);
    };

    const emptyNote = (msg) => {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(BRAND.inkFaint).text(msg, CONTENT_LEFT, doc.y);
      doc.moveDown(1);
    };

    // ── Performance summary ────────────────────────────────────────────
    if (data.summary && Object.keys(data.summary).length) {
      sectionHeading("Performance Summary");
      drawTable(
        ["Metric", "Value"],
        Object.entries(data.summary).map(([k, v]) => [k, v]),
      );
    }

    // ── Subject breakdown ─────────────────────────────────────────────
    if (data.subjectBreakdown) {
      sectionHeading("Subject Performance");
      if (data.subjectBreakdown.length) {
        drawTable(
          ["Subject", "Attempted", "Correct", "Incorrect", "Accuracy %", "Marks", "Neg."],
          data.subjectBreakdown.map((s) => [
            s.subject,
            s.attempted ?? "—",
            s.correct ?? "—",
            s.incorrect ?? "—",
            s.accuracy != null ? `${s.accuracy}%` : "—",
            s.marksObtained ?? "—",
            s.negativeMarks ?? 0,
          ]),
        );
      } else {
        emptyNote("No subject-level data available for this scope yet.");
      }
    }

    // ── Chapter breakdown ─────────────────────────────────────────────
    if (data.chapterBreakdown) {
      sectionHeading("Chapter Performance");
      if (data.chapterBreakdown.length) {
        drawTable(
          ["Subject", "Chapter", "Attempted", "Correct", "Accuracy %", "Marks"],
          data.chapterBreakdown.map((c) => [
            c.subject,
            c.chapter,
            c.attempted ?? "—",
            c.correct ?? "—",
            c.accuracy != null ? `${c.accuracy}%` : "—",
            c.marksObtained ?? "—",
          ]),
        );
      } else {
        emptyNote("No chapter-level data available for this scope yet.");
      }
    }

    // ── Recoverable marks ─────────────────────────────────────────────
    if (data.recoverableMarks) {
      const rm = data.recoverableMarks;
      sectionHeading("Recoverable Marks Analysis");
      drawTable(
        ["Category", "Recoverable Marks"],
        [
          ["Incorrect easy questions", rm.incorrectEasyQuestions ?? 0],
          ["Negative marking loss", rm.negativeLoss ?? 0],
          ["Time misallocation", rm.timeMisallocation ?? 0],
          ["Low-accuracy areas", rm.lowAccuracyAreas ?? 0],
          ["Missed high-ROI questions", rm.missedHighROI ?? 0],
          ["Total recoverable", rm.totalRecoverable ?? 0],
        ],
      );
    }

    // ── Extra sections (report-type specific tables) ──────────────────
    if (data.sections) {
      for (const section of data.sections) {
        sectionHeading(section.title);
        if (section.rows && section.rows.length) {
          drawTable(section.headers, section.rows);
        } else {
          emptyNote("No records for this section.");
        }
      }
    }

    // ── Footer on every page ─────────────────────────────────────────
    // Drop the bottom margin for this pass so PDFKit's line wrapper doesn't
    // treat footer text near the page edge as an overflow and spawn new pages
    // (which would recurse through the whole buffered range).
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      const fy = 841.89 - PAGE.margin + 6;
      doc
        .moveTo(CONTENT_LEFT, fy - 8)
        .lineTo(CONTENT_RIGHT, fy - 8)
        .lineWidth(0.5)
        .strokeColor(BRAND.line)
        .stroke();
      doc.font("Helvetica").fontSize(7).fillColor(BRAND.inkFaint);
      doc.text(`${BRAND.name} — Confidential`, CONTENT_LEFT, fy, {
        width: CONTENT_WIDTH,
        align: "left",
        lineBreak: false,
      });
      doc.text(`Page ${i + 1} of ${range.count}`, CONTENT_LEFT, fy, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });
    }

    doc.flushPages();
    doc.end();
  });

// ─── Excel ───────────────────────────────────────────────────────────────────

const createExcelReport = async (reportDoc, data) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.company = BRAND.name;
  workbook.created = new Date();

  const HEADER_FILL = "FF4F46E5";
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: "FF6366F1" } },
      left: { style: "thin", color: { argb: "FF6366F1" } },
      bottom: { style: "thin", color: { argb: "FF6366F1" } },
      right: { style: "thin", color: { argb: "FF6366F1" } },
    },
  };
  const cellStyle = {
    font: { size: 10 },
    alignment: { vertical: "middle", wrapText: true },
    border: {
      top: { style: "hair", color: { argb: "FFD1D5DB" } },
      left: { style: "hair", color: { argb: "FFD1D5DB" } },
      bottom: { style: "hair", color: { argb: "FFD1D5DB" } },
      right: { style: "hair", color: { argb: "FFD1D5DB" } },
    },
  };

  const usedSheetNames = new Set();
  const addSheet = (rawName, headers, rows, { meta } = {}) => {
    // Excel sheet names: max 31 chars, no []:*?/\, and must be unique — ExcelJS
    // throws on a duplicate, which would 500 the whole download.
    let base = String(rawName).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
    let sheetName = base;
    let n = 2;
    while (usedSheetNames.has(sheetName.toLowerCase())) {
      sheetName = `${base.slice(0, 27)} (${n++})`;
    }
    usedSheetNames.add(sheetName.toLowerCase());
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: meta ? 4 : 1 }],
    });

    let startRow = 1;
    if (meta) {
      sheet.mergeCells(1, 1, 1, Math.max(headers.length, 2));
      const t = sheet.getCell(1, 1);
      t.value = `${BRAND.name} — ${data.reportTitle || "Performance Report"}`;
      t.font = { bold: true, size: 13, color: { argb: "FF3730A3" } };
      sheet.mergeCells(2, 1, 2, Math.max(headers.length, 2));
      const s = sheet.getCell(2, 1);
      s.value = `${meta}  ·  Generated ${fmtDateTime()}  ·  Confidential`;
      s.font = { size: 9, italic: true, color: { argb: "FF64748B" } };
      sheet.addRow([]);
      startRow = 4;
    }

    const headerRow = sheet.getRow(startRow);
    headerRow.values = headers;
    headerRow.eachCell((cell) => Object.assign(cell, headerStyle));
    headerRow.height = 22;

    rows.forEach((row) => {
      const added = sheet.addRow(row);
      added.eachCell((cell) => Object.assign(cell, cellStyle));
    });

    headers.forEach((_, idx) => {
      const col = sheet.getColumn(idx + 1);
      let maxLen = String(headers[idx] ?? "").length + 4;
      rows.forEach((row) => {
        const val = String(row[idx] ?? "");
        if (val.length + 2 > maxLen) maxLen = val.length + 2;
      });
      col.width = Math.min(Math.max(maxLen, 10), 42);
    });

    return sheet;
  };

  const metaLine = data.meta
    ? Object.entries(data.meta)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join("  ·  ")
    : "";

  let sheetsAdded = 0;

  if (data.summary && Object.keys(data.summary).length) {
    addSheet(
      "Summary",
      ["Metric", "Value"],
      Object.entries(data.summary).map(([k, v]) => [k, v]),
      { meta: metaLine || "Performance summary" },
    );
    sheetsAdded++;
  }

  if (data.subjectBreakdown && data.subjectBreakdown.length) {
    addSheet(
      "Subject Performance",
      ["Subject", "Total Qs", "Attempted", "Correct", "Incorrect", "Unattempted", "Marks Obtained", "Negative Marks", "Accuracy %", "Attempt Rate %"],
      data.subjectBreakdown.map((s) => [
        s.subject, s.totalQuestions ?? "", s.attempted ?? "", s.correct ?? "",
        s.incorrect ?? "", s.unattempted ?? "", s.marksObtained ?? "",
        s.negativeMarks ?? "", s.accuracy ?? "", s.attemptRate ?? "",
      ]),
    );
    sheetsAdded++;
  }

  if (data.chapterBreakdown && data.chapterBreakdown.length) {
    addSheet(
      "Chapter Performance",
      ["Subject", "Chapter", "Total Qs", "Attempted", "Correct", "Incorrect", "Marks", "Accuracy %", "Attempt Rate %"],
      data.chapterBreakdown.map((c) => [
        c.subject, c.chapter, c.totalQuestions ?? "", c.attempted ?? "",
        c.correct ?? "", c.incorrect ?? "", c.marksObtained ?? "", c.accuracy ?? "", c.attemptRate ?? "",
      ]),
    );
    sheetsAdded++;
  }

  if (data.topicAccuracy && data.topicAccuracy.length) {
    addSheet(
      "Topic Performance",
      ["Subject", "Chapter", "Topic", "Total Qs", "Attempted", "Correct", "Accuracy %", "Weak", "Strong"],
      data.topicAccuracy.map((t) => [
        t.subject, t.chapter, t.topic, t.totalQuestions ?? "", t.attempted ?? "",
        t.correct ?? "", t.accuracy ?? "", t.isWeak ? "Yes" : "No", t.isStrong ? "Yes" : "No",
      ]),
    );
    sheetsAdded++;
  }

  if (data.recoverableMarks) {
    const rm = data.recoverableMarks;
    addSheet(
      "Recoverable Marks",
      ["Category", "Recoverable Marks"],
      [
        ["Incorrect Easy Questions", rm.incorrectEasyQuestions ?? 0],
        ["Negative Marking Loss", rm.negativeLoss ?? 0],
        ["Time Misallocation", rm.timeMisallocation ?? 0],
        ["Low Accuracy Areas", rm.lowAccuracyAreas ?? 0],
        ["Missed High-ROI Questions", rm.missedHighROI ?? 0],
        ["Total Recoverable", rm.totalRecoverable ?? 0],
      ],
    );
    sheetsAdded++;
  }

  if (data.questionTimings && data.questionTimings.length) {
    addSheet(
      "Time Analysis",
      ["Slot", "Subject", "Difficulty", "Time (s)", "Attempted", "Correct"],
      data.questionTimings.map((q) => [
        q.slotPosition, q.subject, q.difficulty, q.timeSpentSeconds,
        q.isAttempted ? "Yes" : "No",
        q.isCorrect === null || q.isCorrect === undefined ? "N/A" : q.isCorrect ? "Yes" : "No",
      ]),
    );
    sheetsAdded++;
  }

  if (data.sections) {
    for (const section of data.sections) {
      addSheet(section.title, section.headers, section.rows || []);
      sheetsAdded++;
    }
  }

  // Never hand back a zero-sheet workbook — Excel refuses to open it.
  if (sheetsAdded === 0) {
    addSheet("Report", ["Notice"], [["No data is available for this report yet. Take a scored test and try again."]], {
      meta: metaLine || "No data available",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, fileSize: buffer.length };
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a report buffer (PDF or XLSX). Mutates + saves the Report document's
 * status/fileSize/generatedAt. Throws on failure (caller records FAILED).
 *
 * @returns {Promise<{ reportDoc, buffer }>}
 */
const generateReport = async (reportDoc, data) => {
  try {
    const result =
      reportDoc.format === REPORT_FORMAT.PDF
        ? await createPDFReport(reportDoc, data)
        : await createExcelReport(reportDoc, data);

    reportDoc.fileSize = result.fileSize;
    reportDoc.status = REPORT_STATUS.READY;
    reportDoc.generatedAt = new Date();

    return { reportDoc, buffer: result.buffer };
  } catch (err) {
    reportDoc.status = REPORT_STATUS.FAILED;
    throw err;
  }
};

/** Build a human-friendly download filename, e.g. Exam-Neeti_Overall-Performance_2026-09-07.pdf */
const buildReportFilename = (reportDoc, data) => {
  const title = (data?.reportTitle || String(reportDoc.type || "report"))
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  const ext = reportDoc.format === REPORT_FORMAT.PDF ? "pdf" : "xlsx";
  return `Exam-Neeti_${title}_${date}.${ext}`;
};

module.exports = { generateReport, buildReportFilename };
