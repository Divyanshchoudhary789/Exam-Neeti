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
// Fields that only ever appear as their OWN dedicated label cell (e.g. a
// "Question Text" cell followed by the actual question in the next cell) —
// NEVER as a "Label: value" pair squeezed inside one cell of free-flowing
// prose. Excluding them from the intra-cell colon-split pass (below) avoids
// a real regression risk: question/solution text occasionally contains a
// literal colon ("Given: v = 10 m/s") that would otherwise falsely look
// like a "Label: value" metadata pair.
const COLON_SPLIT_EXCLUDED_KEYS = new Set([
  "questionText", "optionA", "optionB", "optionC", "optionD",
  "correctAnswer", "solutionText", "sourceRef",
]);

const NUMERIC_KEYS = new Set(["idealTimeSeconds", "marks", "negativeMarks"]);

/** Strips a numeric field's value down to just its leading number (handles
 *  "90 sec", "4 marks", "90sec" etc. — real documents rarely write these as
 *  a bare number). Non-numeric fields pass through trimmed, unchanged. */
function cleanFieldValue(key, value) {
  const trimmed = String(value || "").trim();
  if (!NUMERIC_KEYS.has(key)) return trimmed;
  const m = /-?\d+(\.\d+)?/.exec(trimmed);
  return m ? m[0] : trimmed;
}

/**
 * Parses one <w:tbl> block into a raw field-key → value object.
 *
 * Column-position agnostic by design (found necessary against real
 * documents, which don't all use the same 2-column Field|Value shape):
 *   - 2-column tables:              Field | Value
 *   - 3-column tables:              Category | Field | Value
 *   - "Label: Value" packed into a single cell (e.g. "Difficulty: Hard"),
 *     sometimes alongside ANOTHER such pair in a sibling cell on the same
 *     row (e.g. "Ideal time: 90 sec") instead of its own row.
 *
 * Returns null if the table has no recognisable fields (e.g. a decorative
 * or instructions table, or — for the rich-format parser — an options grid
 * table, which intentionally has none of these labels; see
 * parseRichQuestionsDocx's table-vs-metadata classification).
 */
function parseTable(tblXml, tableIndex) {
  const rows = extractBlocks(tblXml, "tr");
  const rawRow = { _rowNumber: tableIndex };
  let matchedAny = false;

  for (const rowXml of rows) {
    const cells = extractBlocks(rowXml, "tc").map(extractCellText);
    if (cells.length < 2) continue;

    // A cell can hold several stacked lines (one real document packs
    // "Subject / Class / Chapter / Concept" as 4 lines in one cell, with
    // the matching 4 values stacked in the NEXT cell) — blank spacer lines
    // between them are dropped so only the meaningful lines are compared.
    const cellLines = cells.map((c) => c.split("\n").map((s) => s.trim()).filter(Boolean));

    // Pass 1: intra-LINE "Label: value" pairs — highest-confidence signal
    // (self-contained on one line), resolved first so pass 2 never
    // overwrites a value this finds.
    cellLines.forEach((lines) => {
      lines.forEach((line) => {
        const m = /^([^:：]{2,40})[:：]\s*(.+)$/.exec(line);
        if (!m) return;
        const key = resolveFieldKey(m[1]);
        if (!key || COLON_SPLIT_EXCLUDED_KEYS.has(key)) return;
        rawRow[key] = cleanFieldValue(key, m[2]);
        matchedAny = true;
      });
    });

    // Pass 2: the LAST two cells of the row, paired line-by-line (label
    // lines <-> value lines at the same position). Deliberately NOT every
    // adjacent pair — an earlier column (when present) is a "Category"
    // grouping cell (e.g. "Basic information", "Difficulty" used as a
    // SECTION name, not a field label) and must never be read as a label
    // for its neighbour; only the rightmost two columns are actually
    // label|value. This also covers the plain 2-column case unchanged
    // (there the last two cells ARE cells[0]/cells[1]).
    if (cells.length >= 2) {
      const labelLines = cellLines[cellLines.length - 2];
      const valueLines = cellLines[cellLines.length - 1];
      labelLines.forEach((label, li) => {
        const key = resolveFieldKey(label);
        if (!key || rawRow[key] !== undefined) return; // don't overwrite pass 1
        const value = valueLines[li] !== undefined ? valueLines[li] : valueLines[0];
        if (!value) return;
        rawRow[key] = cleanFieldValue(key, value);
        matchedAny = true;
      });
    }
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
  isDecorativeSeparator,
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
/**
 * Extracts options from a TABLE laid out as an options grid (e.g. a 2x2
 * "(a)/(b)/(c)/(d)" cell layout) — the alternative to tab-separated inline
 * text some documents use instead. Each cell is expected to hold exactly
 * one marked option, in any row/column arrangement (1x4, 4x1, 2x2, ...).
 */
function extractOptionsFromTable(tblXml, collector, idGen) {
  const optionsByNumber = {};
  for (const rowXml of extractBlocks(tblXml, "tr")) {
    for (const cellXml of extractBlocks(rowXml, "tc")) {
      const cellTokens = [];
      for (const pXml of extractBlocks(cellXml, "p")) cellTokens.push(...tokenizeParagraph(pXml));

      const peekText = renderSegment(cellTokens, { equations: [], images: [] }, () => "peek");
      const marker = stripOptionMarker(peekText);
      if (!marker || optionsByNumber[marker.number]) continue;

      const rendered = renderSegment(cellTokens, collector, idGen);
      const stripped = stripOptionMarker(rendered);
      optionsByNumber[marker.number] = (stripped ? stripped.rest : rendered).trim();
    }
  }
  return optionsByNumber;
}

/**
 * Parses one question's content — a mix of paragraphs and (occasionally) an
 * embedded options table, in document order — into its Q./options/Sol.
 * parts. Table-vs-paragraph options handling is auto-detected: whichever
 * comes first after the question text (a table, or a paragraph starting
 * with a "(1)"/"(a)" marker) is treated as where the options are.
 *
 * @param {Array<{type:"para"|"table", xml:string}>} blocks
 * @param {() => string} idGen
 */
function parseQuestionProse(blocks, idGen) {
  const collector = { equations: [], images: [] };

  // Precompute paragraph tokens/text once; table blocks stay as raw xml
  // (extractOptionsFromTable tokenizes their cells itself, on demand).
  const items = blocks.map((b) => {
    if (b.type !== "para") return { type: "table", xml: b.xml };
    const tokens = tokenizeParagraph(b.xml);
    const text = tokens.filter((t) => t.type === "text").map((t) => t.value).join("").trim();
    return { type: "para", xml: b.xml, tokens, text };
  });

  // ── Q. marker — only paragraphs can carry it ─────────────────────────────
  let qStart = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type === "para" && stripQuestionMarker(items[i].text) !== null) { qStart = i; break; }
  }
  if (qStart === -1) {
    // No explicit "Q."/"Q1." marker found anywhere — some real documents
    // just start the question text directly after the metadata table, with
    // no marker at all (confirmed against a real uploaded document). The
    // metadata table itself is already a strong enough "a new question
    // starts here" signal, so fall back to the first non-empty paragraph in
    // this block rather than failing the row outright.
    qStart = items.findIndex((it) => it.type === "para" && it.text !== "");
    if (qStart === -1) return { error: "This question block has no text content at all." };
  }

  // ── Where do options start? First TABLE, or first paragraph whose first
  //    tab-segment matches a "(1)"/"(a)" marker — whichever comes first.
  //    Starts searching at qStart+1, NEVER qStart itself: a question
  //    numbered "Q1." contains "1." right in its own marker, which would
  //    otherwise false-match as an option marker on the SAME paragraph and
  //    collapse the question text to nothing (found via real-document
  //    testing — a document numbering its questions "Q1./Q2./..." instead
  //    of a bare "Q." triggered this exact collision). ────────────────────
  let optStart = -1;
  for (let i = qStart + 1; i < items.length; i++) {
    const item = items[i];
    if (item.type === "table") { optStart = i; break; }
    const firstSeg = item.text.split("\t")[0] || item.text;
    if (stripOptionMarker(firstSeg) !== null) { optStart = i; break; }
  }
  if (optStart === -1) return { error: "Could not find option markers (\"(1)\"..\"(4)\") after the question text." };

  // ── Question text: qStart..optStart-1 ────────────────────────────────────
  let questionOut = "";
  for (let i = qStart; i < optStart; i++) {
    const item = items[i];
    if (item.type !== "para") continue;
    if (i === qStart) {
      // Strip the leading "Q." marker from the rendered text after the fact
      // (simplest correct way given the marker can span run boundaries).
      const rendered = renderSegment(item.tokens, collector, idGen);
      const stripped = stripQuestionMarker(rendered);
      questionOut += (stripped !== null ? stripped : rendered);
    } else {
      questionOut += "\n" + renderSegment(item.tokens, collector, idGen);
    }
  }
  questionOut = questionOut.trim();
  if (!questionOut) return { error: "Question text is empty after removing the \"Q.\" marker." };

  // ── Options — table layout or tab-separated-paragraph layout ────────────
  let optionsByNumber;
  let afterOptions;

  if (items[optStart].type === "table") {
    optionsByNumber = extractOptionsFromTable(items[optStart].xml, collector, idGen);
    afterOptions = optStart + 1;
  } else {
    // Stateful, not independent-per-segment: some documents insert an EXTRA
    // tab stop between the "(N)" marker and its actual content (column
    // alignment in the original Word doc), which splits one option across
    // two tab-segments — a marker-only segment followed by a marker-less
    // content segment. Track "the option currently awaiting content" and
    // attach any marker-less segment to it, instead of silently dropping it.
    // Bounded by the next TABLE or the Sol. marker, whichever comes first.
    let optionsEnd = items.length;
    for (let i = optStart; i < items.length; i++) {
      if (items[i].type === "table" || (items[i].type === "para" && stripSolutionMarker(items[i].text) !== null)) {
        optionsEnd = i;
        break;
      }
    }

    optionsByNumber = {};
    let pendingOption = null;
    for (let i = optStart; i < optionsEnd; i++) {
      const item = items[i];
      if (item.type !== "para") continue;
      const segments = splitOnTabs(item.tokens);
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
    afterOptions = optionsEnd;
  }

  const missingOptions = [1, 2, 3, 4].filter((n) => !optionsByNumber[n]);
  if (missingOptions.length > 0) {
    return { error: `Missing option(s) ${missingOptions.join(", ")} — expected exactly 4 numbered options.` };
  }

  // ── Sol. marker — search forward from right after the options ───────────
  let solStart = -1;
  for (let i = afterOptions; i < items.length; i++) {
    if (items[i].type === "para" && stripSolutionMarker(items[i].text) !== null) { solStart = i; break; }
  }
  if (solStart === -1) return { error: "Could not find a solution marker (\"Sol. (N)\") with the correct option number." };

  const solMarkerMatch = stripSolutionMarker(items[solStart].text);
  const correctAnswer = OPTION_KEYS[solMarkerMatch.optionNumber - 1];

  let solutionOut = "";
  for (let i = solStart; i < items.length; i++) {
    const item = items[i];
    if (item.type !== "para") continue; // a stray table after the solution (shouldn't happen) is ignored, not an error
    if (i === solStart) {
      const rendered = renderSegment(item.tokens, collector, idGen);
      const stripped = stripSolutionMarker(rendered);
      solutionOut += stripped ? stripped.rest : rendered;
    } else {
      solutionOut += "\n" + renderSegment(item.tokens, collector, idGen);
    }
  }
  solutionOut = solutionOut.trim();

  // ── Content images: before solStart → question image; after → solution images
  const questionImageRIds = [];
  const solutionImageRIds = [];
  for (let i = qStart; i < items.length; i++) {
    if (items[i].type !== "para") continue;
    for (const t of items[i].tokens) {
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
    equations: collector.equations, // [{id, rId, native, ...}]
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

  // ── Group into per-question chunks ───────────────────────────────────────
  // A table starts a NEW question only if it actually looks like a metadata
  // table (resolves at least one Subject/Chapter/Difficulty/... field) — see
  // parseTable(). Some real documents lay a question's OPTIONS out as a
  // table too (a 2x2 or 1x4 grid of "(a)/(b)/(c)/(d)" cells instead of
  // tab-separated text); that table has none of the metadata labels, so it
  // correctly falls through to being attached as CONTENT of the current
  // question instead of starting a bogus extra one — this is what
  // parseQuestionProse's table-aware options scan (below) then picks up.
  //
  // A paragraph containing ONLY "4." / "12." (Word's manual question-number
  // label, typed as its own paragraph right before the NEXT question's
  // metadata table) or a purely decorative divider line ("―――――") is not
  // real content — drop it as noise, or it silently bleeds into the
  // previous question's solution text.
  const PURE_NUMBER_LABEL_RE = /^\s*\d+\s*\.?\s*$/;
  function paragraphPlainText(pXml) {
    return tokenizeParagraph(pXml).filter((t) => t.type === "text").map((t) => t.value).join("").trim();
  }
  function isNoiseParagraph(pXml) {
    const text = paragraphPlainText(pXml);
    if (text === "") return false; // empty paragraphs are handled naturally elsewhere, not noise to drop
    return PURE_NUMBER_LABEL_RE.test(text) || isDecorativeSeparator(text);
  }

  const groups = [];
  for (const block of blocks) {
    if (block.type === "table") {
      const looksLikeMetadata = parseTable(block.xml, 0) !== null;
      if (looksLikeMetadata) {
        groups.push({ tableXml: block.xml, blocks: [] });
        continue;
      }
      // Not a metadata table — content belonging to the CURRENT question
      // (e.g. an options grid). Ignored if it appears before any metadata
      // table at all (title-page decoration).
      if (groups.length > 0) groups[groups.length - 1].blocks.push({ type: "table", xml: block.xml });
    } else if (groups.length > 0) {
      if (isNoiseParagraph(block.xml)) continue;
      groups[groups.length - 1].blocks.push({ type: "para", xml: block.xml });
    }
    // content before the first metadata table (title/instructions) is ignored
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

    const parsed = parseQuestionProse(group.blocks, idGen);
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
