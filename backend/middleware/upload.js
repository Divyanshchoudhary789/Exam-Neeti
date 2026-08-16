/**
 * upload.js — Multer + Cloudinary stream-upload middleware
 *
 * Strategy: files land in memory (never on disk) and are piped
 * directly to Cloudinary via the upload_stream API.
 * This keeps the server stateless and Render/cloud-compatible.
 *
 * Cloudinary folders used:
 *   examneeti/questions  — question images
 *   examneeti/solutions  — solution images
 *   examneeti/options    — option images
 *
 * Security controls:
 *   • Only jpeg / png / webp allowed
 *   • 5 MB per file hard limit
 *   • File count limits enforced per route via .fields() / .single()
 */

const multer  = require("multer");
const cloudinary = require("cloudinary").v2;
const AppError   = require("../utils/AppError");

// ─── Cloudinary config (read once at module load) ─────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Allowed MIME types ───────────────────────────────────────────────────────

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Multer — memory storage ──────────────────────────────────────────────────

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,    // max 10 files across all fields in one request
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(
        new AppError("Only JPEG, PNG, and WebP images are allowed.", 400),
        false
      );
    }
    cb(null, true);
  },
});

// ─── Cloudinary stream upload helper ─────────────────────────────────────────

/**
 * Uploads a single file buffer to Cloudinary.
 *
 * @param {Buffer}  buffer      File buffer from multer memoryStorage
 * @param {string}  folder      e.g. "examneeti/questions"
 * @param {string}  [publicId]  Optional existing publicId to overwrite
 * @returns {Promise<{ url: string, publicId: string }>}
 */
const uploadToCloudinary = (buffer, folder, publicId = null) => {
  return new Promise((resolve, reject) => {
    const opts = {
      folder,
      resource_type: "image",
      overwrite:     true,
      // Store as original quality but strip metadata for privacy
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };

    if (publicId) {
      // Keep the same public_id so existing URLs in other docs remain valid
      opts.public_id = publicId;
    }

    const stream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(new AppError(`Cloudinary upload failed: ${error.message}`, 502));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });

    stream.end(buffer);
  });
};

/**
 * Deletes an image from Cloudinary by its publicId.
 * Silently ignores "not found" errors — idempotent.
 *
 * @param {string} publicId
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    // Log but never throw — a failed delete should not block the main flow
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, err.message);
  }
};

// ─── Multer field configs ─────────────────────────────────────────────────────
// These match the multipart field names the frontend must use.

/**
 * For POST /questions and PATCH /questions/:id
 *
 * Fields:
 *   questionImage        — main question diagram (1 file)
 *   optionImage_A/B/C/D  — per-option images (1 file each)
 *   solutionImage        — single solution image (backward compat, 1 file)
 *   solutionImages       — multiple solution images (up to 6 files)
 */
const questionUpload = multerUpload.fields([
  { name: "questionImage",    maxCount: 1 },
  { name: "optionImage_A",    maxCount: 1 },
  { name: "optionImage_B",    maxCount: 1 },
  { name: "optionImage_C",    maxCount: 1 },
  { name: "optionImage_D",    maxCount: 1 },
  { name: "solutionImage",    maxCount: 1 },
  { name: "solutionImages",   maxCount: 6 },
]);

module.exports = {
  questionUpload,
  uploadToCloudinary,
  deleteFromCloudinary,
};
