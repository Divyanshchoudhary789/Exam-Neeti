/**
 * extractDocx.js — Extracts images from a .docx question paper file.
 *
 * Usage:
 *   node scripts/extractDocx.js --file "path/to/Paper.docx" --prefix "physics_xii_minor1"
 *   node scripts/extractDocx.js --file "path/to/Paper.docx" --prefix "chemistry_xi_minor1" --min-size 2
 *
 * What it does:
 *   1. Creates subfolders:
 *        seedData/images/questions/<prefix>/   ← all extracted images saved here
 *        seedData/images/solutions/<prefix>/   ← empty, ready for manual placement
 *   2. Extracts all media from word/media/ inside the .docx ZIP
 *   3. Detects REAL format via magic bytes (Word often embeds JPEGs as .wmf etc.)
 *   4. PNG / JPG / GIF / BMP / WebP  → saved as-is with correct extension
 *   5. EMF / WMF (vector metafiles)  → conversion attempted via sharp at 150 DPI
 *        If conversion fails          → saved as .emf/.wmf with a ⚠  warning
 *   6. Files below --min-size threshold → skipped (Word UI arrows, bullets, math symbols)
 *   7. Sequential numbering with NO GAPS — every file that passes the size threshold
 *      gets a unique _img_001, _img_002, ... number regardless of format
 *
 * Flags:
 *   --file        Path to .docx (absolute or relative to cwd)  [required]
 *   --prefix      Output prefix, e.g. physics_xii_minor1       [required]
 *   --min-size    Minimum size in KB to keep (default: 3)
 */

require("dotenv").config();

const fs             = require("fs");
const path           = require("path");
const { execSync }   = require("child_process");

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const fileArg    = getArg("file");
const prefixArg  = (getArg("prefix") || "extracted").trim();
const minSizeKB  = parseInt(getArg("min-size") || "3", 10);

if (!fileArg) {
  console.error('\n[Extract] ✖  --file is required.');
  console.error('  node scripts/extractDocx.js --file "Paper.docx" --prefix physics_xii_minor1\n');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitise(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Detect raster format from magic bytes. Returns 'png'|'jpg'|'gif'|'bmp'|'webp'|null */
function detectRaster(buf) {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf[0] === 0x42 && buf[1] === 0x4D) return "bmp";
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) return "webp";
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function extract() {

  // Load JSZip
  let JSZip;
  try { JSZip = require("jszip"); } catch {
    console.error("\n[Extract] ✖  jszip missing. Run: npm install jszip --save-dev\n");
    process.exit(1);
  }

  // Load sharp (optional)
  let sharp = null;
  try { sharp = require("sharp"); } catch {
    console.warn("[Extract] ⚠  sharp not found — EMF/WMF will be saved as-is.");
    console.warn("            Run: npm install  (sharp is already in package.json)\n");
  }

  // Detect Python + Pillow availability (used for EMF/WMF → PNG conversion)
  let pythonOk = false;
  try {
    execSync('python -c "from PIL import Image; print(1)"', { stdio: "pipe" });
    pythonOk = true;
    console.log("[Extract] ✔  Python + Pillow detected — EMF/WMF will be auto-converted to PNG");
  } catch {
    console.warn("[Extract] ⚠  Python/Pillow not found — EMF/WMF auto-conversion unavailable");
    console.warn("            To enable: pip install Pillow\n");
  }

  // Resolve file path
  const filePath = path.isAbsolute(fileArg)
    ? fileArg
    : path.resolve(process.cwd(), fileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`\n[Extract] ✖  Not found: ${filePath}\n`);
    process.exit(1);
  }

  const folder       = sanitise(prefixArg);
  const minSizeBytes = minSizeKB * 1024;

  // Create output dirs
  const qDir = path.resolve(__dirname, "..", "seedData", "images", "questions", folder);
  const sDir = path.resolve(__dirname, "..", "seedData", "images", "solutions", folder);
  fs.mkdirSync(qDir, { recursive: true });
  fs.mkdirSync(sDir, { recursive: true });

  console.log(`\n[Extract] Source    : ${filePath}`);
  console.log(`[Extract] Output    : seedData/images/questions/${folder}/`);
  console.log(`[Extract] Solutions : seedData/images/solutions/${folder}/  (empty — for manual placement)`);
  console.log(`[Extract] Min size  : ${minSizeKB} KB`);
  console.log(`[Extract] Prefix    : ${folder}\n`);

  // Open docx
  const buffer = fs.readFileSync(filePath);
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    console.error(`\n[Extract] ✖  Cannot open as DOCX: ${e.message}\n`);
    process.exit(1);
  }

  // Collect word/media/* files, sorted by natural number order
  const known = new Set([".png",".jpg",".jpeg",".gif",".bmp",".webp",".wmf",".emf",".svg"]);
  const media = Object.keys(zip.files)
    .filter((n) => {
      if (zip.files[n].dir) return false;
      const lo = n.toLowerCase();
      return lo.startsWith("word/media/") && known.has(path.extname(lo));
    })
    .sort((a, b) => {
      const na = parseInt((path.basename(a).match(/\d+/) || ["0"])[0], 10);
      const nb = parseInt((path.basename(b).match(/\d+/) || ["0"])[0], 10);
      return na - nb;
    });

  if (media.length === 0) {
    console.log("[Extract] ℹ  No images found.\n");
    process.exit(0);
  }

  console.log(`[Extract] Found ${media.length} media file(s) in document.\n`);

  // ── Process ───────────────────────────────────────────────────────────────
  let seq          = 0;   // sequential counter — incremented for every file that passes size filter
  let saved        = 0;
  let converted    = 0;
  let warnVec      = 0;
  let skipped      = 0;
  const savedPaths = [];

  for (let i = 0; i < media.length; i++) {
    const entry  = media[i];
    const srcExt = path.extname(entry).toLowerCase();
    const srcName = path.basename(entry);
    const buf    = await zip.files[entry].async("nodebuffer");
    const kb     = Math.round(buf.length / 1024);
    const idx    = String(i + 1).padStart(3, "0");   // display index (1-based, matches docx order)

    // ── Skip tiny files ───────────────────────────────────────────────────
    if (buf.length < minSizeBytes) {
      console.log(`  [${idx}] SKIP   ${srcName}  (${kb} KB — below ${minSizeKB} KB, Word UI graphic)`);
      skipped++;
      continue;
    }

    // Every file that passes size check gets the next sequential number
    seq++;
    const seqStr = String(seq).padStart(3, "0");

    // ── Raster via magic bytes ─────────────────────────────────────────────
    const fmt = detectRaster(buf);
    if (fmt) {
      const name    = `${folder}_img_${seqStr}.${fmt}`;
      const outPath = path.join(qDir, name);
      fs.writeFileSync(outPath, buf);
      const rel = `seedData/images/questions/${folder}/${name}`;
      savedPaths.push(rel);
      console.log(`  [${idx}] ✔  ${name}  (${kb} KB)`);
      saved++;
      continue;
    }

    // ── SVG ───────────────────────────────────────────────────────────────
    if (srcExt === ".svg") {
      const name    = `${folder}_img_${seqStr}.svg`;
      const outPath = path.join(qDir, name);
      fs.writeFileSync(outPath, buf);
      const rel = `seedData/images/questions/${folder}/${name}`;
      savedPaths.push(rel);
      console.log(`  [${idx}] ✔  ${name}  (${kb} KB — SVG)`);
      saved++;
      continue;
    }

    // ── EMF / WMF → PNG via Python/Pillow ────────────────────────────────
    if (srcExt === ".emf" || srcExt === ".wmf") {
      const pngName    = `${folder}_img_${seqStr}.png`;
      const pngOutPath = path.join(qDir, pngName);
      const tmpPath    = path.join(qDir, `__tmp_${seqStr}${srcExt}`);

      let convOk = false;

      // ── Method 1: Python + Pillow (most reliable for EMF/WMF on Windows) ──
      if (pythonOk) {
        try {
          fs.writeFileSync(tmpPath, buf);
          // Inline Python: open EMF/WMF with Pillow, save as PNG
          const pyScript = [
            "from PIL import Image",
            `img = Image.open(r'${tmpPath.replace(/\\/g, "\\\\")}')`,
            `img.save(r'${pngOutPath.replace(/\\/g, "\\\\")}', 'PNG')`,
          ].join("; ");
          execSync(`python -c "${pyScript}"`, { stdio: "pipe" });
          if (fs.existsSync(pngOutPath) && fs.statSync(pngOutPath).size > 0) {
            convOk = true;
          }
        } catch { /* fall through */ }
        finally {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
      }

      // ── Method 2: sharp fallback (rarely works for WMF/EMF but worth trying)
      if (!convOk && sharp) {
        try {
          fs.writeFileSync(tmpPath, buf);
          await sharp(tmpPath, { density: 150 }).png({ compressionLevel: 6 }).toFile(pngOutPath);
          if (fs.existsSync(pngOutPath) && fs.statSync(pngOutPath).size > 0) {
            convOk = true;
          }
        } catch { /* fall through */ }
        finally {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
      }

      if (convOk) {
        const outKb = Math.round(fs.statSync(pngOutPath).size / 1024);
        const rel   = `seedData/images/questions/${folder}/${pngName}`;
        savedPaths.push(rel);
        console.log(`  [${idx}] ✔  ${pngName}  (converted from ${srcExt.toUpperCase()}, ${outKb} KB)`);
        saved++;
        converted++;
        continue;
      }

      // ── Both methods failed — save raw file so nothing is lost ────────────
      const rawName    = `${folder}_img_${seqStr}${srcExt}`;
      const rawOutPath = path.join(qDir, rawName);
      fs.writeFileSync(rawOutPath, buf);
      console.log(`  [${idx}] ⚠  ${rawName}  (${kb} KB — conversion failed, kept as-is)`);
      warnVec++;
      continue;
    }

    // ── Unknown format ────────────────────────────────────────────────────
    console.log(`  [${idx}] SKIP   ${srcName}  (${kb} KB — unrecognised format)`);
    skipped++;
    seq--; // undo increment — unknown formats don't consume a sequence number
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║            Extraction Complete — Summary              ║");
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║  Total in docx      : ${String(media.length).padEnd(32)}║`);
  console.log(`║  Saved as PNG/JPG   : ${String(saved).padEnd(32)}║`);
  console.log(`║  EMF/WMF → PNG      : ${String(converted).padEnd(32)}║`);
  console.log(`║  EMF/WMF kept raw   : ${String(warnVec).padEnd(32)}║`);
  console.log(`║  Skipped (tiny)     : ${String(skipped).padEnd(32)}║`);
  console.log("╚═══════════════════════════════════════════════════════╝");

  if (warnVec > 0) {
    console.log("\n⚠  Some EMF/WMF files could not be auto-converted to PNG.");
    console.log("   Options:");
    console.log("   1. Open in LibreOffice Draw → Export as PNG → rename to match _img_XXX.png");
    console.log("   2. Open in Inkscape → File > Export PNG Image");
    console.log("   3. Use an online converter: https://cloudconvert.com/emf-to-png");
  }

  if (savedPaths.length > 0) {
    console.log("\n─── JSON localPath examples ──────────────────────────────────────────");
    console.log(`\n  Question image (one):`);
    console.log(`    "questionImage": { "localPath": "${savedPaths[0]}" }`);
    console.log(`\n  Question image (none):`);
    console.log(`    "questionImage": { "localPath": null }`);
    console.log(`\n  Solution — single image:`);
    console.log(`    "solution": {`);
    console.log(`      "text": "...", "hasLatex": false,`);
    console.log(`      "localImagePath": "seedData/images/solutions/${folder}/${folder}_sol_001.png"`);
    console.log(`    }`);
    console.log(`\n  Solution — multiple images:`);
    console.log(`    "solution": {`);
    console.log(`      "text": "...", "hasLatex": true,`);
    console.log(`      "localImagePaths": [`);
    console.log(`        "seedData/images/solutions/${folder}/${folder}_sol_001.png",`);
    console.log(`        "seedData/images/solutions/${folder}/${folder}_sol_002.png"`);
    console.log(`      ]`);
    console.log(`    }`);
    console.log(`\n  Option image:`);
    console.log(`    { "key": "A", "text": "", "localImagePath": "${savedPaths[0]}" }`);
    console.log("\n──────────────────────────────────────────────────────────────────────");
    console.log(`\n  Extracted : seedData/images/questions/${folder}/`);
    console.log(`  Solutions : seedData/images/solutions/${folder}/  ← copy images here manually`);
    console.log("");
  }
}

extract().catch((e) => {
  console.error("\n[Extract] ✖  Fatal:", e.message, "\n");
  process.exit(1);
});
