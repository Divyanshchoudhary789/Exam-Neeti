/**
 * questionFieldDefinition.controller.js
 *
 * Admin/super_admin CRUD for custom Question field definitions.
 * Definitions live on the default mongoose connection; the values they
 * describe live on each Question document (`customFields` Map, on the
 * question-bank connection) — see question.controller.js.
 */

"use strict";

const QuestionFieldDefinition = require("../models/QuestionFieldDefinition.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");

// Existing top-level Question schema field names — a custom field key can
// never collide with one of these, or it would silently shadow/corrupt a
// real field when merged into a create/update payload.
const RESERVED_KEYS = new Set([
  "subject", "classLevel", "chapter", "topic",
  "questionCategory", "questionVariant", "difficulty", "idealTimeSeconds",
  "questionType", "text", "hasLatex", "questionImage", "options",
  "correctAnswer", "marks", "negativeMarks", "solution", "contentHash",
  "sourceRef", "patternSlotTags", "usageLog", "isActive", "status",
  "createdBy", "uploadBatch", "customFields",
  "_id", "id", "createdAt", "updatedAt", "__v",
]);

// ─── LIST ─────────────────────────────────────────────────────────────────────

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.activeOnly === true || req.query.activeOnly === "true") {
    filter.isActive = true;
  }

  const fieldDefinitions = await QuestionFieldDefinition.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return sendSuccess(res, 200, "Field definitions fetched.", { fieldDefinitions });
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.create = asyncHandler(async (req, res, next) => {
  const { key, label, type, options, required, isActive, order, helpText, min, max } = req.body;

  if (RESERVED_KEYS.has(key)) {
    return next(new AppError(`"${key}" is a reserved field name and cannot be used as a custom field key.`, 400));
  }

  const existing = await QuestionFieldDefinition.findOne({ key }).lean();
  if (existing) {
    return next(new AppError(`A field with key "${key}" already exists.`, 400));
  }

  const fieldDefinition = await QuestionFieldDefinition.create({
    key,
    label,
    type,
    options: type === "select" ? options : [],
    required,
    isActive,
    order,
    helpText,
    min: type === "number" ? min : null,
    max: type === "number" ? max : null,
    createdBy: { userId: req.user.id, email: req.user.email },
  });

  return sendSuccess(res, 201, "Field definition created successfully.", { fieldDefinition });
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────

exports.update = asyncHandler(async (req, res, next) => {
  const fieldDefinition = await QuestionFieldDefinition.findById(req.params.id);
  if (!fieldDefinition) return next(new AppError("Field definition not found.", 404));

  const { label, options, required, isActive, order, helpText, min, max } = req.body;

  if (label !== undefined) fieldDefinition.label = label;
  if (options !== undefined && fieldDefinition.type === "select") fieldDefinition.options = options;
  if (required !== undefined) fieldDefinition.required = required;
  if (isActive !== undefined) fieldDefinition.isActive = isActive;
  if (order !== undefined) fieldDefinition.order = order;
  if (helpText !== undefined) fieldDefinition.helpText = helpText;
  if (fieldDefinition.type === "number") {
    if (min !== undefined) fieldDefinition.min = min;
    if (max !== undefined) fieldDefinition.max = max;
  }

  await fieldDefinition.save();

  return sendSuccess(res, 200, "Field definition updated successfully.", { fieldDefinition });
});

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────

exports.toggleActive = asyncHandler(async (req, res, next) => {
  const fieldDefinition = await QuestionFieldDefinition.findById(req.params.id);
  if (!fieldDefinition) return next(new AppError("Field definition not found.", 404));

  fieldDefinition.isActive = !fieldDefinition.isActive;
  await fieldDefinition.save();

  return sendSuccess(
    res, 200,
    `Field ${fieldDefinition.isActive ? "activated" : "deactivated"} successfully.`,
    { fieldDefinition }
  );
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

exports.remove = asyncHandler(async (req, res, next) => {
  const fieldDefinition = await QuestionFieldDefinition.findById(req.params.id);
  if (!fieldDefinition) return next(new AppError("Field definition not found.", 404));

  const QuestionModel = req.app.get("QuestionModel");
  const usageCount = QuestionModel
    ? await QuestionModel.countDocuments({ [`customFields.${fieldDefinition.key}`]: { $exists: true } }).catch(() => 0)
    : 0;

  if (usageCount > 0) {
    return next(
      new AppError(
        `This field is used by ${usageCount} question(s). Deactivate it instead of deleting, so existing data is preserved.`,
        409
      )
    );
  }

  await fieldDefinition.deleteOne();

  return sendSuccess(res, 200, "Field definition deleted.", { deletedFieldId: fieldDefinition._id });
});
