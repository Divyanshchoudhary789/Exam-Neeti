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
 * dominates over the actual conversion, so every equation image in ONE
 * uploaded file is converted in a SINGLE `soffice` invocation (multiple
 * input paths, one `--outdir`) rather than one process per image — critical
 * for documents with 100+ equations.
 *
 * Concurrency safety: each call gets its own `-env:UserInstallation` profile
 * dir under the OS temp dir, so two bulk uploads converting at the same time
 * never collide on LibreOffice's single-instance profile lock.
 */

"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");
const fs   = require("fs/promises");
const path = require("path");
const os   = require("os");
const crypto = require("crypto");

const AppError = require("../utils/AppError");

const execFileAsync = promisify(execFile);

const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || "soffice";
const CONVERT_TIMEOUT_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS || 120000);

/**
 * @param {Array<{ id: string, buffer: Buffer, ext: "wmf"|"emf" }>} images
 * @returns {Promise<Map<string, Buffer|null>>} id -> PNG buffer, or null if
 *   that specific image failed to convert (caller must treat as "flagged",
 *   never abort the whole batch over one bad embedded object).
 */
async function rasterizeToPng(images) {
  const results = new Map();
  if (!images || images.length === 0) return results;

  const workDir = path.join(os.tmpdir(), `examneeti-ole-${crypto.randomUUID()}`);
  const profileDir = path.join(workDir, "lo-profile");
  const inDir  = path.join(workDir, "in");
  const outDir = path.join(workDir, "out");

  await fs.mkdir(inDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  // id -> source file path, so we can map converted PNGs back after the run
  // (LibreOffice names output files after the input's basename).
  const idByBasename = new Map();

  try {
    for (const img of images) {
      const base = `eq-${img.id}`;
      idByBasename.set(base, img.id);
      await fs.writeFile(path.join(inDir, `${base}.${img.ext}`), img.buffer);
    }

    const inputFiles = images.map((img) => path.join(inDir, `eq-${img.id}.${img.ext}`));

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
      // one malformed embedded object among many) — don't throw yet, just
      // fall through and see which output files actually exist below.
      // Only hard-fail if NOTHING was produced at all.
      const produced = await fs.readdir(outDir).catch(() => []);
      if (produced.length === 0) {
        throw new AppError(
          `Equation image rasterization failed (LibreOffice): ${err.message}`,
          502
        );
      }
    }

    for (const [base, id] of idByBasename) {
      const pngPath = path.join(outDir, `${base}.png`);
      try {
        results.set(id, await fs.readFile(pngPath));
      } catch {
        results.set(id, null); // this one specific equation didn't convert
      }
    }

    return results;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { rasterizeToPng };
