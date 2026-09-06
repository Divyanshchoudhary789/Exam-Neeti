/**
 * sprintPaper.service.js
 *
 * Builds a downloadable question paper for a sprint — PDF or Word (.docx) —
 * with every slot in blueprint order. Slots with admin-pinned questions render
 * the full question (text, formulas, images, options, answer, solution); slots
 * with no pinned question render a clearly-marked "not fixed" placeholder that
 * still shows the slot's subject / chapter / topic / difficulty / marks.
 *
 * Math:   pure Node via mathTypeset.service.js (MathJax → SVG for PDF,
 *         MathJax → OMML for Word — real editable equations). No LibreOffice.
 * Images: fetched from Cloudinary server-side and embedded.
 */

"use strict";

const path = require("path");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

// DejaVu Sans — full Unicode coverage (Greek, sub/superscripts, combining
// accents, arrows, math operators) that the pdfkit built-in Helvetica lacks.
const FONT_DIR = path.dirname(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"));
const FONT_FILES = {
  r: path.join(FONT_DIR, "DejaVuSans.ttf"),
  b: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"),
  i: path.join(FONT_DIR, "DejaVuSans-Oblique.ttf"),
};
const {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle, HeadingLevel,
} = require("docx");
const { latexToSvg, latexToOmmlComponent, latexToText, splitTextMath } = require("./mathTypeset.service");

// ─── image helpers ───────────────────────────────────────────────────────────

/** Minimal image dimension + type sniffer (PNG / JPEG / GIF). */
function sniffImage(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { type: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length - 8) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpg", height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
    return { type: "jpg", width: 0, height: 0 };
  }
  return null;
}

/** Fetch one image URL → { buffer, type, width, height } or null (never throws). */
async function fetchImage(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxContentLength: 12 * 1024 * 1024,
    });
    const buffer = Buffer.from(res.data);
    const meta = sniffImage(buffer) || { type: "png", width: 0, height: 0 };
    return { buffer, ...meta };
  } catch (err) {
    console.error(`[sprintPaper] image fetch failed (${url}): ${err.message}`);
    return null;
  }
}

/** Display box for an image, capped to maxW keeping aspect ratio. */
function displaySize(meta, maxW = 360, maxH = 260) {
  const w = meta && meta.width > 0 ? meta.width : maxW;
  const h = meta && meta.height > 0 ? meta.height : Math.round(maxW * 0.62);
  let scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

// ─── question collection ─────────────────────────────────────────────────────

/**
 * One query for every pinned question across all slots, then pre-fetch every
 * image referenced. Returns { bySlot: Map<position, EnrichedQuestion[]> }.
 */
async function collectSlotQuestions(sprint, QuestionModel) {
  const slots = [...(sprint.patternSlots || [])].sort((a, b) => a.position - b.position);
  const allIds = [...new Set(slots.flatMap((s) => (s.pinnedQuestionIds || []).map(String)))];

  let byId = new Map();
  if (allIds.length > 0 && QuestionModel) {
    const docs = await QuestionModel.find({ _id: { $in: allIds } }).lean();
    byId = new Map(docs.map((d) => [String(d._id), d]));
  }

  // Collect + fetch every image once (deduped by URL).
  const urls = new Set();
  const addUrl = (u) => u && urls.add(u);
  for (const q of byId.values()) {
    addUrl(q.questionImage?.url);
    addUrl(q.solution?.image?.url);
    (q.solution?.images || []).forEach((i) => addUrl(i?.url));
    (q.options || []).forEach((o) => addUrl(o?.image?.url));
  }
  const imgEntries = await Promise.all([...urls].map(async (u) => [u, await fetchImage(u)]));
  const imgByUrl = new Map(imgEntries);

  const bySlot = new Map();
  for (const slot of slots) {
    const questions = (slot.pinnedQuestionIds || [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((q) => ({
        ...q,
        _questionImg: imgByUrl.get(q.questionImage?.url) || null,
        _solutionImg: imgByUrl.get(q.solution?.image?.url) || null,
        _solutionImgs: (q.solution?.images || []).map((i) => imgByUrl.get(i?.url)).filter(Boolean),
        _optionImgs: Object.fromEntries(
          (q.options || []).map((o) => [o.key, imgByUrl.get(o?.image?.url) || null])
        ),
      }));
    bySlot.set(slot.position, questions);
  }

  return { slots, bySlot };
}

// ─── slot header text ────────────────────────────────────────────────────────

function slotSpec(slot) {
  const bits = [slot.subject];
  if (slot.chapter) bits.push(slot.chapter);
  if (slot.topic) bits.push(slot.topic);
  if (slot.difficulty) bits.push(slot.difficulty);
  return bits.join(" · ");
}
function slotMarks(slot) {
  return `+${slot.marks ?? 0} / -${slot.negativeMarks ?? 0}`;
}

// ═════════════════════════ PDF ═══════════════════════════════════════════════

function buildPdf(sprint, collected) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4", bufferPages: true, autoFirstPage: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("body", FONT_FILES.r);
    doc.registerFont("body-b", FONT_FILES.b);
    doc.registerFont("body-i", FONT_FILES.i);

    const M = doc.page.margins;
    const LEFT = M.left;
    const RIGHT = doc.page.width - M.right;
    const TOP = M.top;
    const BOTTOM = doc.page.height - M.bottom;
    const CONTENT_W = RIGHT - LEFT;

    // Single explicit vertical cursor — pdfkit's own doc.y is only trusted
    // right after its own text() calls; everything here drives `cur`.
    let cur = TOP;
    const pageBreak = () => { doc.addPage(); cur = TOP; };
    const need = (h) => { if (cur + h > BOTTOM) pageBreak(); };
    const gap = (h) => { cur += h; if (cur > BOTTOM) pageBreak(); };

    const FONT = { r: "body", b: "body-b", i: "body-i" };

    /** One math SVG as a standalone left-aligned block, scaled to fit the column. */
    const drawMathBlock = (latex, indent, size) => {
      const r = latexToSvg(latex, true);
      if (!r || !r.ok || !r.svg) {
        doc.font(FONT.i).fontSize(size - 0.5).fillColor("#b91c1c")
          .text(latex, LEFT + indent, cur, { width: CONTENT_W - indent });
        cur = doc.y + 3;
        return;
      }
      const exPt = size * 0.52;
      let w = r.widthEx * exPt;
      let h = r.heightEx * exPt;
      const maxW = CONTENT_W - indent - 4;
      if (w > maxW) { const k = maxW / w; w *= k; h *= k; }
      // Bake explicit pt dimensions onto the SVG so svg-to-pdfkit renders it at
      // exactly that size (passing width/height as options while the SVG's own
      // attrs are in `ex` makes it mis-scale and overflow its row).
      const sized = r.svg
        .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${w.toFixed(2)}pt"`)
        .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${h.toFixed(2)}pt"`)
        .replace(/(<svg\b[^>]*?)\sstyle="[^"]*"/, "$1");
      need(h + 14);
      try { SVGtoPDF(doc, sized, LEFT + indent, cur + 6); }
      catch { /* skip a bad glyph, never abort the paper */ }
      cur += h + 14;
    };

    /**
     * Lay out a run of {type:text|math} segments as wrapped prose. Simple math
     * (single vars, greek, sub/superscripts, vectors, simple fractions) is
     * converted to Unicode and flows inline with the text — pdfkit handles the
     * wrapping. Genuinely 2-D math (matrices, deep nested fractions) drops onto
     * its own rendered block row. `indent` px from LEFT. Advances `cur`.
     */
    const flow = (segments, { indent = 0, size = 10.5, color = "#1f2937", bold = false, italic = false } = {}) => {
      const x0 = LEFT + indent;
      const width = RIGHT - x0;
      const baseFont = italic ? FONT.i : bold ? FONT.b : FONT.r;

      // Build a list of runs: { text } prose chunks and { block } standalone math.
      const runs = [];
      let buf = "";
      const flushBuf = () => { if (buf.trim()) runs.push({ text: buf }); buf = ""; };
      for (const seg of segments) {
        if (seg.type === "text") { buf += String(seg.value); continue; }
        const conv = latexToText(seg.value);
        if (!seg.display && conv.plain && conv.text) {
          // inline as Unicode, padded so it doesn't glue to neighbouring words
          buf += (buf && !/\s$/.test(buf) ? " " : "") + conv.text + " ";
        } else {
          flushBuf();
          runs.push({ block: seg.value });
        }
      }
      flushBuf();

      for (const run of runs) {
        if (run.block) { drawMathBlock(run.block, indent, size); continue; }
        // repair leaked escapes / stray delimiters, keep real breaks as paragraphs
        const cleaned = run.text
          .replace(/\\r\\n|\\n|\\r/g, "\n")     // literal "\n" that leaked into stored text
          .replace(/\\t/g, "  ")
          .replace(/\\[()[\]]/g, "")            // stray \( \) \[ \] splitTextMath didn't pair
          .replace(/[ \t]+/g, " ");
        const paras = cleaned.split(/\n+/).map((p) => p.trim()).filter(Boolean);
        for (const para of paras) {
          doc.font(baseFont).fontSize(size).fillColor(color);
          need(size * 1.7);                 // room for at least the first line; pdfkit paginates the rest
          doc.text(para, x0, cur, { width, lineGap: 1.5 });
          cur = doc.y + 1.5;
        }
      }
      doc.x = LEFT;
    };

    const drawImage = (img, indent = 0, maxH = 230) => {
      if (!img?.buffer) return;
      const { width, height } = displaySize(img, CONTENT_W - indent - 6, maxH);
      need(height + 10);
      try {
        doc.image(img.buffer, LEFT + indent, cur + 3, { width, height });
        cur += height + 10;
      } catch {
        doc.font(FONT.i).fontSize(8).fillColor("#b91c1c").text("[image could not be embedded]", LEFT + indent, cur);
        cur += 12;
      }
    };

    const rule = (light = true) => {
      doc.moveTo(LEFT, cur).lineTo(RIGHT, cur).lineWidth(0.6).strokeColor(light ? "#eef1f5" : "#d1d5db").stroke();
      cur += light ? 8 : 12;
    };

    // ── Title block ──
    doc.font(FONT.b).fontSize(19).fillColor("#4338ca").text("Exam Neeti — Sprint Question Paper", LEFT, cur, { width: CONTENT_W, align: "center" });
    cur = doc.y + 4;
    doc.font(FONT.b).fontSize(13).fillColor("#111827").text(sprint.name || "Sprint", LEFT, cur, { width: CONTENT_W, align: "center" });
    cur = doc.y + 3;
    doc.font(FONT.r).fontSize(8.5).fillColor("#6b7280").text(
      [
        sprint.classLevel ? (sprint.classLevel === "dropper" ? "Dropper batch" : `Class ${sprint.classLevel}`) : null,
        `${(sprint.patternSlots || []).length} slots`,
        `Status: ${sprint.status}`,
        `Generated ${new Date().toLocaleString("en-IN")}`,
      ].filter(Boolean).join("    •    "),
      LEFT, cur, { width: CONTENT_W, align: "center" }
    );
    cur = doc.y + 10;
    rule(false);
    gap(4);

    // ── Slots ──
    for (const slot of collected.slots) {
      const questions = collected.bySlot.get(slot.position) || [];
      need(46);

      // slot header
      doc.font(FONT.b).fontSize(11).fillColor("#111827").text(`Q${slot.position}.`, LEFT, cur, { lineBreak: false });
      const qNumW = doc.widthOfString(`Q${slot.position}.`);
      doc.font(FONT.r).fontSize(8.5).fillColor("#6b7280")
        .text(`  ${slotSpec(slot)}   ·   ${slotMarks(slot)}`, LEFT + qNumW + 4, cur + 2, { lineBreak: false });
      cur += 17;

      if (questions.length === 0) {
        flow([{ type: "text", value: "Question not fixed for this slot — the engine auto-selects a matching question at exam time." }],
          { indent: 16, size: 9.5, color: "#92400e" });
        gap(6);
        rule(true);
        continue;
      }

      questions.forEach((q, qi) => {
        if (questions.length > 1) {
          doc.font(FONT.b).fontSize(8).fillColor("#6366f1").text(`Pinned option ${qi + 1} of ${questions.length}`, LEFT + 16, cur, { lineBreak: false });
          cur += 12;
        }
        flow(splitTextMath(q.text), { indent: 16, size: 10, color: "#1f2937" });
        gap(2);
        if (q._questionImg) drawImage(q._questionImg, 16);

        (q.options || []).forEach((opt) => {
          const correct = String(opt.key).toUpperCase() === String(q.correctAnswer).toUpperCase();
          flow(
            [{ type: "text", value: `(${opt.key})  ` }, ...splitTextMath(opt.text || (opt.image?.url ? "[see image]" : "—"))],
            { indent: 28, size: 9.5, color: correct ? "#047857" : "#374151", bold: correct }
          );
          const oi = q._optionImgs?.[opt.key];
          if (oi) drawImage(oi, 40, 150);
        });

        gap(3);
        need(14);
        doc.font(FONT.b).fontSize(9).fillColor("#047857").text(`Answer:  ${String(q.correctAnswer || "—").toUpperCase()}`, LEFT + 16, cur, { lineBreak: false });
        cur += 14;

        const solText = q.solution?.text || "";
        if (solText || q._solutionImg || (q._solutionImgs || []).length) {
          need(14);
          doc.font(FONT.b).fontSize(8.5).fillColor("#4338ca").text("Solution", LEFT + 16, cur, { lineBreak: false });
          cur += 12;
          if (solText) flow(splitTextMath(solText), { indent: 16, size: 9, color: "#4b5563" });
          if (q._solutionImg) drawImage(q._solutionImg, 16);
          (q._solutionImgs || []).forEach((im) => drawImage(im, 16));
        }
        if (qi < questions.length - 1) gap(6);
      });

      gap(8);
      rule(true);
    }

    // page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font(FONT.r).fontSize(8).fillColor("#9ca3af")
        .text(`Page ${i - range.start + 1} of ${range.count}`, LEFT, BOTTOM + 14, { width: CONTENT_W, align: "center", lineBreak: false });
    }

    doc.end();
  });
}

// ═════════════════════════ DOCX ═════════════════════════════════════════════

function richRuns(text, { bold = false, color = "333333", size = 20 } = {}) {
  const runs = [];
  for (const seg of splitTextMath(text)) {
    if (seg.type === "text") {
      // preserve hard line breaks (real, or literal "\n" that leaked into data)
      const lines = String(seg.value)
        .replace(/\\r\\n|\\n|\\r/g, "\n")
        .replace(/\\t/g, "  ")
        .replace(/\\[()[\]]/g, "")
        .split("\n");
      lines.forEach((ln, i) => {
        if (i > 0) runs.push(new TextRun({ text: "", break: 1 }));
        if (ln) runs.push(new TextRun({ text: ln, bold, color, size }));
      });
    } else {
      const comp = latexToOmmlComponent(seg.value);
      if (comp) runs.push(comp);
      else runs.push(new TextRun({ text: `${seg.value}`, italics: true, color: "B91C1C", size }));
    }
  }
  return runs;
}

function docxImage(img, maxW = 360) {
  if (!img?.buffer) return null;
  const { width, height } = displaySize(img, maxW, 260);
  try {
    return new Paragraph({
      children: [new ImageRun({
        type: img.type === "jpg" ? "jpg" : img.type === "gif" ? "gif" : "png",
        data: img.buffer,
        transformation: { width, height },
      })],
      spacing: { before: 60, after: 60 },
    });
  } catch {
    return new Paragraph({ children: [new TextRun({ text: "[image could not be embedded]", color: "B91C1C", size: 16 })] });
  }
}

async function buildDocx(sprint, collected) {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Exam Neeti — Sprint Question Paper", bold: true, size: 34, color: "4338CA" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: sprint.name || "Sprint", bold: true, size: 26 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 8 } },
      children: [new TextRun({
        size: 16, color: "6B7280",
        text: [
          sprint.classLevel ? (sprint.classLevel === "dropper" ? "Dropper batch" : `Class ${sprint.classLevel}`) : null,
          `${(sprint.patternSlots || []).length} slots`,
          `Status: ${sprint.status}`,
          `Generated ${new Date().toLocaleString("en-IN")}`,
        ].filter(Boolean).join("   •   "),
      })],
    })
  );

  for (const slot of collected.slots) {
    const questions = collected.bySlot.get(slot.position) || [];

    children.push(new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({ text: `Q${slot.position}.  `, bold: true, size: 22 }),
        new TextRun({ text: `${slotSpec(slot)}    [${slotMarks(slot)}]`, size: 18, color: "4B5563" }),
      ],
    }));

    if (questions.length === 0) {
      children.push(new Paragraph({
        indent: { left: 240 },
        spacing: { after: 160 },
        children: [new TextRun({
          italics: true, color: "92400E", size: 19,
          text: "Question not fixed for this slot. At exam time the engine auto-selects a question matching the criteria above.",
        })],
      }));
      continue;
    }

    questions.forEach((q, qi) => {
      if (questions.length > 1) {
        children.push(new Paragraph({
          indent: { left: 240 },
          children: [new TextRun({ text: `Pinned option ${qi + 1} of ${questions.length}`, bold: true, color: "6366F1", size: 16 })],
        }));
      }
      children.push(new Paragraph({ indent: { left: 240 }, spacing: { after: 40 }, children: richRuns(q.text, { size: 20, color: "1F2937" }) }));
      const qImg = docxImage(q._questionImg, 380);
      if (qImg) { qImg.indent = { left: 240 }; children.push(qImg); }

      (q.options || []).forEach((opt) => {
        const correct = String(opt.key).toUpperCase() === String(q.correctAnswer).toUpperCase();
        children.push(new Paragraph({
          indent: { left: 480 },
          spacing: { after: 20 },
          children: [
            new TextRun({ text: `(${opt.key})  `, bold: true, color: correct ? "047857" : "374151", size: 19 }),
            ...richRuns(opt.text || (opt.image?.url ? "[see image]" : ""), { size: 19, color: correct ? "047857" : "374151", bold: correct }),
          ],
        }));
        const oi = docxImage(q._optionImgs?.[opt.key], 260);
        if (oi) { oi.indent = { left: 560 }; children.push(oi); }
      });

      children.push(new Paragraph({
        indent: { left: 240 },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: `Answer: ${String(q.correctAnswer || "—").toUpperCase()}`, bold: true, color: "047857", size: 18 })],
      }));

      const solText = q.solution?.text || "";
      if (solText || q._solutionImg || (q._solutionImgs || []).length) {
        children.push(new Paragraph({
          indent: { left: 240 },
          children: [new TextRun({ text: "Solution:", bold: true, color: "4338CA", size: 17 })],
        }));
        if (solText) children.push(new Paragraph({ indent: { left: 240 }, spacing: { after: 40 }, children: richRuns(solText, { size: 18, color: "4B5563" }) }));
        const sImg = docxImage(q._solutionImg, 380);
        if (sImg) { sImg.indent = { left: 240 }; children.push(sImg); }
        (q._solutionImgs || []).forEach((im) => {
          const p = docxImage(im, 380);
          if (p) { p.indent = { left: 240 }; children.push(p); }
        });
      }
    });
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function generateSprintPaper(sprint, QuestionModel, format) {
  const collected = await collectSlotQuestions(sprint, QuestionModel);
  const safeName = (sprint.name || "sprint").replace(/[^\w\-]+/g, "_").slice(0, 60);

  if (format === "docx") {
    return {
      buffer: await buildDocx(sprint, collected),
      filename: `${safeName}_question_paper.docx`,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  return {
    buffer: await buildPdf(sprint, collected),
    filename: `${safeName}_question_paper.pdf`,
    contentType: "application/pdf",
  };
}

module.exports = { generateSprintPaper };
