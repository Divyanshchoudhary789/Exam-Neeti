/**
 * question.routes.js
 *
 * All routes: authentication required + admin/super_admin only.
 *
 * Routes:
 *   POST   /questions/preview          — math conversion dry-run (no DB write)
 *   GET    /questions/stats            — dashboard counters
 *   GET    /questions/distinct         — dropdown autocomplete values
 *   PATCH  /questions/bulk-deactivate  — soft-delete multiple questions
 *   GET    /questions                  — paginated + filtered list
 *   POST   /questions                  — create question (multipart/form-data)
 *   GET    /questions/:id              — full doc (correctAnswer + solution)
 *   PATCH  /questions/:id              — update question (multipart/form-data)
 *   DELETE /questions/:id              — hard delete (blocked if used in exams)
 *
 * Multipart handling:
 *   - questionUpload (multer) runs BEFORE Joi validation on POST/PATCH
 *   - parseJsonFields() converts stringified JSON + bool/number fields from
 *     multipart text fields into proper JS types before Joi sees them
 */

"use strict";

const express    = require("express");
const router     = express.Router();
const Joi        = require("joi");

const questionController = require("../controllers/question.controller");
const authenticate       = require("../middleware/authenticate");
const authorize          = require("../middleware/authorize");
const validate           = require("../middleware/validate");
const { questionUpload } = require("../middleware/upload");
const {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsSchema,
} = require("../validators/question.validator");
const { ROLES } = require("../config/constants");

// ── Auth guard — applies to every route below ─────────────────────────────────
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

// ─── Static routes BEFORE /:id ────────────────────────────────────────────────

/**
 * POST /questions/preview
 * Math conversion dry-run — used by the admin UI to show live preview.
 * Accepts JSON body (no file upload needed for preview).
 */
const previewSchema = Joi.object({
  text:     Joi.string().allow(""),
  solution: Joi.object({ text: Joi.string().allow("") }),
  options:  Joi.array().items(
    Joi.object({ key: Joi.string().valid("A","B","C","D"), text: Joi.string().allow("") })
  ),
}).min(1);

router.post(
  "/preview",
  validate(previewSchema),
  questionController.previewMath
);

// GET /questions/stats
router.get("/stats", questionController.getStats);

// GET /questions/distinct?field=chapter[&subject=physics][&classLevel=XI]
router.get("/distinct", questionController.getDistinctValues);

// PATCH /questions/bulk-deactivate
router.patch("/bulk-deactivate", questionController.bulkDeactivate);

// ─── Collection routes ────────────────────────────────────────────────────────

// GET /questions
router.get(
  "/",
  validate(listQuestionsSchema, "query"),
  questionController.listQuestions
);

// POST /questions  — multipart/form-data
router.post(
  "/",
  questionUpload,
  parseJsonFields,
  validate(createQuestionSchema),
  questionController.createQuestion
);

// ─── Document routes ──────────────────────────────────────────────────────────

// GET /questions/:id
router.get("/:id", questionController.getQuestion);

// PATCH /questions/:id  — multipart/form-data
router.patch(
  "/:id",
  questionUpload,
  parseJsonFields,
  validate(updateQuestionSchema),
  questionController.updateQuestion
);

// DELETE /questions/:id
router.delete("/:id", questionController.deleteQuestion);

// ─── Multipart field parser ───────────────────────────────────────────────────

/**
 * Normalises multipart text fields into proper JS types before Joi validation.
 *
 * Multer memoryStorage gives all non-file fields as plain strings, so:
 *   "true" / "false"  → boolean
 *   "4" / "1.0"       → number
 *   JSON strings      → parsed objects/arrays
 */
function parseJsonFields(req, res, next) {
  const b = req.body;

  // Case normalisation for subject & difficulty
  if (typeof b.subject === "string") b.subject = b.subject.toLowerCase();
  if (typeof b.difficulty === "string") b.difficulty = b.difficulty.toLowerCase();

  // JSON fields (objects / arrays)
  for (const field of ["options", "solution"]) {
    if (b[field] && typeof b[field] === "string") {
      try { b[field] = JSON.parse(b[field]); } catch { /* Joi will reject */ }
    }
  }

  // Boolean fields
  const boolFields = [
    "hasLatex", "isActive",
    "removeQuestionImage",
    "removeSolutionImage", "removeSolutionImages",
    "removeOptionImage_A", "removeOptionImage_B",
    "removeOptionImage_C", "removeOptionImage_D",
  ];
  for (const f of boolFields) {
    if (b[f] === "true")  b[f] = true;
    if (b[f] === "false") b[f] = false;
  }

  // Number fields
  for (const f of ["marks", "negativeMarks", "idealTimeSeconds"]) {
    if (b[f] !== undefined && b[f] !== "") {
      const n = Number(b[f]);
      if (!isNaN(n)) b[f] = n;
    }
  }

  // solution.hasLatex (nested, comes as stringified JSON or flat field)
  if (b.solution && typeof b.solution === "object") {
    if (b.solution.hasLatex === "true")  b.solution.hasLatex = true;
    if (b.solution.hasLatex === "false") b.solution.hasLatex = false;
  }

  next();
}

module.exports = router;
