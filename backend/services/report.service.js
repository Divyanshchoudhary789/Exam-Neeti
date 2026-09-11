/**
 * Report Generation Service
 *
 * Generates branded PDF and Excel performance reports for students and admins.
 * PDF  → PDFKit   (A4, branded header band, KPI cards, proportional tables,
 *                  repeating headers, page footer with numbering)
 * XLSX → ExcelJS  (branded title strip on every sheet, styled headers,
 *                  auto-filter, numeric cells + % number formats, auto-fit cols)
 *
 * Reports are produced fully in-memory as Buffers (Render's filesystem is
 * ephemeral) and returned to the caller, which persists the buffer on the
 * Report document so the status is accurate the moment generation finishes.
 *
 * The `data` contract from report.controller.js.buildReportData():
 *   {
 *     reportTitle: string,
 *     meta?:    { [label]: value },
 *     summary?: { [label]: value },          // rendered as KPI cards / a 2-col sheet
 *     subjectBreakdown?: Row[],              // known shape — see columns below
 *     chapterBreakdown?: Row[],
 *     topicAccuracy?: Row[],
 *     recoverableMarks?: { ... } | null,
 *     questionTimings?: Row[],               // XLSX only (can be 180+ rows)
 *     sections?: [{ title, headers, rows, widths?, align?, percentCols? }]
 *   }
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
  good: "#059669",
  warn: "#d97706",
  bad: "#dc2626",
};
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

const PAGE = { size: "A4", margin: 48 };
const PW = 595.28;
const PH = 841.89;
const CONTENT_LEFT = PAGE.margin;
const CONTENT_RIGHT = PW - PAGE.margin;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const CONTENT_BOTTOM = PH - PAGE.margin - 24; // leave room for the footer

// ─── Shared value helpers ────────────────────────────────────────────────────

const fmtDateTime = (d = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s || "—");
const n = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
const pctCell = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toFixed(1)}%`);

/** A cell that reads as a number (optionally %, sign, thousands sep). */
const NUMERICISH = /^-?[\d,]+(\.\d+)?\s*%?$/;
const isNumericCell = (v) => {
  if (v == null || v === "" || v === "—") return true; // blanks don't break alignment
  return NUMERICISH.test(String(v).trim());
};
const numOf = (v) => {
  const x = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : null;
};
const accColour = (v) => {
  const x = numOf(v);
  if (x == null) return null;
  return x >= 70 ? BRAND.good : x >= 40 ? BRAND.warn : BRAND.bad;
};

/** Turn a plain numeric string ("1,240", "-3", "84.5") into a Number for Excel.
 *  Percentage strings ("85%") are deliberately left as text so the "%" is kept
 *  — structured breakdowns pass raw numbers + `percentCols` for real % cells. */
const coerceNumber = (v) => {
  if (typeof v === "number" || v == null || v === "") return v;
  const s = String(v).trim();
  const m = s.match(/^(-?)([\d,]+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1] + m[2].replace(/,/g, "")) : v;
};

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
    doc.rect(0, 0, PW, bandH).fill(BRAND.headerBand);

    if (LOGO_EXISTS) {
      doc.roundedRect(CONTENT_LEFT, 16, 42, 42, 8).fill("#ffffff");
      try {
        doc.image(LOGO_PATH, CONTENT_LEFT + 4, 20, { fit: [34, 34], align: "center", valign: "center" });
      } catch {
        /* logo unreadable — the wordmark alone still brands the page */
      }
    }
    const textX = LOGO_EXISTS ? CONTENT_LEFT + 56 : CONTENT_LEFT;
    doc
      .fillColor("#ffffff").font("Helvetica-Bold").fontSize(17)
      .text(BRAND.name, textX, 20)
      .font("Helvetica").fontSize(8.5).fillColor("#e0e7ff")
      .text(BRAND.tagline.toUpperCase(), textX, 42, { characterSpacing: 1.5 });
    doc
      .fillColor("#c7d2fe").fontSize(8)
      .text(fmtDateTime(), CONTENT_LEFT, 30, { width: CONTENT_WIDTH, align: "right" })
      .fontSize(7.5)
      .text("CONFIDENTIAL", CONTENT_LEFT, 44, { width: CONTENT_WIDTH, align: "right", characterSpacing: 1 });

    doc.y = bandH + 22;

    // ── Report title + meta box ─────────────────────────────────────────
    doc
      .fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(19)
      .text(data.reportTitle || "Performance Report", CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.35);

    const metaEntries = data.meta
      ? Object.entries(data.meta).filter(([, v]) => v !== undefined && v !== null && v !== "")
      : [];
    if (metaEntries.length) {
      const boxY = doc.y;
      const rowH = 15;
      const boxH = metaEntries.length * rowH + 14;
      doc.roundedRect(CONTENT_LEFT, boxY, CONTENT_WIDTH, boxH, 6).fill(BRAND.zebra);
      doc.roundedRect(CONTENT_LEFT, boxY, CONTENT_WIDTH, boxH, 6).strokeColor(BRAND.line).lineWidth(1).stroke();
      let ry = boxY + 8;
      for (const [k, v] of metaEntries) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BRAND.inkSoft)
          .text(String(k), CONTENT_LEFT + 12, ry, { width: 150 });
        doc.font("Helvetica").fontSize(8.5).fillColor(BRAND.ink)
          .text(String(v), CONTENT_LEFT + 170, ry, { width: CONTENT_WIDTH - 182, lineBreak: false });
        ry += rowH;
      }
      doc.y = boxY + boxH + 18;
    } else {
      doc.moveDown(0.5);
    }

    // ── Section heading ─────────────────────────────────────────────────
    const sectionHeading = (title) => {
      if (doc.y > CONTENT_BOTTOM - 64) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.indigoDark).text(title, CONTENT_LEFT, doc.y);
      doc.moveDown(0.2);
      doc.moveTo(CONTENT_LEFT, doc.y).lineTo(CONTENT_RIGHT, doc.y).lineWidth(1.4).strokeColor(BRAND.indigo).stroke();
      doc.moveDown(0.55);
    };

    const emptyNote = (msg) => {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(BRAND.inkFaint).text(msg, CONTENT_LEFT, doc.y);
      doc.moveDown(1);
    };

    // ── KPI cards (for the summary block) ───────────────────────────────
    const kpiCards = (obj) => {
      const items = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "");
      if (!items.length) return;
      const perRow = 3;
      const gap = 10;
      const cw = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
      const ch = 48;
      const rows = Math.ceil(items.length / perRow);
      for (let r = 0; r < rows; r++) {
        if (doc.y + ch > CONTENT_BOTTOM) doc.addPage();
        const rowY = doc.y;
        for (let c = 0; c < perRow; c++) {
          const it = items[r * perRow + c];
          if (!it) continue;
          const [label, value] = it;
          const x = CONTENT_LEFT + c * (cw + gap);
          doc.roundedRect(x, rowY, cw, ch, 6).fill(BRAND.zebra);
          doc.roundedRect(x, rowY, cw, ch, 6).strokeColor(BRAND.line).lineWidth(0.8).stroke();
          let colour = BRAND.ink;
          if (/negative|lost|loss/i.test(label)) colour = BRAND.bad;
          else if (/recover/i.test(label)) colour = BRAND.warn;
          else if (/accuracy|score|percent/i.test(label)) colour = BRAND.indigo;
          doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.inkFaint)
            .text(String(label).toUpperCase(), x + 9, rowY + 8, { width: cw - 18, characterSpacing: 0.4, lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(15).fillColor(colour)
            .text(String(value), x + 9, rowY + 21, { width: cw - 18, lineBreak: false });
        }
        doc.y = rowY + ch + gap;
      }
      doc.y += 4;
    };

    // ── Proportional table ─────────────────────────────────────────────
    // Column widths come from the widest header/sample cell per column, then
    // scaled to the content width — so a 9-column table no longer crushes every
    // cell into an identical sliver. Numeric columns are right-aligned; accuracy
    // columns are colour-graded.
    const drawTable = (headers, rows, opts = {}) => {
      const cols = headers.length;
      const padX = 5, padY = 4;
      const sample = rows.slice(0, 40);

      const natural = headers.map((h, i) => {
        doc.font("Helvetica-Bold").fontSize(8);
        let w = doc.widthOfString(String(h ?? ""));
        doc.font("Helvetica").fontSize(7.5);
        for (const row of sample) {
          const cw = doc.widthOfString(String(row[i] ?? "—"));
          if (cw > w) w = cw;
        }
        return Math.min(w + padX * 2, CONTENT_WIDTH * 0.42);
      });

      let widths;
      if (Array.isArray(opts.widths) && opts.widths.length === cols) {
        const tot = opts.widths.reduce((a, b) => a + b, 0);
        widths = opts.widths.map((w) => (w / tot) * CONTENT_WIDTH);
      } else {
        const tot = natural.reduce((a, b) => a + b, 0) || 1;
        widths = natural.map((w) => (w / tot) * CONTENT_WIDTH);
      }

      const rightAlign = headers.map((_, i) =>
        opts.align?.[i] ? opts.align[i] === "right" : sample.length > 0 && sample.every((row) => isNumericCell(row[i])),
      );
      const colourCol = headers.map((h) => /accuracy|acc\.|acc %/i.test(String(h)));

      const rowHeight = (vals, font, size) => {
        doc.font(font).fontSize(size);
        let max = 0;
        vals.forEach((v, i) => {
          const h = doc.heightOfString(String(v ?? "—"), { width: widths[i] - padX * 2 });
          if (h > max) max = h;
        });
        return max + padY * 2;
      };

      const headerRow = () => {
        const h = rowHeight(headers, "Helvetica-Bold", 8);
        const y = doc.y;
        doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, h).fill(BRAND.indigo);
        let x = CONTENT_LEFT;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        headers.forEach((head, i) => {
          doc.text(String(head), x + padX, y + padY, {
            width: widths[i] - padX * 2,
            align: rightAlign[i] ? "right" : "left",
            lineBreak: false,
          });
          x += widths[i];
        });
        doc.y = y + h;
      };

      headerRow();
      rows.forEach((row, ri) => {
        const h = rowHeight(row, "Helvetica", 7.5);
        if (doc.y + h > CONTENT_BOTTOM) { doc.addPage(); headerRow(); }
        const y = doc.y;
        if (ri % 2 === 0) doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, h).fill(BRAND.zebra);
        doc.moveTo(CONTENT_LEFT, y + h).lineTo(CONTENT_RIGHT, y + h).lineWidth(0.5).strokeColor(BRAND.line).stroke();
        let x = CONTENT_LEFT;
        row.forEach((cell, ci) => {
          const colour = colourCol[ci] ? accColour(cell) || BRAND.ink : BRAND.ink;
          doc.font("Helvetica").fontSize(7.5).fillColor(colour)
            .text(String(cell ?? "—"), x + padX, y + padY, {
              width: widths[ci] - padX * 2,
              align: rightAlign[ci] ? "right" : "left",
            });
          x += widths[ci];
        });
        doc.y = y + h;
      });
      doc.moveDown(1);
    };

    // ── Performance summary → KPI cards ─────────────────────────────────
    if (data.summary && Object.keys(data.summary).length) {
      sectionHeading("Performance Summary");
      kpiCards(data.summary);
    }

    // ── Subject breakdown ─────────────────────────────────────────────
    if (data.subjectBreakdown) {
      sectionHeading("Subject Performance");
      if (data.subjectBreakdown.length) {
        drawTable(
          ["Subject", "Total Qs", "Attempted", "Correct", "Incorrect", "Accuracy %", "Attempt %", "Marks", "Negative"],
          data.subjectBreakdown.map((s) => [
            cap(s.subject),
            n(s.totalQuestions), n(s.attempted), n(s.correct), n(s.incorrect),
            pctCell(s.accuracy), pctCell(s.attemptRate),
            n(s.marksObtained), s.negativeMarks != null ? `-${Math.abs(s.negativeMarks)}` : "0",
          ]),
          { widths: [20, 10, 11, 9, 10, 12, 11, 9, 10] },
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
          ["Subject", "Chapter", "Total Qs", "Attempted", "Correct", "Accuracy %", "Attempt %", "Marks"],
          data.chapterBreakdown.map((c) => [
            cap(c.subject), c.chapter,
            n(c.totalQuestions), n(c.attempted), n(c.correct),
            pctCell(c.accuracy), pctCell(c.attemptRate), n(c.marksObtained),
          ]),
          { widths: [16, 26, 10, 11, 10, 12, 11, 9] },
        );
      } else {
        emptyNote("No chapter-level data available for this scope yet.");
      }
    }

    // ── Topic performance (weak first) ────────────────────────────────
    if (data.topicAccuracy && data.topicAccuracy.length) {
      sectionHeading("Topic Performance");
      const sorted = [...data.topicAccuracy].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).slice(0, 40);
      drawTable(
        ["Topic", "Subject", "Chapter", "Attempted", "Correct", "Accuracy %"],
        sorted.map((t) => [
          t.topic, cap(t.subject), t.chapter, n(t.attempted), n(t.correct), pctCell(t.accuracy),
        ]),
        { widths: [26, 13, 22, 11, 10, 12] },
      );
      if (data.topicAccuracy.length > 40) {
        emptyNote(`Showing the 40 lowest-accuracy topics of ${data.topicAccuracy.length}. The Excel version lists all of them.`);
      }
    }

    // ── Recoverable marks ────────────────────────────────────────────
    if (data.recoverableMarks) {
      const rm = data.recoverableMarks;
      sectionHeading("Recoverable Marks Analysis");
      drawTable(
        ["Category", "Recoverable Marks"],
        [
          ["Incorrect easy questions", n(rm.incorrectEasyQuestions ?? 0)],
          ["Negative marking loss", n(rm.negativeLoss ?? 0)],
          ["Time misallocation", n(rm.timeMisallocation ?? 0)],
          ["Low-accuracy areas", n(rm.lowAccuracyAreas ?? 0)],
          ["Missed high-ROI questions", n(rm.missedHighROI ?? 0)],
          ["Total recoverable", n(rm.totalRecoverable ?? 0)],
        ],
        { widths: [70, 30], align: [null, "right"] },
      );
    }

    // ── Extra sections (report-type specific tables) ─────────────────
    if (data.sections) {
      for (const section of data.sections) {
        sectionHeading(section.title);
        if (section.rows && section.rows.length) {
          drawTable(section.headers, section.rows, { widths: section.widths, align: section.align });
        } else {
          emptyNote("No records for this section.");
        }
      }
    }

    // ── Footer on every page ────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const stamp = fmtDateTime();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      const fy = PH - PAGE.margin + 6;
      doc.moveTo(CONTENT_LEFT, fy - 8).lineTo(CONTENT_RIGHT, fy - 8).lineWidth(0.5).strokeColor(BRAND.line).stroke();
      doc.font("Helvetica").fontSize(7).fillColor(BRAND.inkFaint);
      doc.text(`${BRAND.name} · Confidential · generated ${stamp}`, CONTENT_LEFT, fy, {
        width: CONTENT_WIDTH, align: "left", lineBreak: false,
      });
      doc.text(`Page ${i + 1} of ${range.count}`, CONTENT_LEFT, fy, {
        width: CONTENT_WIDTH, align: "right", lineBreak: false,
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

  const metaLine = data.meta
    ? Object.entries(data.meta)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join("   ·   ")
    : "";

  const usedSheetNames = new Set();
  /**
   * @param {string}   rawName
   * @param {string[]} headers
   * @param {Array[]}  rows
   * @param {object}   [o]
   * @param {number[]} [o.percentCols]  0-based indices to format as a percentage (value is a 0–100 number)
   */
  const addSheet = (rawName, headers, rows, o = {}) => {
    // Sheet names: max 31 chars, no []:*?/\, unique — ExcelJS throws on a
    // duplicate, which would 500 the whole download.
    const base = String(rawName).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
    let sheetName = base;
    let k = 2;
    while (usedSheetNames.has(sheetName.toLowerCase())) sheetName = `${base.slice(0, 27)} (${k++})`;
    usedSheetNames.add(sheetName.toLowerCase());

    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 4 }] });

    const span = Math.max(headers.length, 2);
    sheet.mergeCells(1, 1, 1, span);
    const t = sheet.getCell(1, 1);
    t.value = `${BRAND.name} — ${data.reportTitle || "Performance Report"}`;
    t.font = { bold: true, size: 13, color: { argb: "FF3730A3" } };
    sheet.mergeCells(2, 1, 2, span);
    const s = sheet.getCell(2, 1);
    s.value = `${metaLine ? metaLine + "   ·   " : ""}Generated ${fmtDateTime()}   ·   Confidential`;
    s.font = { size: 9, italic: true, color: { argb: "FF64748B" } };
    sheet.addRow([]);
    const startRow = 4;

    const headerRow = sheet.getRow(startRow);
    headerRow.values = headers;
    headerRow.eachCell((cell) => Object.assign(cell, headerStyle));
    headerRow.height = 22;

    const percent = new Set(o.percentCols || []);
    rows.forEach((row) => {
      const added = sheet.addRow(row.map((v) => coerceNumber(v)));
      added.eachCell((cell, colNumber) => {
        Object.assign(cell, cellStyle);
        if (typeof cell.value === "number") {
          cell.alignment = { ...cell.alignment, horizontal: "right" };
          if (percent.has(colNumber - 1)) cell.numFmt = '0.0"%"'; // value already 0–100
        }
      });
    });

    sheet.autoFilter = {
      from: { row: startRow, column: 1 },
      to: { row: startRow + rows.length, column: headers.length },
    };

    headers.forEach((_, idx) => {
      const col = sheet.getColumn(idx + 1);
      let maxLen = String(headers[idx] ?? "").length + 4;
      rows.forEach((row) => {
        const val = String(row[idx] ?? "");
        if (val.length + 2 > maxLen) maxLen = val.length + 2;
      });
      col.width = Math.min(Math.max(maxLen, 10), 46);
    });

    return sheet;
  };

  let sheetsAdded = 0;

  if (data.summary && Object.keys(data.summary).length) {
    addSheet("Summary", ["Metric", "Value"], Object.entries(data.summary).map(([k, v]) => [k, v]));
    sheetsAdded++;
  }

  if (data.subjectBreakdown && data.subjectBreakdown.length) {
    addSheet(
      "Subject Performance",
      ["Subject", "Total Qs", "Attempted", "Correct", "Incorrect", "Unattempted", "Marks Obtained", "Negative Marks", "Accuracy %", "Attempt Rate %"],
      data.subjectBreakdown.map((s) => [
        cap(s.subject), s.totalQuestions ?? "", s.attempted ?? "", s.correct ?? "",
        s.incorrect ?? "", s.unattempted ?? "", s.marksObtained ?? "",
        s.negativeMarks ?? "", s.accuracy ?? "", s.attemptRate ?? "",
      ]),
      { percentCols: [8, 9] },
    );
    sheetsAdded++;
  }

  if (data.chapterBreakdown && data.chapterBreakdown.length) {
    addSheet(
      "Chapter Performance",
      ["Subject", "Chapter", "Total Qs", "Attempted", "Correct", "Incorrect", "Marks", "Accuracy %", "Attempt Rate %"],
      data.chapterBreakdown.map((c) => [
        cap(c.subject), c.chapter, c.totalQuestions ?? "", c.attempted ?? "",
        c.correct ?? "", c.incorrect ?? "", c.marksObtained ?? "", c.accuracy ?? "", c.attemptRate ?? "",
      ]),
      { percentCols: [7, 8] },
    );
    sheetsAdded++;
  }

  if (data.topicAccuracy && data.topicAccuracy.length) {
    addSheet(
      "Topic Performance",
      ["Subject", "Chapter", "Topic", "Total Qs", "Attempted", "Correct", "Accuracy %", "Weak", "Strong"],
      [...data.topicAccuracy]
        .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
        .map((t) => [
          cap(t.subject), t.chapter, t.topic, t.totalQuestions ?? "", t.attempted ?? "",
          t.correct ?? "", t.accuracy ?? "", t.isWeak ? "Yes" : "No", t.isStrong ? "Yes" : "No",
        ]),
      { percentCols: [6] },
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
        q.slotPosition, cap(q.subject), cap(q.difficulty), q.timeSpentSeconds,
        q.isAttempted ? "Yes" : "No",
        q.isCorrect === null || q.isCorrect === undefined ? "N/A" : q.isCorrect ? "Yes" : "No",
      ]),
    );
    sheetsAdded++;
  }

  if (data.sections) {
    for (const section of data.sections) {
      addSheet(section.title, section.headers, section.rows || [], { percentCols: section.percentCols });
      sheetsAdded++;
    }
  }

  // Never hand back a zero-sheet workbook — Excel refuses to open it.
  if (sheetsAdded === 0) {
    addSheet("Report", ["Notice"], [["No data is available for this report yet. Take a scored test and try again."]]);
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
