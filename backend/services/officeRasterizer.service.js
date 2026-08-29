/**
 * officeRasterizer.service.js
 *
 * Converts the WMF/EMF preview images Word embeds for legacy MathType
 * ("Equation.DSMT4") OLE equation objects into PNG, so they can be sent to
 * Gemini for LaTeX transcription. Also used for any other WMF/EMF picture
 * found in a bulk-upload source file.
 *
 * Implementation: shells out to LibreOffice headless (`soffice`). This is
 * the one new system dependency this whole feature needs — see the VPS
 * setup notes in QUESTION_BANK_API.md. LibreOffice has its own native
 * WMF/EMF import filters, so no extra ImageMagick/libwmf delegate packages
 * are required.
 *
 * Batching: LibreOffice's per-launch startup cost (JVM-ish boot, ~1-3s)
 * dominates over the actual conversion, so equation images are converted in
 * CHUNKS (one `soffice` invocation per chunk, multiple input paths) rather
 * than one process per image. Chunked rather than "everything in one call"
 * for two reasons, both found testing against a real 226-equation document:
 *   1. Progress visibility — with one giant call, the bulk-upload job's
 *      progress counter sat at 0/226 for the ENTIRE rasterization phase
 *      (several minutes), which looked indistinguishable from a hang even
 *      though it was working. Reporting after each chunk fixes that.
 *   2. Blast radius — one malformed embedded object anywhere in a 226-file
 *      batch risking the WHOLE batch's timeout is worse than risking one
 *      ~25-file chunk's timeout; the rest still convert normally.
 *
 * Concurrency safety: each chunk gets its own `-env:UserInstallation`
 * profile dir under the OS temp dir, so concurrent bulk uploads (or
 * concurrent chunks) never collide on LibreOffice's single-instance profile
 * lock.
 */

"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs   = require("fs/promises");
const path = require("path");
const os   = require("os");
const crypto = require("crypto");

const execFileAsync = promisify(execFile);

const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || "soffice";
const CONVERT_TIMEOUT_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS || 120000);
const CHUNK_SIZE = Number(process.env.LIBREOFFICE_CHUNK_SIZE || 25);

/**
 * Rasterizes ONE chunk. Never throws — a chunk that fails entirely (e.g.
 * LibreOffice itself unavailable, or every file in it malformed) resolves
 * every id in it to `null` instead, so the caller's progress loop and the
 * rest of the document's chunks are never affected by one bad chunk.
 */
async function rasterizeChunk(images) {
  const results = new Map();
  const workDir = path.join(os.tmpdir(), `examneeti-ole-${crypto.randomUUID()}`);
  const profileDir = path.join(workDir, "lo-profile");
  const inDir  = path.join(workDir, "in");
  const outDir = path.join(workDir, "out");

  try {
    await fs.mkdir(inDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });

    const idByBasename = new Map();
    for (const image of images) {
      const base = `eq-${image.id}`;
      idByBasename.set(base, image.id);
      await fs.writeFile(path.join(inDir, `${base}.${image.ext}`), image.buffer);
    }

    const inputFiles = images.map((image) => path.join(inDir, `eq-${image.id}.${image.ext}`));

    try {
      await execFileAsync(
        LIBREOFFICE_BIN,
        [
          "--headless",
          "--norestore",
          `-env:UserInstallation=file://${profileDir.replace(/\\/g, "/")}`,
          "--convert-to",
          "png",
          "--outdir",
          outDir,
          ...inputFiles,
        ],
        { timeout: CONVERT_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 10 }
      );
    } catch (err) {
      // LibreOffice can partially succeed even when it exits non-zero (e.g.
      // one malformed embedded object among several) — don't give up yet,
      // just check which output files actually exist below. Logged, not
      // thrown: a chunk-level failure degrades to "these equations need
      // manual review", it never aborts the upload.
      console.error(`[officeRasterizer] chunk of ${images.length} failed/partial: ${err.message}`);
    }

    for (const [base, id] of idByBasename) {
      try {
        results.set(id, await fs.readFile(path.join(outDir, `${base}.png`)));
      } catch {
        results.set(id, null); // this one specific equation didn't convert
      }
    }
  } catch (err) {
    console.error(`[officeRasterizer] chunk setup failed: ${err.message}`);
    for (const image of images) results.set(image.id, null);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  return results;
}

/**
 * @param {Array<{ id: string, buffer: Buffer, ext: "wmf"|"emf" }>} images
 * @param {(processed:number, total:number) => Promise<void>} [onProgress]
 *   Called after each chunk completes — use this for bulk-upload job
 *   progress instead of waiting on the whole thing at once.
 * @returns {Promise<Map<string, Buffer|null>>} id -> PNG buffer, or null if
 *   that specific image failed to convert (caller must treat as "flagged",
 *   never abort the whole batch over one bad embedded object).
 */
async function rasterizeToPng(images, onProgress = async () => {}) {
  const results = new Map();
  if (!images || images.length === 0) return results;

  let processed = 0;
  for (let i = 0; i < images.length; i += CHUNK_SIZE) {
    const chunk = images.slice(i, i + CHUNK_SIZE);
    const chunkResults = await rasterizeChunk(chunk);
    for (const [id, buffer] of chunkResults) results.set(id, buffer);
    processed += chunk.length;
    await onProgress(processed, images.length);
  }

  return results;
}

module.exports = { rasterizeToPng };
