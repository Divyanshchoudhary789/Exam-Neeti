/**
 * bulkUploadOrchestrator.service.js
 *
 * Bridges the PURE/SYNCHRONOUS structural parsers (questionDocxParser's
 * parseRichQuestionsDocx, questionXlsxParser's parseQuestionsXlsx) and the
 * SLOW/ASYNC/EXTERNAL steps a rich bulk upload needs: rasterizing legacy
 * MathType equation images, sending them to Gemini, and uploading every
 * image (equation crops kept for review + real diagrams) to Cloudinary.
 *
 * Kept separate from question.controller.js because this is genuinely a
 * different concern (I/O orchestration with retries/concurrency/partial
 * failure) from HTTP request handling and Joi/DB logic.
 */

"use strict";

const { rasterizeToPng } = require("./officeRasterizer.service");
const { transcribeEquationsToLatex } = require("./geminiLatexService");
const { uploadToCloudinary } = require("../middleware/upload");
const { runWithConcurrencyLimit } = require("../utils/concurrencyLimiter");

const RASTERIZABLE_EXTS = new Set(["wmf", "emf"]);

/**
 * Resolves every equation referenced across ALL rows of a rich-docx parse
 * result into final LaTeX (+ flags for manual review), and every content
 * image into a Cloudinary URL.
 *
 * @param {{rows:Array, getMediaBuffer:Function}} parseResult
 * @param {(stage:string, processed:number, total:number) => Promise<void>} onProgress
 * @returns {Promise<{
 *   equationResolution: Map<string, {latex:string, flagged:boolean, reason:string|null, originalImageUrl:string|null}>,
 *   questionImages: Map<number, {url:string, publicId:string}>,
 *   solutionImages: Map<number, Array<{url:string, publicId:string}>>,
 *   optionImages: Map<number, {A?:{url,publicId}, B?:..., C?:..., D?:...}>,
 * }>}
 */
async function resolveDocxEquationsAndImages(parseResult, onProgress = async () => {}) {
  const { rows, getMediaBuffer } = parseResult;
  const equationResolution = new Map();

  // ── Native (OMML) equations — already resolved at parse time, no I/O ────
  const oleEquationRefs = [];
  for (const row of rows) {
    for (const eq of row._equations) {
      if (eq.native) {
        equationResolution.set(eq.id, {
          latex: eq.latex,
          flagged: !eq.valid,
          reason: eq.valid ? null : (eq.error || "Native equation did not pass LaTeX validation."),
          originalImageUrl: null, // no crop to show — it was never a picture
        });
      } else {
        oleEquationRefs.push(eq);
      }
    }
  }

  // ── Legacy MathType (OLE) equations — fetch preview image, rasterize,
  //    Gemini-transcribe, upload the crop to Cloudinary for the review UI.
  //
  // Progress reporting: rasterizing + Gemini-transcribing 200+ equations can
  // take several minutes. Each of the three sub-phases below now reports
  // incrementally (not just once at the start) — without this, a real
  // 226-equation document sat at "0/226" for the ENTIRE duration of both
  // rasterization and transcription (many minutes), which is
  // indistinguishable from a hang even though it was working correctly.
  // Combined into one running counter against an approximate 3x total
  // (rasterize + transcribe + crop-upload are three passes over roughly the
  // same set) — exact precision doesn't matter, visible MOVEMENT does.
  if (oleEquationRefs.length > 0) {
    const totalSteps = oleEquationRefs.length * 3;
    let stepsDone = 0;
    const bumpProgress = (n) => { stepsDone += n; return onProgress("converting_equations", stepsDone, totalSteps); };
    await bumpProgress(0);

    const mediaResults = await Promise.all(
      oleEquationRefs.map(async (eq) => ({ eq, media: await getMediaBuffer(eq.rId) }))
    );

    const rasterizable = mediaResults
      .filter((r) => r.media && RASTERIZABLE_EXTS.has(r.media.ext))
      .map((r) => ({ id: r.eq.id, buffer: r.media.buffer, ext: r.media.ext }));

    for (const { eq, media } of mediaResults) {
      if (!media) {
        equationResolution.set(eq.id, {
          latex: "", flagged: true,
          reason: "Could not locate this equation's image data in the document.",
          originalImageUrl: null,
        });
      } else if (!RASTERIZABLE_EXTS.has(media.ext)) {
        equationResolution.set(eq.id, {
          latex: "", flagged: true,
          reason: `Unsupported embedded-equation image format (.${media.ext}).`,
          originalImageUrl: null,
        });
      }
    }

    // Never let a rasterization failure crash the WHOLE job — a server
    // without LibreOffice installed (e.g. Render's Node runtime before the
    // Docker+LibreOffice setup, see backend/Dockerfile) should still finish
    // the upload: native OMML equations, content images, and every field's
    // structure still get processed normally; only the equations that
    // actually needed rasterization end up flagged for manual entry.
    let pngById = new Map();
    try {
      pngById = await rasterizeToPng(rasterizable, (processed) => {
        stepsDone = processed; // phase 1 of 3 — absolute count, not additive
        return onProgress("converting_equations", stepsDone, totalSteps);
      });
    } catch (err) {
      console.error("[BulkUpload] rasterizeToPng failed for the whole batch:", err.message);
    }
    stepsDone = oleEquationRefs.length; // rasterize phase done regardless of partial failures — move to phase 2

    const toTranscribe = [];
    for (const { id } of rasterizable) {
      const png = pngById.get(id);
      if (png) toTranscribe.push({ id, pngBuffer: png });
      else equationResolution.set(id, {
        latex: "", flagged: true,
        reason: "Could not rasterize this equation image (equation-conversion service unavailable or this specific image failed) — please type the formula manually.",
        originalImageUrl: null,
      });
    }

    const latexResults = await transcribeEquationsToLatex(toTranscribe, (completed) => {
      stepsDone = oleEquationRefs.length + completed; // phase 2 of 3
      return onProgress("converting_equations", stepsDone, totalSteps);
    });
    stepsDone = oleEquationRefs.length * 2; // phase 2 done — move to phase 3

    // Upload every successfully-rasterized equation's crop to Cloudinary so
    // the review UI can show "original vs converted" — including ones that
    // converted fine, since verifying against the source is the whole point.
    let uploaded = 0;
    const uploadOutcomes = await runWithConcurrencyLimit(toTranscribe, 5, async ({ id, pngBuffer }) => {
      const upload = await uploadToCloudinary(pngBuffer, "examneeti/questions/equation-review").catch(() => null);
      uploaded++;
      await onProgress("converting_equations", oleEquationRefs.length * 2 + uploaded, totalSteps);
      return { id, upload };
    });

    for (const outcome of uploadOutcomes) {
      if (!outcome.ok) continue;
      const { id, upload } = outcome.value;
      const result = latexResults.get(id) || { latex: "", flagged: true, reason: "No conversion result." };
      equationResolution.set(id, {
        latex: result.latex,
        flagged: result.flagged,
        reason: result.reason,
        originalImageUrl: upload?.url || null,
      });
    }
  }

  // ── Content images (diagrams) — question / solution / per-option images
  const questionImages = new Map();
  const solutionImages = new Map();
  const optionImages = new Map(); // rowNumber -> { A?: result, B?: result, ... }

  const allImageRefs = [];
  for (const row of rows) {
    for (const rId of row._questionImageRIds) allImageRefs.push({ rowNumber: row._rowNumber, rId, kind: "question" });
    for (const rId of row._solutionImageRIds) allImageRefs.push({ rowNumber: row._rowNumber, rId, kind: "solution" });
    for (const [optionKey, rId] of Object.entries(row._optionImageRIds || {})) {
      allImageRefs.push({ rowNumber: row._rowNumber, rId, kind: "option", optionKey });
    }
  }

  if (allImageRefs.length > 0) {
    await onProgress("uploading_images", 0, allImageRefs.length);
    let processed = 0;
    const CLOUDINARY_FOLDER = { question: "examneeti/questions", solution: "examneeti/solutions", option: "examneeti/options" };
    const outcomes = await runWithConcurrencyLimit(allImageRefs, 5, async (ref) => {
      const media = await getMediaBuffer(ref.rId);
      let buffer = media?.buffer;
      if (media && RASTERIZABLE_EXTS.has(media.ext)) {
        const pngMap = await rasterizeToPng([{ id: "img", buffer: media.buffer, ext: media.ext }]);
        buffer = pngMap.get("img") || null;
      }
      const result = buffer
        ? await uploadToCloudinary(buffer, CLOUDINARY_FOLDER[ref.kind]).catch(() => null)
        : null;
      processed++;
      await onProgress("uploading_images", processed, allImageRefs.length);
      return { ...ref, result };
    });

    for (const outcome of outcomes) {
      if (!outcome.ok || !outcome.value.result) continue;
      const { rowNumber, kind, optionKey, result } = outcome.value;
      if (kind === "question") {
        // Schema supports only one questionImage — first one wins.
        if (!questionImages.has(rowNumber)) questionImages.set(rowNumber, result);
      } else if (kind === "solution") {
        const arr = solutionImages.get(rowNumber) || [];
        arr.push(result);
        solutionImages.set(rowNumber, arr);
      } else if (kind === "option") {
        const forRow = optionImages.get(rowNumber) || {};
        forRow[optionKey] = result;
        optionImages.set(rowNumber, forRow);
      }
    }
  }

  return { equationResolution, questionImages, solutionImages, optionImages };
}

/**
 * Replaces every `@@EQ_n@@` placeholder in `text` with `$latex$`, and
 * records a conversionReview entry (location tag `location`) for each one
 * it touches. Mutates `reviewEntries` (push).
 */
function spliceEquationPlaceholders(text, equationResolution, location, reviewEntries) {
  if (!text) return text;
  return text.replace(/@@EQ_(\d+)@@/g, (_, id) => {
    const res = equationResolution.get(id);
    if (!res) return ""; // shouldn't happen — defensive
    reviewEntries.push({
      location,
      originalImageUrl: res.originalImageUrl,
      originalImagePublicId: null,
      convertedLatex: res.latex,
      flagged: res.flagged,
      verified: false,
    });
    return res.latex ? `$${res.latex}$` : "";
  });
}

/**
 * Uploads any raw image buffers attached to xlsx rows (`_questionImageFile`
 * / `_solutionImageFile`) to Cloudinary. Xlsx has no equation-image concept
 * (see questionXlsxParser.js) — this only handles diagrams.
 */
async function resolveXlsxImages(rows, onProgress = async () => {}) {
  const questionImages = new Map();
  const solutionImages = new Map();

  const refs = [];
  for (const row of rows) {
    if (row._questionImageFile) refs.push({ rowNumber: row._rowNumber, kind: "question", file: row._questionImageFile });
    if (row._solutionImageFile) refs.push({ rowNumber: row._rowNumber, kind: "solution", file: row._solutionImageFile });
  }
  if (refs.length === 0) return { questionImages, solutionImages };

  await onProgress("uploading_images", 0, refs.length);
  let processed = 0;
  const outcomes = await runWithConcurrencyLimit(refs, 5, async (ref) => {
    let buffer = ref.file.buffer;
    if (RASTERIZABLE_EXTS.has((ref.file.ext || "").toLowerCase())) {
      const pngMap = await rasterizeToPng([{ id: "img", buffer, ext: ref.file.ext }]);
      buffer = pngMap.get("img") || null;
    }
    const result = buffer
      ? await uploadToCloudinary(buffer, `examneeti/${ref.kind === "question" ? "questions" : "solutions"}`).catch(() => null)
      : null;
    processed++;
    await onProgress("uploading_images", processed, refs.length);
    return { ...ref, result };
  });

  for (const outcome of outcomes) {
    if (!outcome.ok || !outcome.value.result) continue;
    const { rowNumber, kind, result } = outcome.value;
    if (kind === "question") questionImages.set(rowNumber, result);
    else solutionImages.set(rowNumber, [result]);
  }

  return { questionImages, solutionImages };
}

module.exports = {
  resolveDocxEquationsAndImages,
  resolveXlsxImages,
  spliceEquationPlaceholders,
};
