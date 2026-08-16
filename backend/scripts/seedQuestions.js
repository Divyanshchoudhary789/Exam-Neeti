/**
 * seedQuestions.js — Question Bank seeder with Cloudinary image upload.
 *
 * Usage:
 *   node scripts/seedQuestions.js --file seedData/questions/physics_xi_minor1.json
 *   node scripts/seedQuestions.js --file seedData/questions/physics_xi_minor1.json --dry-run
 *
 * What it does:
 *   1. Reads a JSON file of questions (see seedData/questions/_template.json)
 *   2. For each question, computes a SHA-256 contentHash
 *   3. Skips if that hash already exists in the DB (idempotent)
 *   4. Uploads any local images to Cloudinary, gets back URLs
 *   5. Inserts the question into the Question Bank DB
 *
 * Questions are seeded with patternSlotTags: [] (empty).
 * The reconstruction engine treats empty patternSlotTags as "eligible for any sprint",
 * so NO manual tagging step is needed after seeding. Just seed → create sprint → generate exam.
 *
 * Flags:
 *   --file     Path to JSON file (relative to backend/ folder) [required]
 *   --dry-run  Parse + validate but do NOT write to DB or Cloudinary
 */

require("dotenv").config();

const mongoose   = require("mongoose");
const crypto     = require("crypto");
const fs         = require("fs");
const path       = require("path");
const cloudinary = require("cloudinary").v2;

const connectDB          = require("../config/db");
const { questionSchema } = require("../models/Question.model");

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const fileArg  = args.find((a) => a.startsWith("--file="))?.split("=")[1]
              || args[args.indexOf("--file") + 1];
const isDryRun = args.includes("--dry-run");

if (!fileArg) {
  console.error("\n[Seed] ✖  --file argument is required.");
  console.error("  Example: node scripts/seedQuestions.js --file seedData/questions/physics_xi_minor1.json\n");
  process.exit(1);
}

// ─── Cloudinary config ────────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Computes SHA-256 of (subject + classLevel + chapter + topic + normalised text).
 * Used to detect duplicate questions across seeding runs.
 */
function computeContentHash(q) {
  const raw = [
    (q.subject    || "").toLowerCase().trim(),
    (q.classLevel || "").toLowerCase().trim(),
    (q.chapter    || "").toLowerCase().trim(),
    (q.topic      || "").toLowerCase().trim(),
    (q.text       || "").replace(/\s+/g, " ").trim(),
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Uploads a local image file to Cloudinary.
 * Returns { url, publicId } or { url: null, publicId: null } if no path given.
 */
async function uploadImage(localPath, folder) {
  if (!localPath) return { url: null, publicId: null };

  const absPath = path.resolve(__dirname, "..", localPath);

  if (!fs.existsSync(absPath)) {
    console.warn(`  [IMG] ⚠  File not found, skipping: ${absPath}`);
    return { url: null, publicId: null };
  }

  const result = await cloudinary.uploader.upload(absPath, {
    folder:          `examneeti/${folder}`,
    use_filename:    true,
    unique_filename: false,
    overwrite:       false,
    resource_type:   "image",
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Validates a raw JSON question object — throws if critical fields are missing.
 */
function validateRaw(q, index) {
  const required = ["subject", "classLevel", "chapter", "topic", "difficulty", "text", "correctAnswer", "marks"];
  for (const field of required) {
    if (q[field] === undefined || q[field] === null || q[field] === "") {
      throw new Error(`Q[${index}]: missing required field "${field}"`);
    }
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`Q[${index}]: "options" must be an array of exactly 4 items`);
  }
  if (!["A", "B", "C", "D"].includes(q.correctAnswer)) {
    throw new Error(`Q[${index}]: "correctAnswer" must be A, B, C, or D (got "${q.correctAnswer}")`);
  }
  const validDifficulties = ["easy", "medium", "hard"];
  if (!validDifficulties.includes(q.difficulty)) {
    throw new Error(`Q[${index}]: "difficulty" must be easy/medium/hard (got "${q.difficulty}")`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  // ── 1. Load JSON file ──────────────────────────────────────────────────────
  const filePath = path.resolve(__dirname, "..", fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`\n[Seed] ✖  File not found: ${filePath}\n`);
    process.exit(1);
  }

  let rawQuestions;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    rawQuestions  = JSON.parse(content);
  } catch (err) {
    console.error(`\n[Seed] ✖  Failed to parse JSON: ${err.message}\n`);
    process.exit(1);
  }

  // Remove template comment objects (keys starting with _comment)
  rawQuestions = rawQuestions.filter((q) => !Object.keys(q)[0]?.startsWith("_comment"));

  console.log(`\n[Seed] File     : ${fileArg}`);
  console.log(`[Seed] Questions: ${rawQuestions.length}`);
  console.log(`[Seed] Dry run  : ${isDryRun}`);

  // ── 2. Validate all questions first ───────────────────────────────────────
  console.log("\n[Seed] Validating...");
  rawQuestions.forEach((q, i) => validateRaw(q, i + 1));
  console.log("[Seed] ✔  All questions passed validation.");

  if (isDryRun) {
    console.log("\n[Seed] DRY RUN — no DB writes or Cloudinary uploads.\n");
    process.exit(0);
  }

  // ── 3. Connect to Question Bank DB ────────────────────────────────────────
  if (!process.env.QUESTION_BANK_MONGO_URI) {
    console.error("\n[Seed] ✖  QUESTION_BANK_MONGO_URI not set in .env\n");
    process.exit(1);
  }

  console.log("\n[Seed] Connecting to Question Bank DB...");
  const conn     = await connectDB(process.env.QUESTION_BANK_MONGO_URI, "Question Bank DB");
  const Question = conn.model("Question", questionSchema);
  console.log("[Seed] ✔  Connected.");

  // ── 4. Check Cloudinary config ────────────────────────────────────────────
  const cloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY    &&
    process.env.CLOUDINARY_API_SECRET;

  if (!cloudinaryConfigured) {
    console.warn("[Seed] ⚠  Cloudinary not configured — images will be skipped.");
  }

  // ── 5. Process each question ──────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  let errored  = 0;

  console.log("\n[Seed] Processing questions...\n");

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw   = rawQuestions[i];
    const num   = i + 1;
    const label = `Q${String(num).padStart(3, "0")}`;

    try {
      const hash = computeContentHash(raw);

      // ── Dedup check ──────────────────────────────────────────────────────
      const exists = await Question.findOne({ contentHash: hash }).lean();
      if (exists) {
        console.log(`  ${label} SKIP  (duplicate) — ${raw.text.slice(0, 60)}...`);
        skipped++;
        continue;
      }

      // ── Upload images ────────────────────────────────────────────────────
      let questionImage = { url: null, publicId: null };
      let solutionImage = { url: null, publicId: null };
      const solutionImages = [];
      const optionImages   = [null, null, null, null];

      if (cloudinaryConfigured) {
        if (raw.questionImage?.localPath) {
          process.stdout.write(`  ${label} Uploading question image...`);
          questionImage = await uploadImage(raw.questionImage.localPath, "questions");
          console.log(questionImage.url ? " ✔" : " skipped");
        }

        // Solution image — single string, array, or localImagePaths array
        if (raw.solution?.localImagePath) {
          if (Array.isArray(raw.solution.localImagePath)) {
            for (let si = 0; si < raw.solution.localImagePath.length; si++) {
              const imgPath = raw.solution.localImagePath[si];
              if (imgPath) {
                process.stdout.write(`  ${label} Uploading solution image [${si + 1}/${raw.solution.localImagePath.length}]...`);
                const uploaded = await uploadImage(imgPath, "solutions");
                if (uploaded.url) solutionImages.push(uploaded);
                console.log(uploaded.url ? " ✔" : " skipped");
              }
            }
          } else {
            process.stdout.write(`  ${label} Uploading solution image...`);
            solutionImage = await uploadImage(raw.solution.localImagePath, "solutions");
            console.log(solutionImage.url ? " ✔" : " skipped");
          }
        }

        if (Array.isArray(raw.solution?.localImagePaths) && raw.solution.localImagePaths.length > 0) {
          for (let si = 0; si < raw.solution.localImagePaths.length; si++) {
            const imgPath = raw.solution.localImagePaths[si];
            if (imgPath) {
              process.stdout.write(`  ${label} Uploading solution image [${si + 1}/${raw.solution.localImagePaths.length}]...`);
              const uploaded = await uploadImage(imgPath, "solutions");
              if (uploaded.url) solutionImages.push(uploaded);
              console.log(uploaded.url ? " ✔" : " skipped");
            }
          }
        }

        for (let oi = 0; oi < raw.options.length; oi++) {
          if (raw.options[oi]?.localImagePath) {
            process.stdout.write(`  ${label} Uploading option ${raw.options[oi].key} image...`);
            optionImages[oi] = await uploadImage(raw.options[oi].localImagePath, "options");
            console.log(optionImages[oi].url ? " ✔" : " skipped");
          }
        }
      }

      // ── Build document ───────────────────────────────────────────────────
      // patternSlotTags is intentionally left empty [].
      // Empty tags = "open pool" — eligible for any sprint automatically.
      const doc = {
        subject:          raw.subject,
        classLevel:       raw.classLevel,
        chapter:          raw.chapter,
        topic:            raw.topic,
        questionCategory: raw.questionCategory || "",
        questionVariant:  raw.questionVariant  || "",
        difficulty:       raw.difficulty,
        idealTimeSeconds: raw.idealTimeSeconds  || null,
        questionType:     raw.questionType      || "mcq",
        text:             raw.text,
        hasLatex:         raw.hasLatex          || false,
        questionImage,
        options: raw.options.map((opt, oi) => ({
          key:   opt.key,
          text:  opt.text || "",
          image: optionImages[oi] || { url: null, publicId: null },
        })),
        correctAnswer:   raw.correctAnswer,
        marks:           raw.marks,
        negativeMarks:   raw.negativeMarks || 0,
        solution: {
          text:     raw.solution?.text     || "",
          hasLatex: raw.solution?.hasLatex || false,
          image:    solutionImage,
          images:   solutionImages,
        },
        contentHash:     hash,
        sourceRef:       raw.sourceRef || "",
        patternSlotTags: [],   // empty = open pool, eligible for any sprint
        usageLog:        [],
        isActive:        true,
      };

      await Question.create(doc);
      console.log(`  ${label} ✔  Inserted — ${raw.text.slice(0, 65)}...`);
      inserted++;

    } catch (err) {
      console.error(`  ${label} ✖  Error: ${err.message}`);
      errored++;
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║         Seed Complete — Summary           ║");
  console.log("╠═══════════════════════════════════════════╣");
  console.log(`║  Total    : ${String(rawQuestions.length).padEnd(30)} ║`);
  console.log(`║  Inserted : ${String(inserted).padEnd(30)} ║`);
  console.log(`║  Skipped  : ${String(skipped).padEnd(30)} ║`);
  console.log(`║  Errors   : ${String(errored).padEnd(30)} ║`);
  console.log("╚═══════════════════════════════════════════╝\n");

  await conn.close();
  process.exit(errored > 0 ? 1 : 0);
}

seed().catch((err) => {
  console.error("\n[Seed] ✖  Fatal error:", err.message, "\n");
  process.exit(1);
});
