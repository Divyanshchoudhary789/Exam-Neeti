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
const uploadToCloudinary = (buffer, folder, publicId = null, resourceType = "image") => {
  return new Promise((resolve, reject) => {
    const opts = {
      folder,
      resource_type: resourceType,
      overwrite:     true,
    };
    // Image-only optimisation; "raw"/"auto" (PDFs, docs) must not be transformed.
    if (resourceType === "image") {
      opts.transformation = [{ quality: "auto", fetch_format: "auto" }];
    }

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
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
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

// ─── Bulk question upload (.docx / .xlsx) — separate config, separate rules ───
// Not an image upload: different mimetypes, different size ceiling, single file.

const ALLOWED_BULK_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
]);
const MAX_BULK_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const bulkQuestionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BULK_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_BULK_MIME.has(file.mimetype)) {
      return cb(
        new AppError("Only .docx or .xlsx files are allowed.", 400),
        false
      );
    }
    cb(null, true);
  },
}).single("file");

// Same shape as bulkQuestionUpload — a single .docx/.xlsx roster for bulk
// student import.
const bulkStudentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BULK_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_BULK_MIME.has(file.mimetype)) {
      return cb(new AppError("Only .docx or .xlsx files are allowed.", 400), false);
    }
    cb(null, true);
  },
}).single("file");

// ── Content Hub (blogs + resources) uploads ─────────────────────────────────
// coverImage — blog / resource cover (image only)
// file       — resource attachment (image OR pdf / office doc)
const CONTENT_IMAGE_MIME = /^image\/(png|jpe?g|webp|gif)$/;
const CONTENT_FILE_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "text/plain",
]);
const contentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "coverImage") {
      return CONTENT_IMAGE_MIME.test(file.mimetype)
        ? cb(null, true)
        : cb(new AppError("Cover image must be a PNG, JPG, WEBP or GIF.", 400), false);
    }
    if (file.fieldname === "file") {
      return (CONTENT_IMAGE_MIME.test(file.mimetype) || CONTENT_FILE_MIME.has(file.mimetype))
        ? cb(null, true)
        : cb(new AppError("Attachment must be a PDF, Office document, image or text file.", 400), false);
    }
    return cb(new AppError(`Unexpected file field "${file.fieldname}".`, 400), false);
  },
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// Single inline image for the blog block editor (image blocks). Image only.
const contentImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    CONTENT_IMAGE_MIME.test(file.mimetype)
      ? cb(null, true)
      : cb(new AppError("Image must be a PNG, JPG, WEBP or GIF.", 400), false),
}).single("image");

module.exports = {
  questionUpload,
  bulkQuestionUpload,
  bulkStudentUpload,
  contentUpload,
  contentImageUpload,
  uploadToCloudinary,
  deleteFromCloudinary,
};
