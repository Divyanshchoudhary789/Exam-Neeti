/**
 * Student Performance Report — PDF
 *
 * Renders the same data the "Student Performance Profile" modal shows into a
 * branded, multi-section A4 PDF (PDFKit, in-memory Buffer). Self-contained —
 * takes the plain profile object produced by
 * dashboard.controller.assembleStudentPerformanceProfile().
 */

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

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
  good: "#059669",
  warn: "#d97706",
  bad: "#dc2626",
};

const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

const PAGE = { size: "A4", margin: 46 };
const PW = 595.28;
const PH = 841.89;
const LEFT = PAGE.margin;
const RIGHT = PW - PAGE.margin;
const WIDTH = RIGHT - LEFT;
const BOTTOM = PH - PAGE.margin - 22;

const fmtDate = (d) =>
  d ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d)) : "—";
const fmtDateTime = (d = new Date()) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(d));
const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : String(v));
const pct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(1)}%`);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const CONSISTENCY = {
  very_consistent: "Very consistent",
  consistent: "Consistent",
  variable: "Variable",
  highly_variable: "Highly variable",
  insufficient_data: "Not enough tests",
};

function safeName(s) {
  return String(s || "student").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "student";
}

/**
 * @param {object} profile  from assembleStudentPerformanceProfile()
 * @param {string} scopeLabel  human label for the scope ("All sprints" | sprint name)
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
function buildStudentReportPDF(profile, scopeLabel) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve({
      buffer: Buffer.concat(chunks),
      filename: `performance_report_${safeName(profile.student?.name)}_${Date.now()}.pdf`,
    }));
    doc.on("error", reject);

    doc.addPage();

    /* ── Header band ─────────────────────────────────────────────────── */
    const bandH = 72;
    doc.rect(0, 0, PW, bandH).fill(BRAND.indigo);
    if (LOGO_EXISTS) {
      doc.roundedRect(LEFT, 15, 42, 42, 8).fill("#ffffff");
      try { doc.image(LOGO_PATH, LEFT + 4, 19, { fit: [34, 34] }); } catch { /* wordmark still brands it */ }
    }
    const tx = LOGO_EXISTS ? LEFT + 56 : LEFT;
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text(BRAND.name, tx, 18);
    doc.font("Helvetica").fontSize(8).fillColor("#e0e7ff")
      .text(BRAND.tagline.toUpperCase(), tx, 39, { characterSpacing: 1.4 });
    doc.fillColor("#c7d2fe").fontSize(7.5)
      .text(fmtDateTime(), LEFT, 28, { width: WIDTH, align: "right" })
      .text("CONFIDENTIAL", LEFT, 41, { width: WIDTH, align: "right", characterSpacing: 1 });

    doc.y = bandH + 20;

    /* ── Title + student meta ───────────────────────────────────────── */
    const s = profile.student || {};
    doc.fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(18)
      .text("Student Performance Report", LEFT, doc.y, { width: WIDTH });
    doc.moveDown(0.4);

    const meta = [
      ["Student", s.name || "—"],
      ["Email", s.email || "—"],
      ["Batch", s.batch?.name || "—"],
      ["Enrolled", fmtDate(s.createdAt)],
      ["Report scope", scopeLabel],
      ["Status", s.isActive === false ? "Inactive" : "Active"],
    ];
    const rowH = 15;
    const boxH = meta.length * rowH + 12;
    doc.roundedRect(LEFT, doc.y, WIDTH, boxH, 6).fill(BRAND.zebra);
    doc.roundedRect(LEFT, doc.y, WIDTH, boxH, 6).strokeColor(BRAND.line).lineWidth(1).stroke();
    let ry = doc.y + 7;
    for (const [k, v] of meta) {
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BRAND.inkSoft).text(k, LEFT + 12, ry, { width: 130 });
      doc.font("Helvetica").fontSize(8.5).fillColor(BRAND.ink).text(String(v), LEFT + 150, ry, { width: WIDTH - 162 });
      ry += rowH;
    }
    doc.y += boxH + 18;

    /* ── Section helpers ────────────────────────────────────────────── */
    const heading = (title) => {
      if (doc.y > BOTTOM - 70) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.indigoDark).text(title, LEFT, doc.y);
      doc.moveDown(0.2);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(1.3).strokeColor(BRAND.indigo).stroke();
      doc.moveDown(0.55);
    };

    const kpiGrid = (items) => {
      const perRow = 3;
      const gap = 10;
      const cw = (WIDTH - gap * (perRow - 1)) / perRow;
      const ch = 46;
      const rows = Math.ceil(items.length / perRow);
      let rowY = doc.y;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < perRow; c++) {
          const it = items[r * perRow + c];
          if (!it) continue;
          const x = LEFT + c * (cw + gap);
          doc.roundedRect(x, rowY, cw, ch, 6).fill(BRAND.zebra);
          doc.roundedRect(x, rowY, cw, ch, 6).strokeColor(BRAND.line).lineWidth(0.8).stroke();
          doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND.inkFaint)
            .text(it.label.toUpperCase(), x + 8, rowY + 7, { width: cw - 16, characterSpacing: 0.5, lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(14).fillColor(it.color || BRAND.ink)
            .text(String(it.value), x + 8, rowY + 17, { width: cw - 16, lineBreak: false });
          if (it.sub) doc.font("Helvetica").fontSize(6.5).fillColor(BRAND.inkFaint)
            .text(it.sub, x + 8, rowY + 35, { width: cw - 16, lineBreak: false });
        }
        rowY += ch + gap;
      }
      doc.y = rowY + 6;
    };

    const table = (headers, rows, widths) => {
      const totalW = widths.reduce((a, b) => a + b, 0);
      const scaled = widths.map((w) => (w / totalW) * WIDTH);
      const padX = 5, padY = 4;

      const rowHeight = (vals, font, size) => {
        doc.font(font).fontSize(size);
        let max = 0;
        vals.forEach((v, i) => {
          const h = doc.heightOfString(String(v ?? "—"), { width: scaled[i] - padX * 2 });
          if (h > max) max = h;
        });
        return max + padY * 2;
      };
      const headerRow = () => {
        const h = rowHeight(headers, "Helvetica-Bold", 8);
        const y = doc.y;
        doc.rect(LEFT, y, WIDTH, h).fill(BRAND.indigo);
        let x = LEFT;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        headers.forEach((head, i) => {
          doc.text(String(head), x + padX, y + padY, { width: scaled[i] - padX * 2, lineBreak: false });
          x += scaled[i];
        });
        doc.y = y + h;
      };
      headerRow();
      rows.forEach((row, ri) => {
        const h = rowHeight(row, "Helvetica", 7.5);
        if (doc.y + h > BOTTOM) { doc.addPage(); headerRow(); }
        const y = doc.y;
        if (ri % 2 === 0) doc.rect(LEFT, y, WIDTH, h).fill(BRAND.zebra);
        doc.moveTo(LEFT, y + h).lineTo(RIGHT, y + h).lineWidth(0.5).strokeColor(BRAND.line).stroke();
        let x = LEFT;
        row.forEach((cell, ci) => {
          const isColored = cell && typeof cell === "object" && "text" in cell;
          doc.font("Helvetica").fontSize(7.5).fillColor(isColored ? cell.color : BRAND.ink)
            .text(String(isColored ? cell.text : (cell ?? "—")), x + padX, y + padY, { width: scaled[ci] - padX * 2 });
          x += scaled[ci];
        });
        doc.y = y + h;
      });
      doc.moveDown(1);
    };

    const accCell = (v) => ({ text: pct(v), color: v >= 70 ? BRAND.good : v >= 40 ? BRAND.warn : BRAND.bad });

    const note = (text) => {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(BRAND.inkFaint).text(text, LEFT, doc.y, { width: WIDTH });
      doc.moveDown(1);
    };

    /* ── No data ───────────────────────────────────────────────────── */
    if (!profile.summary) {
      heading("Overall Summary");
      note(`This student has no submitted exams${scopeLabel === "All sprints" ? "" : " in this sprint"} yet, so there is nothing to report.`);
      finishFooter(doc);
      doc.end();
      return;
    }

    /* ── Overall summary ───────────────────────────────────────────── */
    const sum = profile.summary;
    heading("Overall Summary");
    kpiGrid([
      { label: "Tests taken", value: sum.totalTests, sub: `${sum.totalAttempts} attempts` },
      { label: "Avg score", value: sum.averageScore, sub: `high ${sum.highestScore} / low ${sum.lowestScore}`, color: BRAND.indigo },
      { label: "Avg percentage", value: pct(sum.averagePercentage), color: BRAND.indigo },
      { label: "Avg accuracy", value: pct(sum.averageAccuracy), sub: `attempt rate ${pct(sum.averageAttemptRate)}`, color: BRAND.good },
      { label: "Negative marks", value: `-${Math.abs(sum.totalNegativeMarks)}`, sub: "lost to wrong answers", color: BRAND.bad },
      { label: "Recoverable marks", value: sum.totalRecoverableMarks, sub: "within reach", color: BRAND.warn },
    ]);
    note(
      `Consistency: ${CONSISTENCY[sum.consistency.interpretation] || sum.consistency.interpretation} ` +
      `(score s.d. ${sum.consistency.scoreStdDev}, accuracy s.d. ${sum.consistency.accuracyStdDev}%).  ` +
      `Active ${fmtDate(sum.firstAttemptAt)} to ${fmtDate(sum.lastAttemptAt)}.`
    );

    /* ── Per-sprint ────────────────────────────────────────────────── */
    if (profile.sprints?.length) {
      heading("Performance by Sprint");
      table(
        ["Sprint", "Tests", "Avg score", "Avg %", "Accuracy", "Negative", "Recoverable", "Last attempt"],
        profile.sprints.map((sp) => [
          sp.name, num(sp.tests), num(sp.averageScore), pct(sp.averagePercentage),
          accCell(sp.averageAccuracy), `-${Math.abs(sp.totalNegativeMarks)}`,
          num(sp.totalRecoverableMarks), fmtDate(sp.lastAttemptAt),
        ]),
        [26, 8, 11, 10, 11, 11, 13, 15]
      );
    }

    /* ── Subjects ──────────────────────────────────────────────────── */
    if (profile.subjectPerformance?.length) {
      heading("Subject Breakdown");
      table(
        ["Subject", "Questions", "Attempted", "Correct", "Incorrect", "Accuracy", "Attempt %", "Marks", "Negative"],
        profile.subjectPerformance.map((sub) => [
          cap(sub.subject), num(sub.totalQuestions), num(sub.attempted), num(sub.correct),
          num(sub.incorrect), accCell(sub.accuracy), pct(sub.attemptRate),
          num(sub.marksObtained), `-${Math.abs(sub.negativeMarks)}`,
        ]),
        [18, 11, 11, 9, 10, 11, 11, 9, 10]
      );
    }

    /* ── Difficulty ────────────────────────────────────────────────── */
    if (profile.difficultyPerformance?.length) {
      heading("Accuracy by Difficulty");
      table(
        ["Difficulty", "Questions", "Attempted", "Correct", "Accuracy", "Attempt %", "Avg time"],
        profile.difficultyPerformance.map((d) => [
          cap(d.difficulty), num(d.totalQuestions), num(d.attempted), num(d.correct),
          accCell(d.accuracy), pct(d.attemptRate), `${d.avgTimeSeconds}s`,
        ]),
        [16, 14, 14, 12, 14, 14, 12]
      );
    }

    /* ── Weak / strong topics ──────────────────────────────────────── */
    const weak = profile.topicPerformance?.weak || [];
    const strong = profile.topicPerformance?.strong || [];
    if (weak.length || strong.length) {
      heading("Topic Strengths & Weaknesses");
      if (weak.length) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.bad)
          .text(`Weak topics — accuracy below 40%  (${weak.length})`, LEFT, doc.y);
        doc.moveDown(0.4);
        table(
          ["Topic", "Subject", "Chapter", "Correct / Attempted", "Accuracy"],
          weak.slice(0, 25).map((t) => [
            t.topic, cap(t.subject), t.chapter, `${t.correct} / ${t.attempted}`, accCell(t.accuracy),
          ]),
          [28, 14, 24, 18, 12]
        );
      }
      if (strong.length) {
        if (doc.y > BOTTOM - 90) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.good)
          .text(`Strong topics — accuracy 80% or above  (${strong.length})`, LEFT, doc.y);
        doc.moveDown(0.4);
        table(
          ["Topic", "Subject", "Chapter", "Correct / Attempted", "Accuracy"],
          strong.slice(0, 25).map((t) => [
            t.topic, cap(t.subject), t.chapter, `${t.correct} / ${t.attempted}`, accCell(t.accuracy),
          ]),
          [28, 14, 24, 18, 12]
        );
      }
    }

    /* ── Error analysis + coverage ─────────────────────────────────── */
    const e = profile.errorAnalysis;
    if (e && e.total > 0) {
      heading("Error Analysis");
      table(
        ["Type", "Count", "Share"],
        [
          ["Silly mistakes", num(e.silly), pct((e.silly / e.total) * 100)],
          ["Concept errors", num(e.concept), pct((e.concept / e.total) * 100)],
          ["Rushed guesses", num(e.guess), pct((e.guess / e.total) * 100)],
          ["Total flagged", num(e.total), "100.0%"],
        ],
        [40, 15, 15]
      );
    }
    if (profile.coverage) {
      const c = profile.coverage;
      heading("Syllabus Coverage");
      table(
        ["Syllabus", "Concept", "Weighted", "Revision", "Topics touched", "Chapters"],
        [[
          pct(c.syllabusCoverage), pct(c.conceptCoverage), pct(c.weightedCoverage), pct(c.revisionCoverage),
          `${c.coveredTopics ?? 0} / ${c.totalTopics ?? 0}`, num(c.coveredChapters ?? 0),
        ]],
        [14, 14, 14, 14, 20, 12]
      );
    }

    /* ── Attempt history ───────────────────────────────────────────── */
    if (profile.timeline?.length) {
      heading(`Exam Attempt History  (${profile.timeline.length})`);
      table(
        ["Date", "Exam", "Sprint", "Score", "%", "Accuracy", "Negative", "vs prev"],
        [...profile.timeline].reverse().map((t) => [
          fmtDate(t.attemptedAt),
          t.attemptNumber > 1 ? `${t.examTitle} (att ${t.attemptNumber})` : t.examTitle,
          t.sprintName || "—",
          `${t.score}/${t.totalMarks}`, pct(t.percentage), accCell(t.accuracy),
          `-${Math.abs(t.negativeMarks)}`,
          t.improvementFromPrev === 0 ? "—" : { text: `${t.improvementFromPrev > 0 ? "+" : ""}${t.improvementFromPrev}`, color: t.improvementFromPrev > 0 ? BRAND.good : BRAND.bad },
        ]),
        [13, 26, 18, 12, 9, 11, 11, 10]
      );
    }

    finishFooter(doc);
    doc.end();
  });
}

/** Page footer + numbering across all buffered pages. */
function finishFooter(doc) {
  const range = doc.bufferedPageRange();
  const stamp = fmtDateTime();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing near the page edge would otherwise make PDFKit spill onto a new
    // blank page — drop the bottom margin for the duration of the footer write.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const fy = PH - PAGE.margin + 2;
    doc.font("Helvetica").fontSize(7).fillColor(BRAND.inkFaint);
    doc.text(`${BRAND.name} — generated ${stamp}`, LEFT, fy, { width: WIDTH / 2, lineBreak: false });
    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`,
      LEFT + WIDTH / 2, fy, { width: WIDTH / 2, align: "right", lineBreak: false }
    );

    doc.page.margins.bottom = savedBottom;
  }
}

module.exports = { buildStudentReportPDF };
