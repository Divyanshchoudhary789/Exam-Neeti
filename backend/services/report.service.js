/**
 * Report Generation Service
 *
 * Generates PDF and Excel reports for students and admins.
 * Uses PDFKit for PDF and ExcelJS for Excel.
 * Reports are generated as buffers and returned in-memory (suitable for Render's ephemeral filesystem).
 * No disk writes — reports are streamed directly.
 */

const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const Report = require("../models/Report.model");
const { REPORT_FORMAT, REPORT_STATUS } = require("../config/constants");

// ─── PDF Helpers ─────────────────────────────────────────────────────────────

const createPDFReport = (reportDoc, data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve({ buffer, fileSize: buffer.length });
    });
    doc.on("error", reject);

    // Header
    doc
      .fontSize(20)
      .fillColor("#1a56db")
      .text("Exam Neeti", { align: "center" })
      .fontSize(12)
      .fillColor("#333333")
      .text(data.reportTitle || "Performance Report", { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(9)
      .fillColor("#888888")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "right" })
      .moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#1a56db").stroke();
    doc.moveDown(0.5);

    // Metadata
    if (data.meta) {
      doc.fontSize(10).fillColor("#333333");
      for (const [key, value] of Object.entries(data.meta)) {
        doc.text(`${key}: ${value}`);
      }
      doc.moveDown(1);
    }

    // Summary table helper
    const drawTable = (headers, rows) => {
      const colWidth = Math.floor(490 / headers.length);
      const rowHeight = 20;
      let x = 50;
      let y = doc.y;

      // Header row
      doc.fontSize(9).fillColor("#ffffff");
      for (const header of headers) {
        doc.rect(x, y, colWidth, rowHeight).fill("#1a56db");
        doc.fillColor("#ffffff").text(header, x + 4, y + 5, {
          width: colWidth - 8,
        });
        x += colWidth;
      }
      doc.moveDown(0);
      y += rowHeight;

      // Data rows
      let rowIndex = 0;
      for (const row of rows) {
        x = 50;
        const bgColor = rowIndex % 2 === 0 ? "#f8f9fa" : "#ffffff";
        doc.fontSize(8).fillColor("#333333");
        for (const cell of row) {
          doc.rect(x, y, colWidth, rowHeight).fill(bgColor);
          doc.fillColor("#333333").text(String(cell ?? "—"), x + 4, y + 5, {
            width: colWidth - 8,
          });
          x += colWidth;
        }
        y += rowHeight;
        rowIndex++;
        // New page if needed
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
      }
      doc.y = y + 10;
    };

    // Performance summary
    if (data.summary) {
      doc
        .fontSize(12)
        .fillColor("#1a56db")
        .text("Performance Summary")
        .moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.3);

      const summaryRows = Object.entries(data.summary).map(([k, v]) => [k, v]);
      drawTable(["Metric", "Value"], summaryRows);
      doc.moveDown(1);
    }

    // Subject breakdown
    if (data.subjectBreakdown && data.subjectBreakdown.length > 0) {
      doc
        .fontSize(12)
        .fillColor("#1a56db")
        .text("Subject Performance")
        .moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.3);

      drawTable(
        ["Subject", "Attempted", "Correct", "Accuracy%", "Marks", "Neg. Marks"],
        data.subjectBreakdown.map((s) => [
          s.subject,
          s.attempted,
          s.correct,
          `${s.accuracy}%`,
          s.marksObtained,
          s.negativeMarks,
        ])
      );
      doc.moveDown(1);
    }

    // Chapter breakdown
    if (data.chapterBreakdown && data.chapterBreakdown.length > 0) {
      doc
        .fontSize(12)
        .fillColor("#1a56db")
        .text("Chapter Performance")
        .moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.3);

      drawTable(
        ["Subject", "Chapter", "Attempted", "Correct", "Accuracy%", "Marks"],
        data.chapterBreakdown.map((c) => [
          c.subject,
          c.chapter,
          c.attempted,
          c.correct,
          `${c.accuracy}%`,
          c.marksObtained,
        ])
      );
      doc.moveDown(1);
    }

    // Recoverable marks
    if (data.recoverableMarks) {
      doc
        .fontSize(12)
        .fillColor("#1a56db")
        .text("Recoverable Marks Analysis")
        .moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(0.3);

      const rm = data.recoverableMarks;
      drawTable(
        ["Category", "Recoverable Marks"],
        [
          ["Incorrect Easy Questions", rm.incorrectEasyQuestions],
          ["Negative Marking Loss", rm.negativeLoss],
          ["Time Misallocation", rm.timeMisallocation],
          ["Low Accuracy Areas", rm.lowAccuracyAreas],
          ["Missed High-ROI Questions", rm.missedHighROI],
          ["Total Recoverable", rm.totalRecoverable],
        ]
      );
    }

    // Additional sections passed as raw tables
    if (data.sections) {
      for (const section of data.sections) {
        if (doc.y > 650) doc.addPage();
        doc
          .fontSize(12)
          .fillColor("#1a56db")
          .text(section.title)
          .moveDown(0.3);
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor("#cccccc")
          .stroke();
        doc.moveDown(0.3);
        drawTable(section.headers, section.rows);
        doc.moveDown(1);
      }
    }

    doc.end();
  });
};

// ─── Excel Helpers ────────────────────────────────────────────────────────────

const createExcelReport = async (reportDoc, data) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Exam Neeti";
  workbook.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A56DB" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const cellStyle = {
    alignment: { vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    },
  };

  const addSheet = (sheetName, headers, rows) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(headers).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });
    sheet.getRow(1).height = 24;

    for (const row of rows) {
      const addedRow = sheet.addRow(row);
      addedRow.eachCell((cell) => {
        Object.assign(cell, cellStyle);
      });
    }

    // Auto-fit columns
    headers.forEach((_, idx) => {
      const col = sheet.getColumn(idx + 1);
      let maxLen = (headers[idx] || "").length + 4;
      rows.forEach((row) => {
        const val = String(row[idx] ?? "");
        if (val.length + 2 > maxLen) maxLen = val.length + 2;
      });
      col.width = Math.min(maxLen, 40);
    });

    return sheet;
  };

  // Summary sheet
  if (data.summary) {
    addSheet(
      "Summary",
      ["Metric", "Value"],
      Object.entries(data.summary).map(([k, v]) => [k, v])
    );
  }

  // Subject sheet
  if (data.subjectBreakdown && data.subjectBreakdown.length > 0) {
    addSheet(
      "Subject Performance",
      ["Subject", "Total Qs", "Attempted", "Correct", "Incorrect", "Unattempted", "Marks Obtained", "Negative Marks", "Accuracy %", "Attempt Rate %"],
      data.subjectBreakdown.map((s) => [
        s.subject, s.totalQuestions, s.attempted, s.correct,
        s.incorrect, s.unattempted, s.marksObtained,
        s.negativeMarks, s.accuracy, s.attemptRate,
      ])
    );
  }

  // Chapter sheet
  if (data.chapterBreakdown && data.chapterBreakdown.length > 0) {
    addSheet(
      "Chapter Performance",
      ["Subject", "Chapter", "Total Qs", "Attempted", "Correct", "Incorrect", "Marks", "Accuracy %", "Attempt Rate %"],
      data.chapterBreakdown.map((c) => [
        c.subject, c.chapter, c.totalQuestions, c.attempted,
        c.correct, c.incorrect, c.marksObtained, c.accuracy, c.attemptRate,
      ])
    );
  }

  // Topic sheet
  if (data.topicAccuracy && data.topicAccuracy.length > 0) {
    addSheet(
      "Topic Performance",
      ["Subject", "Chapter", "Topic", "Total Qs", "Attempted", "Correct", "Accuracy %", "Weak", "Strong"],
      data.topicAccuracy.map((t) => [
        t.subject, t.chapter, t.topic, t.totalQuestions, t.attempted,
        t.correct, t.accuracy, t.isWeak ? "Yes" : "No", t.isStrong ? "Yes" : "No",
      ])
    );
  }

  // Recoverable marks sheet
  if (data.recoverableMarks) {
    const rm = data.recoverableMarks;
    addSheet(
      "Recoverable Marks",
      ["Category", "Recoverable Marks"],
      [
        ["Incorrect Easy Questions", rm.incorrectEasyQuestions],
        ["Negative Marking Loss", rm.negativeLoss],
        ["Time Misallocation", rm.timeMisallocation],
        ["Low Accuracy Areas", rm.lowAccuracyAreas],
        ["Missed High-ROI Questions", rm.missedHighROI],
        ["Total Recoverable", rm.totalRecoverable],
      ]
    );
  }

  // Time analysis sheet
  if (data.questionTimings && data.questionTimings.length > 0) {
    addSheet(
      "Time Analysis",
      ["Slot", "Subject", "Difficulty", "Time (s)", "Attempted", "Correct"],
      data.questionTimings.map((q) => [
        q.slotPosition, q.subject, q.difficulty,
        q.timeSpentSeconds, q.isAttempted ? "Yes" : "No",
        q.isCorrect === null ? "N/A" : q.isCorrect ? "Yes" : "No",
      ])
    );
  }

  // Extra sections
  if (data.sections) {
    for (const section of data.sections) {
      addSheet(section.title, section.headers, section.rows);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, fileSize: buffer.length };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a report buffer (PDF or Excel) and updates the Report document.
 * Stores the buffer in the Report document temporarily (for download within the request lifecycle).
 *
 * @param {Object} reportDoc  — Report mongoose document
 * @param {Object} data       — Structured data for the report
 * @returns {Object} { reportDoc, buffer }
 */
const generateReport = async (reportDoc, data) => {
  try {
    let result;
    if (reportDoc.format === REPORT_FORMAT.PDF) {
      result = await createPDFReport(reportDoc, data);
    } else {
      result = await createExcelReport(reportDoc, data);
    }

    reportDoc.fileSize   = result.fileSize;
    reportDoc.status     = REPORT_STATUS.READY;
    reportDoc.generatedAt = new Date();
    await reportDoc.save();

    return { reportDoc, buffer: result.buffer };
  } catch (err) {
    reportDoc.status = REPORT_STATUS.FAILED;
    await reportDoc.save();
    throw err;
  }
};

module.exports = { generateReport };
