/**
 * question.controller.js
 *
 * Production-ready CRUD for the Question Bank.
 * Accessible only to admin and super_admin roles (enforced in routes).
 *
 * Math processing pipeline (runs on every text field):
 *   Raw input → processAndValidateText() → { text: LaTeX string, hasLatex: bool }
 *
 * The processAndValidateText() function:
 *   1. Auto-detects input mode (pure LaTeX, pure math shorthand, natural sentence)
 *   2. Converts shorthand to proper LaTeX  (frac, sqrt, Greek letters, operators…)
 *   3. Validates every $...$ fragment with KaTeX server-side — throws on invalid
 *   4. Returns { text, hasLatex } — text is always stored ready for KaTeX rendering
 *
 * This means admins can write EITHER:
 *   - Raw shorthand:      "frac(1,2)mv^2"           → stored as "$\frac{1}{2}mv^2$"
 *   - Delimited LaTeX:    "$\frac{1}{2}mv^2$"        → shorthand inside $ also converted
 *   - Natural sentences:  "KE = frac(1,2)mv^2"       → stored as "KE = $\frac{1}{2}mv^2$"
 *
 * Other design principles:
 *  • Questions live in a SEPARATE DB — always use req.app.get("QuestionModel")
 *  • Images: browser → multer memory buffer → Cloudinary stream upload (no disk)
 *  • Old Cloudinary assets are destroyed on replace / remove (no orphans)
 *  • contentHash computed from RAW input text (before math conversion) for dedup
 *  • correctAnswer NEVER returned in list responses
 *  • Soft-delete via isActive; hard-delete blocked if usageLog not empty
 */

"use strict";

const mongoose      = require("mongoose");
const AppError      = require("../utils/AppError");
const asyncHandler  = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { uploadToCloudinary, deleteFromCloudinary }  = require("../middleware/upload");
const { processAndValidateText, validateLatex, processMathField } = require("../utils/mathParser");
const { computeContentHash }         = require("../utils/questionHash");
const { createQuestionSchema }       = require("../validators/question.validator");
const { parseQuestionsXlsx }         = require("../utils/questionXlsxParser");
const { parseQuestionsDocx }         = require("../utils/questionDocxParser");
const { getQuestionTemplateBuffer }  = require("../utils/questionTemplateGenerator");
const { ROLES }                      = require("../config/constants");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the QuestionModel or throws 503. */
const getQuestionModel = (req) => {
  const Q = req.app.get("QuestionModel");
  if (!Q) throw new AppError("Question bank connection is not available.", 503);
  return Q;
};

/**
 * Throws 403 unless the requester is super_admin OR owns the question.
 * super_admin already bypasses the route-level authorize() check, but that
 * only gates the ROUTE — this is the per-document check for the admin role.
 */
const assertOwnsQuestion = (req, question) => {
  if (req.user.role === ROLES.ADMIN &&
      String(question.createdBy?.userId || "") !== String(req.user.id)) {
    throw new AppError("You can only modify questions you created.", 403);
  }
};

/**
 * Uploads a file buffer to Cloudinary if it exists in req.files[fieldName].
 * Returns { url, publicId } on success, null if no file.
 * Deletes oldPublicId AFTER successful upload (no orphan on failure).
 */
const uploadField = async (files, fieldName, folder, oldPublicId = null) => {
  const fileArr = files?.[fieldName];
  if (!fileArr || fileArr.length === 0) return null;
  const result = await uploadToCloudinary(fileArr[0].buffer, folder, null);
  if (oldPublicId) await deleteFromCloudinary(oldPublicId);
  return result;
};

// ─── PREVIEW (math conversion dry-run) ───────────────────────────────────────

/**
 * POST /questions/preview
 *
 * Converts and validates math in submitted text fields WITHOUT saving anything.
 * Used by the admin UI to show a real-time preview of how the question will
 * look after conversion, and to surface KaTeX errors before the admin submits.
 *
 * Body: same shape as createQuestion but ALL fields optional.
 * Response: processed versions of every text field that was sent.
 */
exports.previewMath = asyncHandler(async (req, res) => {
  const { text, solution, options } = req.body;
  const preview = {};
  const errors  = {};

  // Question text
  if (text !== undefined) {
    try {
      preview.text = processAndValidateText(String(text));
    } catch (e) {
      errors.text = e.message;
    }
  }

  // Solution text
  if (solution?.text !== undefined) {
    try {
      preview.solution = processAndValidateText(String(solution.text));
    } catch (e) {
      errors.solution = e.message;
    }
  }

  // Option texts
  if (Array.isArray(options)) {
    preview.options = [];
    for (const opt of options) {
      if (opt?.text !== undefined) {
        try {
          preview.options.push({
            key:    opt.key,
            result: processAndValidateText(String(opt.text)),
          });
        } catch (e) {
          errors[`option_${opt.key}`] = e.message;
          preview.options.push({ key: opt.key, error: e.message });
        }
      }
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return res.status(hasErrors ? 422 : 200).json({
    success: !hasErrors,
    message: hasErrors
      ? "Some fields have math errors. See 'errors' for details."
      : "Math preview generated successfully.",
    data:   { preview },
    errors: hasErrors ? errors : undefined,
  });
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.createQuestion = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);
  const body  = req.body;
  const files = req.files || {};

  // ── 1. Math processing — convert all text fields ───────────────────────────
  const processedText     = processMathField(body.text,            "text");
  const processedSolText  = processMathField(body.solution?.text,  "solution.text");

  // Process option texts individually to give precise error locations
  const processedOptions = (body.options || []).map((opt) => {
    const proc = processMathField(opt.text, `option ${opt.key}`);
    return { key: opt.key, text: proc.text };
  });

  // ── 2. Compute contentHash from PROCESSED text (stable after conversion) ──
  const contentHash = computeContentHash({
    subject:    body.subject,
    classLevel: body.classLevel,
    chapter:    body.chapter,
    topic:      body.topic,
    text:       processedText.text,
  });

  const duplicate = await QuestionModel.findOne({ contentHash }).lean();
  if (duplicate) {
    return next(
      new AppError(
        `A question with identical classification and text already exists (ID: ${duplicate._id}).`,
        409
      )
    );
  }

  // ── 3. Upload images in parallel ──────────────────────────────────────────
  const [questionImage, solutionImage] = await Promise.all([
    uploadField(files, "questionImage", "examneeti/questions"),
    uploadField(files, "solutionImage", "examneeti/solutions"),
  ]);

  const solutionImages = await Promise.all(
    (files["solutionImages"] || []).map((f) =>
      uploadToCloudinary(f.buffer, "examneeti/solutions")
    )
  );

  const optionImageResults = {};
  await Promise.all(
    ["A", "B", "C", "D"].map(async (key) => {
      const img = await uploadField(files, `optionImage_${key}`, "examneeti/options");
      if (img) optionImageResults[key] = img;
    })
  );

  // ── 4. Build options with processed text + images ─────────────────────────
  const options = processedOptions.map((opt) => ({
    key:   opt.key,
    text:  opt.text,
    image: optionImageResults[opt.key] || { url: null, publicId: null },
  }));

  // ── 5. Build solution object ───────────────────────────────────────────────
  const solution = {
    text:     processedSolText.text,
    hasLatex: processedSolText.hasLatex || (body.solution?.hasLatex ?? false),
    image:    solutionImage || { url: null, publicId: null },
    images:   solutionImages,
  };

  // ── 6. Create document ─────────────────────────────────────────────────────
  const question = await QuestionModel.create({
    subject:          body.subject,
    classLevel:       body.classLevel,
    chapter:          body.chapter.trim(),
    topic:            body.topic.trim(),
    questionCategory: body.questionCategory || "",
    questionVariant:  body.questionVariant  || "",
    difficulty:       body.difficulty,
    idealTimeSeconds: body.idealTimeSeconds  ?? null,
    questionType:     body.questionType      || "mcq",
    text:             processedText.text,
    hasLatex:         processedText.hasLatex,
    questionImage:    questionImage || { url: null, publicId: null },
    options,
    correctAnswer:    body.correctAnswer,
    marks:            body.marks,
    negativeMarks:    body.negativeMarks ?? 0,
    solution,
    contentHash,
    sourceRef:        body.sourceRef || "",
    isActive:         body.isActive !== undefined ? body.isActive : true,
    // Manual single-add stays immediate-active — the admin already reviews
    // via the form + /questions/preview before submitting.
    status:           "active",
    createdBy:        { userId: req.user.id, email: req.user.email },
    patternSlotTags:  [],
    usageLog:         [],
  });

  return sendSuccess(res, 201, "Question created successfully.", { question });
});

// ─── LIST ─────────────────────────────────────────────────────────────────────

exports.listQuestions = asyncHandler(async (req, res) => {
  const QuestionModel         = getQuestionModel(req);
  const { page, limit, skip } = getPaginationParams(req.query);
  const q                     = req.query;

  const filter = {};
  if (q.subject)          filter.subject          = new RegExp("^" + q.subject.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
  if (q.classLevel)       filter.classLevel       = new RegExp("^" + q.classLevel.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
  if (q.difficulty)       filter.difficulty       = new RegExp("^" + q.difficulty.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
  if (q.questionCategory) filter.questionCategory = new RegExp(q.questionCategory.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (q.questionVariant)  filter.questionVariant  = new RegExp(q.questionVariant.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),  "i");
  if (q.sourceRef)        filter.sourceRef        = new RegExp(q.sourceRef.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),        "i");
  if (q.chapter)          filter.chapter          = new RegExp(q.chapter.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),          "i");
  if (q.topic)            filter.topic            = new RegExp(q.topic.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),            "i");

  if (q.isActive !== undefined) filter.isActive = q.isActive === "true" || q.isActive === true;
  if (q.hasLatex !== undefined) filter.hasLatex = q.hasLatex === "true" || q.hasLatex === true;
  if (q.status === "draft") {
    filter.status = "draft";
  } else if (q.status === "active") {
    // $ne:"draft" (not a strict "active" match) so pre-existing questions
    // with no status field at all (created before this field existed) still
    // show up under the "Active" filter — same reasoning as the exam-
    // selection query in questionReconstruction.service.js.
    filter.status = { $ne: "draft" };
  }

  // mine=true — scope to the requesting admin's OWN questions. The filter is
  // always derived from the authenticated req.user, never a client-supplied
  // id, so one admin can never query another's questions via this flag.
  const mine = q.mine === "true" || q.mine === true;
  if (mine) filter["createdBy.userId"] = req.user.id;

  if (q.search && q.search.trim()) {
    const escaped = q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [
      { text: rx },
      { chapter: rx },
      { topic: rx },
    ];
  }

  const sortField = q.sortBy    || "createdAt";
  const sortDir   = q.sortOrder === "asc" ? 1 : -1;

  const [questions, total] = await Promise.all([
    QuestionModel.find(filter)
      .select("-correctAnswer -solution -usageLog -patternSlotTags -contentHash")
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    QuestionModel.countDocuments(filter),
  ]);

  return sendPaginated(
    res, 200, "Questions fetched.",
    { questions },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── GET ONE ──────────────────────────────────────────────────────────────────

exports.getQuestion = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);
  const question = await QuestionModel.findById(req.params.id).lean();
  if (!question) return next(new AppError("Question not found.", 404));
  return sendSuccess(res, 200, "Question fetched.", { question });
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

exports.updateQuestion = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);

  const question = await QuestionModel.findById(req.params.id);
  if (!question) return next(new AppError("Question not found.", 404));

  assertOwnsQuestion(req, question);

  const body  = req.body;
  const files = req.files || {};

  // ── 1. Math processing for incoming text fields ────────────────────────────
  if (body.text !== undefined) {
    const proc     = processMathField(body.text, "text");
    question.text  = proc.text;
    // hasLatex overridden by processed result unless admin explicitly passed false
    question.hasLatex = body.hasLatex !== undefined ? body.hasLatex : proc.hasLatex;
  } else if (body.hasLatex !== undefined) {
    question.hasLatex = body.hasLatex;
  }

  // ── 2. Scalar field updates (non-text) ────────────────────────────────────
  const directFields = [
    "subject", "classLevel", "chapter", "topic",
    "questionCategory", "questionVariant", "difficulty",
    "idealTimeSeconds", "questionType",
    "correctAnswer", "marks", "negativeMarks",
    "sourceRef", "isActive", "status",
  ];
  for (const field of directFields) {
    if (body[field] !== undefined) question[field] = body[field];
  }

  // ── 3. Solution text processing ───────────────────────────────────────────
  const currentSolution = question.solution.toObject
    ? question.solution.toObject()
    : { ...(question.solution || {}) };

  if (body.solution?.text !== undefined) {
    const proc             = processMathField(body.solution.text, "solution.text");
    currentSolution.text   = proc.text;
    currentSolution.hasLatex = body.solution.hasLatex !== undefined
      ? body.solution.hasLatex
      : proc.hasLatex;
  } else if (body.solution?.hasLatex !== undefined) {
    currentSolution.hasLatex = body.solution.hasLatex;
  }

  // ── 4. Question image ─────────────────────────────────────────────────────
  if (body.removeQuestionImage) {
    await deleteFromCloudinary(question.questionImage?.publicId);
    question.questionImage = { url: null, publicId: null };
  } else if (files["questionImage"]) {
    const img = await uploadField(
      files, "questionImage", "examneeti/questions",
      question.questionImage?.publicId
    );
    if (img) question.questionImage = img;
  }

  // ── 5. Solution image (single) ────────────────────────────────────────────
  if (body.removeSolutionImage) {
    await deleteFromCloudinary(currentSolution.image?.publicId);
    currentSolution.image = { url: null, publicId: null };
  } else if (files["solutionImage"]) {
    const img = await uploadField(
      files, "solutionImage", "examneeti/solutions",
      currentSolution.image?.publicId
    );
    if (img) currentSolution.image = img;
  }

  // ── 6. Solution images (array) ────────────────────────────────────────────
  if (body.removeSolutionImages) {
    await Promise.all(
      (currentSolution.images || []).map((i) => deleteFromCloudinary(i.publicId))
    );
    currentSolution.images = [];
  } else if (files["solutionImages"]?.length > 0) {
    await Promise.all(
      (currentSolution.images || []).map((i) => deleteFromCloudinary(i.publicId))
    );
    currentSolution.images = await Promise.all(
      files["solutionImages"].map((f) => uploadToCloudinary(f.buffer, "examneeti/solutions"))
    );
  }

  question.solution = currentSolution;

  // ── 7. Option texts + images ──────────────────────────────────────────────
  const optMap = {};
  for (const opt of question.options) {
    optMap[opt.key] = opt.toObject ? opt.toObject() : { ...opt };
  }

  const incomingOptions = body.options;

  for (const key of ["A", "B", "C", "D"]) {
    // Text update with math processing
    if (incomingOptions) {
      const incoming = incomingOptions.find((o) => o.key === key);
      if (incoming && incoming.text !== undefined) {
        const proc      = processMathField(incoming.text, `option ${key}`);
        optMap[key].text = proc.text;
      }
    }

    // Image removal
    if (body[`removeOptionImage_${key}`]) {
      await deleteFromCloudinary(optMap[key]?.image?.publicId);
      if (optMap[key]) optMap[key].image = { url: null, publicId: null };
    } else if (files[`optionImage_${key}`]?.length > 0) {
      const img = await uploadField(
        files, `optionImage_${key}`, "examneeti/options",
        optMap[key]?.image?.publicId
      );
      if (img && optMap[key]) optMap[key].image = img;
    }
  }

  question.options = ["A", "B", "C", "D"].map((k) => optMap[k]);

  // ── 8. Recompute contentHash with latest text ─────────────────────────────
  const newHash = computeContentHash({
    subject:    question.subject,
    classLevel: question.classLevel,
    chapter:    question.chapter,
    topic:      question.topic,
    text:       question.text,
  });

  // Block if hash collides with a DIFFERENT document
  const collision = await QuestionModel.findOne({
    contentHash: newHash,
    _id: { $ne: question._id },
  }).lean();

  if (collision) {
    return next(
      new AppError(
        `Another question with identical classification and text already exists (ID: ${collision._id}).`,
        409
      )
    );
  }

  question.contentHash = newHash;

  await question.save();

  return sendSuccess(res, 200, "Question updated successfully.", { question });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

exports.deleteQuestion = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);

  const question = await QuestionModel.findById(req.params.id);
  if (!question) return next(new AppError("Question not found.", 404));

  assertOwnsQuestion(req, question);

  if (question.usageLog?.length > 0) {
    return next(
      new AppError(
        `This question has been used in ${question.usageLog.length} exam(s). ` +
        `Hard-delete is blocked. Use PATCH isActive=false (soft-delete) instead.`,
        409
      )
    );
  }

  // Delete all Cloudinary assets — non-blocking (allSettled)
  const cleanup = [];
  if (question.questionImage?.publicId)
    cleanup.push(deleteFromCloudinary(question.questionImage.publicId));
  if (question.solution?.image?.publicId)
    cleanup.push(deleteFromCloudinary(question.solution.image.publicId));
  for (const img of question.solution?.images || [])
    if (img.publicId) cleanup.push(deleteFromCloudinary(img.publicId));
  for (const opt of question.options || [])
    if (opt.image?.publicId) cleanup.push(deleteFromCloudinary(opt.image.publicId));

  await Promise.allSettled(cleanup);
  await question.deleteOne();

  return sendSuccess(res, 200, "Question deleted.", { deletedQuestionId: question._id });
});

// ─── BULK SOFT-DELETE ─────────────────────────────────────────────────────────

exports.bulkDeactivate = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError("Provide an array of question IDs.", 400));
  }
  if (ids.length > 100) {
    return next(new AppError("Maximum 100 IDs per bulk operation.", 400));
  }

  // Validate all IDs are 24-char hex ObjectIds before hitting DB
  const invalid = ids.filter((id) => !/^[a-f\d]{24}$/i.test(id));
  if (invalid.length > 0) {
    return next(new AppError(`Invalid IDs: ${invalid.slice(0, 5).join(", ")}`, 400));
  }

  // Non-owned IDs are silently excluded (not a hard 403) — friendlier for a
  // multi-select UI where the selection may span both owned and non-owned
  // rows. super_admin is unrestricted.
  const filter = { _id: { $in: ids } };
  if (req.user.role === ROLES.ADMIN) filter["createdBy.userId"] = req.user.id;

  const result = await QuestionModel.updateMany(
    filter,
    { $set: { isActive: false } }
  );

  return sendSuccess(res, 200, "Questions deactivated.", {
    matchedCount:  result.matchedCount,
    modifiedCount: result.modifiedCount,
  });
});

// ─── STATS ────────────────────────────────────────────────────────────────────

exports.getStats = asyncHandler(async (req, res) => {
  const QuestionModel = getQuestionModel(req);

  const [totalActive, totalInactive, bySubject, byDifficulty, byClass, recentlyAdded] =
    await Promise.all([
      QuestionModel.countDocuments({ isActive: true }),
      QuestionModel.countDocuments({ isActive: false }),
      QuestionModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$subject",    count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]),
      QuestionModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$difficulty", count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]),
      QuestionModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$classLevel", count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]),
      // Questions added in last 7 days
      QuestionModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

  return sendSuccess(res, 200, "Question bank stats.", {
    total:          totalActive + totalInactive,
    active:         totalActive,
    inactive:       totalInactive,
    recentlyAdded,
    bySubject:      Object.fromEntries(bySubject.map((s) => [s._id, s.count])),
    byDifficulty:   Object.fromEntries(byDifficulty.map((d) => [d._id, d.count])),
    byClass:        Object.fromEntries(byClass.map((c) => [c._id, c.count])),
  });
});

// ─── DISTINCT VALUES (dropdown / autocomplete) ────────────────────────────────

exports.getDistinctValues = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);

  const { field, subject, classLevel } = req.query;
  const allowed = ["chapter", "topic", "questionCategory", "questionVariant", "sourceRef"];

  if (!allowed.includes(field)) {
    return next(new AppError(`Invalid field. Allowed: ${allowed.join(", ")}.`, 400));
  }

  const filter = { isActive: true };
  if (subject)    filter.subject    = subject;
  if (classLevel) filter.classLevel = classLevel;

  const values = await QuestionModel.distinct(field, filter);

  return sendSuccess(res, 200, `Distinct ${field} values.`, {
    field,
    values: values.filter(Boolean).sort(),
  });
});

// ─── BULK UPLOAD ────────────────────────────────────────────────────────────────

const MAX_BULK_ROWS = 200;

/**
 * Normalises a free-typed class level ("xi", "XI", "Dropper", ...) to the
 * exact enum casing the schema expects. Unrecognised input passes through
 * unchanged so Joi's enum validation produces a clear error for that row.
 */
function normalizeClassLevel(v) {
  const s = String(v || "").trim();
  if (/^xi$/i.test(s))      return "XI";
  if (/^xii$/i.test(s))     return "XII";
  if (/^dropper$/i.test(s)) return "dropper";
  return s;
}

/**
 * Reshapes one flat parsed row (field:string) into a createQuestionSchema-
 * shaped candidate. Joi + processMathField validate/convert it next — this
 * function only reshapes, it does not validate.
 */
function buildCandidateFromRawRow(row) {
  return {
    subject:          (row.subject || "").toLowerCase().trim(),
    classLevel:       normalizeClassLevel(row.classLevel),
    chapter:          (row.chapter || "").trim(),
    topic:            (row.topic || "").trim(),
    questionCategory: (row.questionCategory || "").trim(),
    questionVariant:  (row.questionVariant  || "").trim(),
    difficulty:       (row.difficulty || "").toLowerCase().trim(),
    idealTimeSeconds:
      row.idealTimeSeconds && String(row.idealTimeSeconds).trim() !== ""
        ? row.idealTimeSeconds
        : null,
    questionType: "mcq",
    text: (row.questionText || "").trim(),
    options: [
      { key: "A", text: (row.optionA || "").trim() },
      { key: "B", text: (row.optionB || "").trim() },
      { key: "C", text: (row.optionC || "").trim() },
      { key: "D", text: (row.optionD || "").trim() },
    ],
    correctAnswer: (row.correctAnswer || "").toUpperCase().trim(),
    marks: row.marks,
    negativeMarks:
      row.negativeMarks && String(row.negativeMarks).trim() !== ""
        ? row.negativeMarks
        : 0,
    solution: {
      text: (row.solutionText || "").trim(),
      hasLatex: false,
    },
    sourceRef: (row.sourceRef || "").trim(),
    isActive: true,
  };
}

/**
 * POST /questions/bulk-upload
 *
 * Parses an uploaded .docx or .xlsx file (template format only — see
 * questionDocxParser.js / questionXlsxParser.js) into rows, validates each
 * row through the SAME Joi schema + math pipeline the single-question create
 * flow uses, and inserts every valid, non-duplicate row as a "draft"
 * question (no images — those get added later during review). One bad row
 * never aborts the batch: every row succeeds, is skipped as a duplicate, or
 * fails independently, and all three outcomes are reported back so the
 * admin knows exactly what to fix and re-upload.
 */
exports.bulkUploadQuestions = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);

  if (!req.file) {
    return next(new AppError('No file uploaded. Attach a .docx or .xlsx file as "file".', 400));
  }

  const isXlsx = req.file.mimetype ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const rawRows = isXlsx
    ? await parseQuestionsXlsx(req.file.buffer)
    : await parseQuestionsDocx(req.file.buffer);

  if (rawRows.length > MAX_BULK_ROWS) {
    return next(new AppError(
      `Too many questions in one file (${rawRows.length}). Maximum ${MAX_BULK_ROWS} per upload.`,
      400
    ));
  }

  const batchId    = new mongoose.Types.ObjectId();
  const uploadedAt = new Date();

  const docsToInsert       = [];
  const rowNumbers         = []; // parallel to docsToInsert — maps back to source row for error reporting
  const failed             = [];
  const skippedDuplicates  = [];
  const seenHashes         = new Map(); // contentHash -> rowNumber, catches duplicates WITHIN this file

  for (const rawRow of rawRows) {
    const rowNumber = rawRow._rowNumber;
    const candidate = buildCandidateFromRawRow(rawRow);

    const { error, value } = createQuestionSchema.validate(candidate, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      failed.push({
        row: rowNumber,
        errors: error.details.map((d) => d.message.replace(/"/g, "'")),
      });
      continue;
    }

    try {
      const processedText = processMathField(value.text, "Question Text");
      const processedSol  = processMathField(value.solution?.text, "Solution Text");
      const processedOptions = value.options.map((opt) => ({
        key: opt.key,
        text: processMathField(opt.text, `Option ${opt.key}`).text,
      }));

      const contentHash = computeContentHash({
        subject:    value.subject,
        classLevel: value.classLevel,
        chapter:    value.chapter,
        topic:      value.topic,
        text:       processedText.text,
      });

      if (seenHashes.has(contentHash)) {
        skippedDuplicates.push({
          row: rowNumber,
          reason: `Duplicate of row ${seenHashes.get(contentHash)} in this same file.`,
        });
        continue;
      }
      seenHashes.set(contentHash, rowNumber);

      docsToInsert.push({
        subject:          value.subject,
        classLevel:       value.classLevel,
        chapter:          value.chapter,
        topic:            value.topic,
        questionCategory: value.questionCategory || "",
        questionVariant:  value.questionVariant  || "",
        difficulty:       value.difficulty,
        idealTimeSeconds: value.idealTimeSeconds ?? null,
        questionType:     value.questionType || "mcq",
        text:             processedText.text,
        hasLatex:         processedText.hasLatex,
        questionImage:    { url: null, publicId: null },
        options: processedOptions.map((o) => ({
          key: o.key,
          text: o.text,
          image: { url: null, publicId: null },
        })),
        correctAnswer:    value.correctAnswer,
        marks:            value.marks,
        negativeMarks:    value.negativeMarks ?? 0,
        solution: {
          text:     processedSol.text,
          hasLatex: processedSol.hasLatex,
          image:    { url: null, publicId: null },
          images:   [],
        },
        contentHash,
        sourceRef:       value.sourceRef || "",
        isActive:        true,
        status:          "draft",
        createdBy:       { userId: req.user.id, email: req.user.email },
        uploadBatch:     { batchId, fileName: req.file.originalname, uploadedAt },
        patternSlotTags: [],
        usageLog:        [],
      });
      rowNumbers.push(rowNumber);
    } catch (err) {
      // processMathField throws AppError with a field-scoped, actionable message
      failed.push({ row: rowNumber, errors: [err.message || "Invalid data."] });
    }
  }

  // ── One dedup query against the DB (not one findOne per row) ───────────────
  if (docsToInsert.length > 0) {
    const hashes = docsToInsert.map((d) => d.contentHash);
    const existingHashes = new Set(
      await QuestionModel.distinct("contentHash", { contentHash: { $in: hashes } })
    );
    if (existingHashes.size > 0) {
      const keptDocs = [];
      const keptRowNumbers = [];
      docsToInsert.forEach((doc, idx) => {
        if (existingHashes.has(doc.contentHash)) {
          skippedDuplicates.push({
            row: rowNumbers[idx],
            reason: "A question with identical classification and text already exists in the bank.",
          });
        } else {
          keptDocs.push(doc);
          keptRowNumbers.push(rowNumbers[idx]);
        }
      });
      docsToInsert.length = 0;
      docsToInsert.push(...keptDocs);
      rowNumbers.length = 0;
      rowNumbers.push(...keptRowNumbers);
    }
  }

  // ── One bulk write ──────────────────────────────────────────────────────────
  let createdIds = [];
  if (docsToInsert.length > 0) {
    try {
      const inserted = await QuestionModel.insertMany(docsToInsert, { ordered: false });
      createdIds = inserted.map((d) => d._id);
    } catch (err) {
      // Rare race: a duplicate contentHash slipped in between the distinct()
      // check above and this write. Mongoose surfaces this as a bulk-write
      // error with writeErrors[].index (position in docsToInsert) and
      // insertedDocs (the ones that DID succeed).
      if (err.writeErrors) {
        const failedIdx = new Set(err.writeErrors.map((we) => we.index));
        docsToInsert.forEach((doc, idx) => {
          if (failedIdx.has(idx)) {
            skippedDuplicates.push({
              row: rowNumbers[idx],
              reason: "A question with identical classification and text already exists in the bank.",
            });
          }
        });
        createdIds = (err.insertedDocs || []).map((d) => d._id);
      } else {
        throw err;
      }
    }
  }

  return sendSuccess(res, 201, "Bulk upload processed.", {
    totalRows:    rawRows.length,
    createdCount: createdIds.length,
    created:      createdIds,
    skippedDuplicates,
    failed,
  });
});

// ─── DOWNLOAD SAMPLE TEMPLATE ─────────────────────────────────────────────────

/**
 * GET /questions/template?format=docx|xlsx
 * Streams a generated sample bulk-upload file with instructions and 2 worked
 * examples (one plain-text, one demonstrating inline LaTeX).
 */
exports.getQuestionTemplate = asyncHandler(async (req, res) => {
  const { format } = req.query; // validated by templateQuerySchema
  const buffer = await getQuestionTemplateBuffer(format);

  const contentType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const filename = `exam-neeti-question-upload-template.${format}`;

  res.setHeader("Content-Type",        contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length",      buffer.length);
  return res.send(buffer);
});
