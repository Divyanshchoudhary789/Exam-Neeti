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

// ════════════════════════════════════════════════════════════════════════════
// RICH PARSER — real exam-paper documents (metadata table + Q./options/Sol.
// prose, with inline MathType equations and diagram pictures), NOT the plain
// LaTeX-typed template above. See questionBlockMarkers.js for the marker
// recognisers and the implementation plan for the full design rationale.
//
// This module stays PURE + SYNCHRONOUS on purpose: it only reads the zip and
// returns structured data (text with @@EQ_n@@ placeholders + the raw
// WMF/EMF/picture buffers those placeholders refer to). It does NOT call
// LibreOffice, Gemini, or Cloudinary — that orchestration lives in
// services/bulkUploadOrchestrator.service.js, which is what actually
// resolves the placeholders. Keeping this file dependency-free from those
// (slow, external, async) services makes it trivial to unit-test.
// ════════════════════════════════════════════════════════════════════════════

const {
  stripQuestionMarker,
  stripSolutionMarker,
  stripOptionMarker,
} = require("./questionBlockMarkers");
const { convertOmmlToLatex } = require("./ommlToLatex");
const { validateLatex } = require("./mathParser");

const OPTION_KEYS = ["A", "B", "C", "D"];

/**
 * Tokenises ONE paragraph's inner XML into an ordered list of:
 *   { type: "text", value }
 *   { type: "tab" }
 *   { type: "break" }
 *   { type: "equation", rId }       — a legacy OLE equation object
 *   { type: "contentImage", rId }   — a real picture (diagram/photo)
 * Order is preserved exactly as it appears in the run stream, which is what
 * makes it possible to splice converted LaTeX back into the right spot.
 */
function tokenizeParagraph(pXml) {
  const tokenRe =
    /<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:object(?:\s[^>]*)?>([\s\S]*?)<\/w:object>|<w:drawing(?:\s[^>]*)?>([\s\S]*?)<\/w:drawing>|<m:oMath>([\s\S]*?)<\/m:oMath>/g;

  const tokens = [];
  let m;
  while ((m = tokenRe.exec(pXml)) !== null) {
    const whole = m[0];
    if (whole.startsWith("<w:tab")) {
      tokens.push({ type: "tab" });
    } else if (whole.startsWith("<w:br")) {
      tokens.push({ type: "break" });
    } else if (m[1] !== undefined) {
      tokens.push({ type: "text", value: decodeXmlEntities(m[1]) });
    } else if (m[2] !== undefined) {
      // Legacy OLE object — the equation's rasterizable preview lives in
      // its <v:imagedata r:id="..."/> child.
      const imgMatch = /<v:imagedata\s+r:id="(rId\d+)"/.exec(m[2]);
      if (imgMatch) tokens.push({ type: "equation", rId: imgMatch[1] });
      // else: malformed/unsupported object — silently skipped, the
      // surrounding text will just have a gap where it was.
    } else if (m[3] !== undefined) {
      const blipMatch = /<a:blip\s+r:embed="(rId\d+)"/.exec(m[3]);
      if (blipMatch) tokens.push({ type: "contentImage", rId: blipMatch[1] });
    } else if (m[4] !== undefined) {
      // Native Word equation (OMML) — structured XML, not a picture, so it
      // converts deterministically with NO OCR/AI step and no accuracy
      // ceiling. See ommlToLatex.js.
      tokens.push({ type: "nativeEquation", omml: m[0] });
    }
  }
  return tokens;
}

/** Splits a paragraph's token stream into segments on `{type:"tab"}`
 *  boundaries — used for option lines like "(1) ...  <tab>  (2) ...". */
function splitOnTabs(tokens) {
  const segments = [[]];
  for (const t of tokens) {
    if (t.type === "tab") segments.push([]);
    else segments[segments.length - 1].push(t);
  }
  return segments.filter((seg) => seg.length > 0);
}

/** Renders a token segment (text + equation placeholders) back into a single
 *  string, collecting any equation/contentImage tokens it contains into
 *  `collector` as it goes. `idGen` yields a fresh unique id per equation. */
function renderSegment(tokens, collector, idGen) {
  let out = "";
  for (const t of tokens) {
    if (t.type === "text") out += t.value;
    else if (t.type === "break") out += "\n";
    else if (t.type === "equation") {
      const id = idGen();
      collector.equations.push({ id, rId: t.rId, native: false });
      out += `@@EQ_${id}@@`;
    } else if (t.type === "nativeEquation") {
      // Resolved immediately — no rasterize/Gemini round-trip needed. Still
      // goes through the SAME @@EQ_n@@ placeholder + conversionReview path
      // as OLE equations so the orchestrator and review UI treat both
      // uniformly; the orchestrator just skips the async conversion step
      // when `native: true`.
      const id = idGen();
      let latex = "", valid = false, error = null;
      try {
        latex = convertOmmlToLatex(t.omml);
        ({ valid, error } = validateLatex(latex));
      } catch (err) {
        error = err.message;
      }
      collector.equations.push({ id, rId: null, native: true, latex, valid, error });
      out += `@@EQ_${id}@@`;
    } else if (t.type === "contentImage") {
      collector.images.push({ rId: t.rId });
    }
  }
  return out.trim();
}

/**
 * Parses one question's worth of paragraphs (everything between one
 * metadata table and the next) into { textRaw, options, correctAnswer,
 * solutionRaw, equations[], images:{before:[],after:[]} } or a
 * { error } object if the Q./options/Sol. structure can't be confidently
 * found — never a guess.
 */
function parseQuestionProse(paragraphXmls, idGen) {
  const collector = { equations: [], images: [] };
  const paraTexts = []; // plain-text (placeholders only) per paragraph, for marker detection
  const paraTokens = [];
  for (const pXml of paragraphXmls) {
    const tokens = tokenizeParagraph(pXml);
    paraTokens.push(tokens);
    // Peek text ignoring equation/image tokens, just for marker matching.
    paraTexts.push(tokens.filter((t) => t.type === "text").map((t) => t.value).join("").trim());
  }

  // ── Locate Q. / options / Sol. boundaries ────────────────────────────────
  let qStart = -1;
  for (let i = 0; i < paraTexts.length; i++) {
    if (stripQuestionMarker(paraTexts[i]) !== null) { qStart = i; break; }
  }
  if (qStart === -1) return { error: "Could not find a question marker (\"Q.\") in this block." };

  let optStart = -1;
  for (let i = qStart; i < paraTexts.length; i++) {
    const firstSeg = paraTexts[i].split("\t")[0] || paraTexts[i];
    if (stripOptionMarker(firstSeg) !== null) { optStart = i; break; }
  }
  if (optStart === -1) return { error: "Could not find option markers (\"(1)\"..\"(4)\") after the question text." };

  let solStart = -1;
  for (let i = optStart; i < paraTexts.length; i++) {
    if (stripSolutionMarker(paraTexts[i]) !== null) { solStart = i; break; }
  }
  if (solStart === -1) return { error: "Could not find a solution marker (\"Sol. (N)\") with the correct option number." };

  // ── Question text: qStart..optStart-1, marker stripped from the first ───
  let questionOut = "";
  for (let i = qStart; i < optStart; i++) {
    let tokens = paraTokens[i];
    if (i === qStart) {
      // Strip the leading "Q." marker from the rendered text after the fact
      // (simplest correct way given the marker can span run boundaries).
      const rendered = renderSegment(tokens, collector, idGen);
      const stripped = stripQuestionMarker(rendered);
      questionOut += (stripped !== null ? stripped : rendered);
    } else {
      questionOut += "\n" + renderSegment(tokens, collector, idGen);
    }
  }
  questionOut = questionOut.trim();
  if (!questionOut) return { error: "Question text is empty after removing the \"Q.\" marker." };

  // ── Options: optStart..solStart-1, tab-split, "(N)" per segment ─────────
  // Stateful, not independent-per-segment: some documents insert an EXTRA
  // tab stop between the "(N)" marker and its actual content (column
  // alignment in the original Word doc), which splits one option across two
  // tab-segments — a marker-only segment followed by a marker-less content
  // segment. Track "the option currently awaiting content" and attach any
  // marker-less segment to it, instead of silently dropping that content.
  const optionsByNumber = {};
  let pendingOption = null; // option number whose content isn't confirmed yet
  for (let i = optStart; i < solStart; i++) {
    const segments = splitOnTabs(paraTokens[i]);
    for (const seg of segments) {
      const renderedFull = renderSegment(seg, { equations: [], images: [] }, () => "peek");
      const marker = stripOptionMarker(renderedFull);

      if (marker && !optionsByNumber[marker.number]) {
        const rendered = renderSegment(seg, collector, idGen);
        const strippedMarker = stripOptionMarker(rendered);
        const content = (strippedMarker ? strippedMarker.rest : rendered).trim();
        optionsByNumber[marker.number] = content; // may be "" — filled in below if so
        pendingOption = content ? null : marker.number;
        continue;
      }

      // No marker in this segment — if an option is still waiting for its
      // content (the "extra tab stop" case), attach it here.
      if (pendingOption !== null) {
        const rendered = renderSegment(seg, collector, idGen).trim();
        if (rendered) {
          optionsByNumber[pendingOption] =
            (optionsByNumber[pendingOption] ? optionsByNumber[pendingOption] + " " : "") + rendered;
          pendingOption = null;
        }
      }
    }
  }
  const missingOptions = [1, 2, 3, 4].filter((n) => !optionsByNumber[n]);
  if (missingOptions.length > 0) {
    return { error: `Missing option(s) ${missingOptions.join(", ")} — expected exactly 4 numbered options.` };
  }

  // ── Solution: solStart..end, marker gives correctAnswer directly ────────
  const solMarkerMatch = stripSolutionMarker(paraTexts[solStart]);
  const correctAnswer = OPTION_KEYS[solMarkerMatch.optionNumber - 1];

  let solutionOut = "";
  for (let i = solStart; i < paraTokens.length; i++) {
    const tokens = paraTokens[i];
    if (i === solStart) {
      const rendered = renderSegment(tokens, collector, idGen);
      const stripped = stripSolutionMarker(rendered);
      solutionOut += stripped ? stripped.rest : rendered;
    } else {
      solutionOut += "\n" + renderSegment(tokens, collector, idGen);
    }
  }
  solutionOut = solutionOut.trim();

  // ── Content images: before solStart → question image; after → solution images
  const questionImageRIds = [];
  const solutionImageRIds = [];
  for (let i = qStart; i < paraTokens.length; i++) {
    for (const t of paraTokens[i]) {
      if (t.type !== "contentImage") continue;
      if (i < solStart) questionImageRIds.push(t.rId);
      else solutionImageRIds.push(t.rId);
    }
  }

  return {
    questionOut,
    optionsByNumber,
    correctAnswer,
    solutionOut,
    equations: collector.equations, // [{id, rId}]
    questionImageRIds,
    solutionImageRIds,
  };
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{
 *   rows: Array<Object>,   // successfully structurally-parsed questions
 *   failed: Array<{row:number, reason:string}>,
 *   getMediaBuffer: (rId: string) => Promise<{buffer:Buffer, ext:string}|null>,
 * }>}
 */
async function parseRichQuestionsDocx(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError("Could not read the uploaded .docx file — it may be corrupted.", 400);
  }

  const docXmlFile = zip.file("word/document.xml");
  const relsFile    = zip.file("word/_rels/document.xml.rels");
  if (!docXmlFile || !relsFile) {
    throw new AppError("This does not look like a valid .docx file.", 400);
  }

  const xml  = await docXmlFile.async("string");
  const rels = await relsFile.async("string");

  // rId -> { target, ext }
  const relMap = {};
  const relRe = /<Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let rm;
  while ((rm = relRe.exec(rels)) !== null) {
    const target = rm[2];
    const ext = (target.split(".").pop() || "").toLowerCase();
    relMap[rm[1]] = { target: target.replace(/^\.\.\//, ""), ext };
  }

  async function getMediaBuffer(rId) {
    const rel = relMap[rId];
    if (!rel) return null;
    const zipPath = rel.target.startsWith("word/") ? rel.target : `word/${rel.target}`;
    const file = zip.file(zipPath);
    if (!file) return null;
    return { buffer: await file.async("nodebuffer"), ext: rel.ext };
  }

  // ── Walk the body top-level: alternating <w:tbl> (metadata) and <w:p> ───
  const bodyMatch = /<w:body>([\s\S]*)<\/w:body>/.exec(xml);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const blockRe = /<w:tbl>([\s\S]*?)<\/w:tbl>|<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  const blocks = [];
  let bm;
  while ((bm = blockRe.exec(body)) !== null) {
    if (bm[1] !== undefined) blocks.push({ type: "table", xml: bm[1] });
    else blocks.push({ type: "para", xml: bm[2] });
  }

  // ── Group into per-question chunks: each table starts a new question ────
  // A paragraph containing ONLY "4." / "12." (Word's manual question-number
  // label, typed as its own paragraph right before the NEXT question's
  // metadata table) is not part of THIS question's solution — drop it as
  // noise, or it silently bleeds into the previous question's solution text.
  const PURE_NUMBER_LABEL_RE = /^\s*\d+\s*\.?\s*$/;
  function isPureNumberLabelParagraph(pXml) {
    const textOnly = tokenizeParagraph(pXml)
      .filter((t) => t.type === "text")
      .map((t) => t.value)
      .join("")
      .trim();
    return textOnly !== "" && PURE_NUMBER_LABEL_RE.test(textOnly);
  }

  const groups = [];
  for (const block of blocks) {
    if (block.type === "table") {
      groups.push({ tableXml: block.xml, paraXmls: [] });
    } else if (groups.length > 0) {
      if (isPureNumberLabelParagraph(block.xml)) continue;
      groups[groups.length - 1].paraXmls.push(block.xml);
    }
    // paragraphs before the first table (title/instructions) are ignored
  }

  if (groups.length === 0) {
    throw new AppError(
      "No question metadata tables found. Each question must start with a Subject/Class/Chapter/... field table, same as the sample template.",
      400
    );
  }

  const rows = [];
  const failed = [];
  let equationCounter = 0;
  const idGen = () => String(++equationCounter);

  groups.forEach((group, idx) => {
    const rowNumber = idx + 1;
    const metadata = parseTable(group.tableXml, rowNumber) || { _rowNumber: rowNumber };

    const parsed = parseQuestionProse(group.paraXmls, idGen);
    if (parsed.error) {
      failed.push({ row: rowNumber, reason: parsed.error });
      return;
    }

    rows.push({
      _rowNumber: rowNumber,
      ...metadata,
      questionText: parsed.questionOut,
      optionA: parsed.optionsByNumber[1],
      optionB: parsed.optionsByNumber[2],
      optionC: parsed.optionsByNumber[3],
      optionD: parsed.optionsByNumber[4],
      correctAnswer: parsed.correctAnswer,
      solutionText: parsed.solutionOut,
      _equations: parsed.equations,             // [{id, rId}]
      _questionImageRIds: parsed.questionImageRIds,
      _solutionImageRIds: parsed.solutionImageRIds,
    });
  });

  return { rows, failed, getMediaBuffer };
}

/**
 * Distinguishes the two supported .docx bulk-upload formats WITHOUT fully
 * parsing either: the OLD plain template puts "Question Text" (and options,
 * etc.) as ROWS inside the SAME 2-column table as the classification
 * fields; the NEW rich format's tables hold ONLY classification fields
 * (Subject/Chapter/...) with the question/options/solution living in
 * ordinary prose paragraphs after the table. Checking the first table for a
 * "questionText" row is a cheap, reliable signal for which parser to run.
 * @param {Buffer} buffer
 * @returns {Promise<"plain"|"rich">}
 */
async function detectDocxTemplateFormat(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new AppError("Could not read the uploaded .docx file — it may be corrupted.", 400);
  }
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new AppError("This does not look like a valid .docx file.", 400);

  const xml = await docXmlFile.async("string");
  const tables = extractBlocks(xml, "tbl");
  if (tables.length === 0) return "rich"; // no tables at all — let the rich parser produce a clear error

  const firstParsed = parseTable(tables[0], 1);
  return firstParsed && firstParsed.questionText ? "plain" : "rich";
}

module.exports = {
  parseQuestionsDocx,
  parseRichQuestionsDocx,
  detectDocxTemplateFormat,
};
