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
const { validateAndNormalizeCustomFields } = require("../utils/customFieldValidation");
const QuestionFieldDefinition        = require("../models/QuestionFieldDefinition.model");
const { parseQuestionsXlsx }         = require("../utils/questionXlsxParser");
const {
  parseQuestionsDocx,
  parseRichQuestionsDocx,
  detectDocxTemplateFormat,
}                                     = require("../utils/questionDocxParser");
const { getQuestionTemplateBuffer }  = require("../utils/questionTemplateGenerator");
const {
  resolveDocxEquationsAndImages,
  resolveXlsxImages,
}                                     = require("../services/bulkUploadOrchestrator.service");
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

/** Builds one activityLog entry from the authenticated requester. */
const makeActivityEntry = (req, action, meta = {}) => ({
  action,
  byUserId: req.user.id,
  byEmail:  req.user.email,
  byRole:   req.user.role,
  at:       new Date(),
  meta,
});

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

  // ── 2b. Validate + normalize admin-defined custom fields ───────────────────
  const activeFieldDefs = await QuestionFieldDefinition.find({ isActive: true }).lean();
  const customFields = validateAndNormalizeCustomFields(body.customFields, activeFieldDefs);

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
    customFields,
    isActive:         body.isActive !== undefined ? body.isActive : true,
    // Manual single-add stays immediate-active — the admin already reviews
    // via the form + /questions/preview before submitting.
    status:           "active",
    createdBy:        { userId: req.user.id, email: req.user.email },
    patternSlotTags:  [],
    usageLog:         [],
    activityLog:      [makeActivityEntry(req, "created")],
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
  const oldStatus = question.status;

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

  // ── 2b. Custom fields (admin-defined) ─────────────────────────────────────
  // Only touch customFields if the client actually sent them. Values are
  // normalized against CURRENTLY ACTIVE definitions only, then merged with
  // any existing entries whose key no longer matches an active definition —
  // this preserves data tied to a since-deactivated field instead of wiping
  // it out on an unrelated edit (e.g. just changing marks).
  if (body.customFields !== undefined) {
    const activeFieldDefs = await QuestionFieldDefinition.find({ isActive: true }).lean();
    const normalizedActive = validateAndNormalizeCustomFields(body.customFields, activeFieldDefs);

    const existingCustomFields = question.customFields instanceof Map
      ? Object.fromEntries(question.customFields)
      : (question.customFields || {});
    const activeKeys = new Set(activeFieldDefs.map((d) => d.key));
    const preserved = {};
    for (const [k, v] of Object.entries(existingCustomFields)) {
      if (!activeKeys.has(k)) preserved[k] = v;
    }

    question.customFields = { ...preserved, ...normalizedActive };
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

  // ── 9. Activity log — "edited" for any real content change, plus a
  //    dedicated "status_changed" entry when draft/active actually flips
  //    (the one entry MyQuestionsPanel's review workflow cares most about:
  //    who activated this question, and when). ──────────────────────────
  const otherFieldsTouched = Object.keys(body).some(
    (k) => k !== "status" && !k.startsWith("remove")
  ) || Object.keys(files).length > 0;
  if (otherFieldsTouched) {
    question.activityLog.push(makeActivityEntry(req, "edited"));
  }
  if (body.status !== undefined && body.status !== oldStatus) {
    question.activityLog.push(
      makeActivityEntry(req, "status_changed", { from: oldStatus, to: body.status })
    );
  }

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

// Default marks/negative-marks for bulk-uploaded questions whose source
// document doesn't specify them per-question (confirmed against the real
// reference exam paper — its metadata table has no Marks field at all).
// Used ONLY as a fallback; an explicit value in the document always wins.
const BULK_UPLOAD_DEFAULT_MARKS = 4;
const BULK_UPLOAD_DEFAULT_NEGATIVE_MARKS = 1;

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
    // Real exam-paper source documents often don't carry per-question marks
    // in their metadata (only Subject/Chapter/Difficulty/... — verified
    // against the reference document). Per-file explicit values always win;
    // BULK_UPLOAD_DEFAULT_MARKS/NEGATIVE_MARKS below are the fallback only
    // when the document genuinely has none.
    marks:
      row.marks && String(row.marks).trim() !== ""
        ? row.marks
        : BULK_UPLOAD_DEFAULT_MARKS,
    negativeMarks:
      row.negativeMarks && String(row.negativeMarks).trim() !== ""
        ? row.negativeMarks
        : BULK_UPLOAD_DEFAULT_NEGATIVE_MARKS,
    solution: {
      text: (row.solutionText || "").trim(),
      hasLatex: false,
    },
    sourceRef: (row.sourceRef || "").trim(),
    isActive: true,
  };
}

/**
 * Splices `@@EQ_n@@` placeholders back into text as `$latex$`, AFTER the
 * shorthand→LaTeX pipeline has already run on the placeholder-containing
 * text (never before — running the shorthand converter over ALREADY-VALID
 * LaTeX from Gemini/OMML would double-escape backslash commands, e.g.
 * `\omega` -> `\\omega`, silently corrupting the equation. Discovered and
 * fixed during implementation by tracing exactly what processMathField's
 * "shorthand inside $...$ is also converted" mode 1 behaviour does to
 * already-backslashed input).
 *
 * Only rich-docx rows ever contain `@@EQ_n@@` tokens — for plain-template
 * docx and xlsx rows this is a no-op passthrough (no regressions there).
 *
 * @param {string} rawTextWithPlaceholders
 * @param {string} fieldName
 * @param {Map}    equationResolution
 * @param {Array}  conversionReview   mutated: one entry pushed per equation spliced in
 * @param {string} location           "text" | "option_A".."option_D" | "solution"
 */
function resolveTextWithEquations(rawTextWithPlaceholders, fieldName, equationResolution, conversionReview, location) {
  if (!rawTextWithPlaceholders) return { text: "", hasLatex: false };

  // IMPORTANT: split the placeholders OUT before calling processMathField,
  // rather than running it over the whole placeholder-containing string.
  // Discovered via end-to-end testing against the real reference document:
  // processMathField's natural-sentence math auto-detector (and its
  // pure-math-expression mode) both key off exactly the kind of token shape
  // a placeholder like "@@EQ_3@@" has (digits/underscore next to letters)
  // and WRAP/MUTATE it — e.g. inserting a "$" in the middle — which then
  // breaks the exact-string match this function needs to splice the real
  // LaTeX in, silently leaving a corrupted "@@$EQ_3$@@" token stored as
  // question text instead of the equation. Splitting first means the
  // placeholder text is never in the same string the shorthand
  // converter/auto-detector ever looks at, so there is nothing for it to
  // misfire on — only genuine surrounding prose goes through
  // processMathField, and equation LaTeX is spliced in completely
  // untouched afterwards.
  const parts = rawTextWithPlaceholders.split(/@@EQ_(\d+)@@/);
  let hasLatex = false;
  let out = "";

  // processMathField trims each segment's own leading/trailing whitespace
  // (correct for its normal single-call-per-field use elsewhere) — called
  // per-segment here, that would otherwise glue "velocity" directly onto
  // "$F=ma$" with no space. Re-insert exactly one space between pieces
  // where neither side already provides one and the next piece isn't
  // closing punctuation (so "... is $F=ma$." doesn't become "... is $F=ma$ .").
  const append = (piece) => {
    if (!piece) return;
    if (out && !/\s$/.test(out) && !/^[\s.,;:!?)\]]/.test(piece)) out += " ";
    out += piece;
  };

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!parts[i]) continue;
      const processed = processMathField(parts[i], fieldName);
      append(processed.text);
      hasLatex = hasLatex || processed.hasLatex;
    } else {
      const res = equationResolution.get(parts[i]);
      if (!res) continue;
      conversionReview.push({
        location,
        originalImageUrl: res.originalImageUrl,
        originalImagePublicId: null,
        convertedLatex: res.latex,
        flagged: res.flagged,
        verified: false,
      });
      if (res.latex) { append(`$${res.latex}$`); hasLatex = true; }
    }
  }

  return { text: out.trim(), hasLatex };
}

/**
 * POST /questions/bulk-upload
 *
 * Accepts a .docx or .xlsx file in one of THREE supported shapes (parser
 * auto-detects which, per file):
 *   1. Plain template (questionDocxParser.parseQuestionsDocx / plain xlsx) —
 *      formulas must already be typed as LaTeX, no images. Original,
 *      unchanged behaviour.
 *   2. Rich .docx (questionDocxParser.parseRichQuestionsDocx) — a naturally
 *      formatted exam paper with embedded MathType/native-Word equations
 *      and diagram images, matching the reference document this feature
 *      was built and validated against.
 *   3. .xlsx with image columns — same header-driven parsing as (1), plus
 *      "Question Image"/"Solution Image" columns for anchored pictures.
 *
 * File parsing (fast, in-process, no external calls) happens SYNCHRONOUSLY
 * here — a corrupt file or a file with zero/too-many questions is rejected
 * immediately with a normal 400. Everything slow and external (rasterizing
 * equation images, calling Gemini, uploading to Cloudinary, and the DB
 * write) runs in the BACKGROUND via BulkUploadJob — a document with 100+
 * equations can easily take past a normal request timeout, and this is
 * also just the right shape for a server handling multiple concurrent
 * uploads. The frontend polls GET /questions/bulk-upload/:batchId/status.
 */
exports.bulkUploadQuestions = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModel(req);
  const JobModel = req.app.get("BulkUploadJobModel");
  if (!JobModel) return next(new AppError("Bulk upload is temporarily unavailable (question bank not connected).", 503));

  if (!req.file) {
    return next(new AppError('No file uploaded. Attach a .docx or .xlsx file as "file".', 400));
  }

  const isXlsx = req.file.mimetype ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const format = isXlsx ? "xlsx" : "docx";

  let rawRows, structuralFailed = [], richContext = null, isRich = false;
  try {
    if (isXlsx) {
      rawRows = await parseQuestionsXlsx(req.file.buffer);
    } else {
      const templateFormat = await detectDocxTemplateFormat(req.file.buffer);
      if (templateFormat === "plain") {
        rawRows = await parseQuestionsDocx(req.file.buffer);
      } else {
        const rich = await parseRichQuestionsDocx(req.file.buffer);
        rawRows = rich.rows;
        structuralFailed = rich.failed;
        richContext = rich;
        isRich = true;
      }
    }
  } catch (err) {
    return next(err); // AppError from the parsers — 400 with a specific message
  }

  const totalRows = rawRows.length + structuralFailed.length;
  if (totalRows === 0) {
    return next(new AppError("No questions found in this file.", 400));
  }
  if (totalRows > MAX_BULK_ROWS) {
    return next(new AppError(
      `Too many questions in one file (${totalRows}). Maximum ${MAX_BULK_ROWS} per upload.`,
      400
    ));
  }

  const batchId = new mongoose.Types.ObjectId();
  const job = await JobModel.create({
    batchId,
    uploaderId:    req.user.id,
    uploaderEmail: req.user.email,
    fileName:      req.file.originalname,
    format,
    status:        "processing",
    progress:      { processed: 0, total: rawRows.length, stage: "parsing" },
  });

  // Fire-and-forget: the HTTP response does not wait on this. A crash here
  // must never take down the process — always caught and written to the
  // job doc so the frontend's poll sees status:"failed" instead of hanging.
  runBulkUploadJob({
    QuestionModel, JobModel, jobId: job._id, batchId,
    rawRows, structuralFailed, richContext, isRich, format,
    fileName: req.file.originalname,
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
  }).catch(async (err) => {
    console.error("[BulkUpload] background job crashed:", err);
    await JobModel.updateOne(
      { _id: job._id },
      { status: "failed", errorMessage: err.message || "Unexpected error during processing." }
    ).catch(() => {});
  });

  return sendSuccess(res, 202, "Bulk upload started — processing in the background.", {
    batchId: String(batchId),
  });
});

/**
 * The actual bulk-upload work — everything after file parsing. Runs
 * detached from the request/response cycle; all progress/results are
 * written to the BulkUploadJob document for polling.
 */
async function runBulkUploadJob({
  QuestionModel, JobModel, jobId, batchId,
  rawRows, structuralFailed, richContext, isRich, format,
  fileName, user,
}) {
  const uploadedAt = new Date();
  const onProgress = async (stage, processed, total) => {
    await JobModel.updateOne(
      { _id: jobId },
      { "progress.stage": stage, "progress.processed": processed, "progress.total": total }
    ).catch(() => {});
  };

  // ── Resolve equations + images (external I/O) ─────────────────────────
  let equationResolution = new Map();
  let questionImages = new Map();
  let solutionImages = new Map();

  if (isRich) {
    const resolved = await resolveDocxEquationsAndImages(richContext, onProgress);
    equationResolution = resolved.equationResolution;
    questionImages = resolved.questionImages;
    solutionImages = resolved.solutionImages;
  } else if (format === "xlsx") {
    const resolved = await resolveXlsxImages(rawRows, onProgress);
    questionImages = resolved.questionImages;
    solutionImages = resolved.solutionImages;
  }

  await onProgress("saving", 0, rawRows.length);

  // ── Per-row: build candidate → Joi validate → math process → hash → dedup ──
  const failed            = structuralFailed.map((f) => ({ row: f.row, errors: [f.reason] }));
  const skippedDuplicates = [];
  const docsToInsert      = [];
  const rowNumbers        = [];
  const seenHashes        = new Map();
  let flaggedForReview    = 0;
  let processedCount      = 0;

  for (const rawRow of rawRows) {
    const rowNumber = rawRow._rowNumber;
    const candidate = buildCandidateFromRawRow(rawRow);

    const { error, value } = createQuestionSchema.validate(candidate, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      failed.push({ row: rowNumber, errors: error.details.map((d) => d.message.replace(/"/g, "'")) });
      processedCount++; await onProgress("saving", processedCount, rawRows.length);
      continue;
    }

    try {
      const conversionReview = [];
      const processedText = isRich
        ? resolveTextWithEquations(value.text, "Question Text", equationResolution, conversionReview, "text")
        : processMathField(value.text, "Question Text");
      const processedSol = isRich
        ? resolveTextWithEquations(value.solution?.text || "", "Solution Text", equationResolution, conversionReview, "solution")
        : processMathField(value.solution?.text, "Solution Text");
      const processedOptions = value.options.map((opt) => ({
        key: opt.key,
        text: isRich
          ? resolveTextWithEquations(opt.text, `Option ${opt.key}`, equationResolution, conversionReview, `option_${opt.key}`).text
          : processMathField(opt.text, `Option ${opt.key}`).text,
      }));

      const contentHash = computeContentHash({
        subject: value.subject, classLevel: value.classLevel,
        chapter: value.chapter, topic: value.topic, text: processedText.text,
      });

      if (seenHashes.has(contentHash)) {
        skippedDuplicates.push({ row: rowNumber, reason: `Duplicate of row ${seenHashes.get(contentHash)} in this same file.` });
        processedCount++; await onProgress("saving", processedCount, rawRows.length);
        continue;
      }
      seenHashes.set(contentHash, rowNumber);

      const rowFlagged = conversionReview.filter((c) => c.flagged).length;
      flaggedForReview += rowFlagged;

      const qImg = questionImages.get(rowNumber) || null;
      const sImgs = solutionImages.get(rowNumber) || [];

      docsToInsert.push({
        subject: value.subject, classLevel: value.classLevel, chapter: value.chapter, topic: value.topic,
        questionCategory: value.questionCategory || "", questionVariant: value.questionVariant || "",
        difficulty: value.difficulty, idealTimeSeconds: value.idealTimeSeconds ?? null,
        questionType: value.questionType || "mcq",
        text: processedText.text, hasLatex: processedText.hasLatex,
        questionImage: qImg || { url: null, publicId: null },
        options: processedOptions.map((o) => ({ key: o.key, text: o.text, image: { url: null, publicId: null } })),
        correctAnswer: value.correctAnswer, marks: value.marks, negativeMarks: value.negativeMarks ?? 0,
        solution: {
          text: processedSol.text, hasLatex: processedSol.hasLatex,
          image: { url: null, publicId: null }, images: sImgs,
        },
        contentHash, sourceRef: value.sourceRef || "",
        isActive: true, status: "draft",
        createdBy: { userId: user.id, email: user.email },
        uploadBatch: { batchId, fileName, uploadedAt },
        patternSlotTags: [], usageLog: [],
        activityLog: [{ action: "bulk_uploaded", byUserId: user.id, byEmail: user.email, byRole: user.role || "", at: uploadedAt, meta: { batchId: String(batchId), fileName } }],
        conversionReview,
      });
      rowNumbers.push(rowNumber);
    } catch (err) {
      failed.push({ row: rowNumber, errors: [err.message || "Invalid data."] });
    }
    processedCount++; await onProgress("saving", processedCount, rawRows.length);
  }

  // ── One dedup query against the DB (not one findOne per row) ───────────
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
          skippedDuplicates.push({ row: rowNumbers[idx], reason: "A question with identical classification and text already exists in the bank." });
        } else {
          keptDocs.push(doc);
          keptRowNumbers.push(rowNumbers[idx]);
        }
      });
      docsToInsert.length = 0; docsToInsert.push(...keptDocs);
      rowNumbers.length = 0; rowNumbers.push(...keptRowNumbers);
    }
  }

  // ── One bulk write ───────────────────────────────────────────────────
  let createdIds = [];
  if (docsToInsert.length > 0) {
    try {
      const inserted = await QuestionModel.insertMany(docsToInsert, { ordered: false });
      createdIds = inserted.map((d) => d._id);
    } catch (err) {
      if (err.writeErrors) {
        const failedIdx = new Set(err.writeErrors.map((we) => we.index));
        docsToInsert.forEach((doc, idx) => {
          if (failedIdx.has(idx)) {
            skippedDuplicates.push({ row: rowNumbers[idx], reason: "A question with identical classification and text already exists in the bank." });
          }
        });
        createdIds = (err.insertedDocs || []).map((d) => d._id);
      } else {
        throw err;
      }
    }
  }

  await JobModel.updateOne({ _id: jobId }, {
    status: "done",
    "progress.stage": "done",
    "progress.processed": rawRows.length,
    result: {
      totalRows: rawRows.length + structuralFailed.length,
      createdCount: createdIds.length,
      created: createdIds,
      skippedDuplicates,
      failed,
      flaggedForReview,
    },
  });
}

/**
 * GET /questions/bulk-upload/:batchId/status
 * Polled by the frontend while a bulk upload is processing.
 */
exports.getBulkUploadStatus = asyncHandler(async (req, res, next) => {
  const JobModel = req.app.get("BulkUploadJobModel");
  if (!JobModel) return next(new AppError("Bulk upload is temporarily unavailable.", 503));

  const job = await JobModel.findOne({ batchId: req.params.batchId }).lean();
  if (!job) return next(new AppError("Bulk upload job not found.", 404));

  // Same ownership rule as everything else in this file: admin sees only
  // their own uploads, super_admin unrestricted.
  if (req.user.role === ROLES.ADMIN && String(job.uploaderId) !== String(req.user.id)) {
    return next(new AppError("You can only check the status of your own uploads.", 403));
  }

  return sendSuccess(res, 200, "Bulk upload job status.", {
    batchId: String(job.batchId),
    status: job.status,
    progress: job.progress,
    result: job.status === "done" ? job.result : undefined,
    errorMessage: job.status === "failed" ? job.errorMessage : undefined,
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
