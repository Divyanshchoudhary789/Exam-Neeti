/**
 * question.validator.js
 *
 * Joi validation schemas for the Question Bank CRUD API.
 *
 * IMPORTANT — Math processing is NOT done here.
 * Joi validates structure and constraints only.
 * The controller runs processAndValidateText() on every text field AFTER
 * Joi validation, so the stored text is always converted + KaTeX-validated.
 *
 * hasLatex is accepted from the client but will be OVERRIDDEN by the controller
 * to reflect the actual result of math processing. Clients can omit it.
 */

"use strict";

const Joi = require("joi");
const { SUBJECTS, CLASS_LEVELS, DIFFICULTY, QUESTION_TYPE } = require("../config/constants");

// ─── Re-usable sub-schemas ────────────────────────────────────────────────────

const optionSchema = Joi.object({
  key:  Joi.string().valid("A", "B", "C", "D").required(),
  // text can be empty when the option is image-only
  text: Joi.string().allow("").default(""),
});

const solutionBodySchema = Joi.object({
  text:     Joi.string().allow("").default(""),
  // hasLatex accepted but overridden by math processor result
  hasLatex: Joi.boolean().default(false),
});

// ─── Strict 4-option validator ────────────────────────────────────────────────

const fourOptionsValidator = Joi.array()
  .items(optionSchema)
  .length(4)
  .custom((opts, helpers) => {
    const keys = opts.map((o) => o.key).sort().join(",");
    if (keys !== "A,B,C,D") return helpers.error("any.invalid");
    return opts;
  })
  .messages({ "any.invalid": "Options must have exactly one entry for each of A, B, C, D." });

// ─── createQuestionSchema ─────────────────────────────────────────────────────

const createQuestionSchema = Joi.object({
  // Classification
  subject:          Joi.string().valid(...Object.values(SUBJECTS)).required(),
  classLevel:       Joi.string().valid(...Object.values(CLASS_LEVELS)).required(),
  chapter:          Joi.string().trim().min(1).max(200).required(),
  topic:            Joi.string().trim().min(1).max(200).required(),
  questionCategory: Joi.string().trim().allow("").max(200).default(""),
  questionVariant:  Joi.string().trim().allow("").max(200).default(""),

  // Difficulty & timing
  difficulty:       Joi.string().valid(...Object.values(DIFFICULTY)).required(),
  idealTimeSeconds: Joi.number().integer().min(1).max(600).allow(null).default(null),

  // Question body
  questionType: Joi.string().valid(...Object.values(QUESTION_TYPE)).default(QUESTION_TYPE.MCQ),

  // text: raw input — may contain shorthand like frac(1,2), sqrt(x), etc.
  // The controller will convert and validate it.
  text:     Joi.string().trim().min(1).max(5000).required(),
  hasLatex: Joi.boolean().default(false),   // controller overrides this

  options:       fourOptionsValidator.required(),
  correctAnswer: Joi.string().valid("A", "B", "C", "D").required(),

  // Marks
  marks:         Joi.number().min(0).required(),
  negativeMarks: Joi.number().min(0).default(0),

  // Solution
  solution:  solutionBodySchema.default({ text: "", hasLatex: false }),

  // Metadata
  sourceRef: Joi.string().trim().allow("").max(200).default(""),
  isActive:  Joi.boolean().default(true),
});

// ─── updateQuestionSchema ─────────────────────────────────────────────────────

const updateQuestionSchema = Joi.object({
  subject:          Joi.string().valid(...Object.values(SUBJECTS)),
  classLevel:       Joi.string().valid(...Object.values(CLASS_LEVELS)),
  chapter:          Joi.string().trim().min(1).max(200),
  topic:            Joi.string().trim().min(1).max(200),
  questionCategory: Joi.string().trim().allow("").max(200),
  questionVariant:  Joi.string().trim().allow("").max(200),
  difficulty:       Joi.string().valid(...Object.values(DIFFICULTY)),
  idealTimeSeconds: Joi.number().integer().min(1).max(600).allow(null),
  questionType:     Joi.string().valid(...Object.values(QUESTION_TYPE)),
  text:             Joi.string().trim().min(1).max(5000),
  hasLatex:         Joi.boolean(),
  options:          fourOptionsValidator,
  correctAnswer:    Joi.string().valid("A", "B", "C", "D"),
  marks:            Joi.number().min(0),
  negativeMarks:    Joi.number().min(0),
  solution:         solutionBodySchema,
  sourceRef:        Joi.string().trim().allow("").max(200),
  isActive:         Joi.boolean(),

  // Image removal flags
  removeQuestionImage:  Joi.boolean().default(false),
  removeSolutionImage:  Joi.boolean().default(false),
  removeSolutionImages: Joi.boolean().default(false),
  removeOptionImage_A:  Joi.boolean().default(false),
  removeOptionImage_B:  Joi.boolean().default(false),
  removeOptionImage_C:  Joi.boolean().default(false),
  removeOptionImage_D:  Joi.boolean().default(false),
}).min(1);

// ─── listQuestionsSchema ──────────────────────────────────────────────────────

const listQuestionsSchema = Joi.object({
  page:             Joi.number().integer().min(1).default(1),
  limit:            Joi.number().integer().min(1).max(100).default(20),
  subject:          Joi.string().valid(...Object.values(SUBJECTS)),
  classLevel:       Joi.string().valid(...Object.values(CLASS_LEVELS)),
  chapter:          Joi.string().trim().max(200),
  topic:            Joi.string().trim().max(200),
  difficulty:       Joi.string().valid(...Object.values(DIFFICULTY)),
  questionCategory: Joi.string().trim().max(200),
  questionVariant:  Joi.string().trim().max(200),
  sourceRef:        Joi.string().trim().max(200),
  isActive:         Joi.boolean(),
  hasLatex:         Joi.boolean(),
  search:           Joi.string().trim().max(500),
  sortBy:           Joi.string()
    .valid("createdAt", "chapter", "topic", "difficulty", "subject")
    .default("createdAt"),
  sortOrder:        Joi.string().valid("asc", "desc").default("desc"),
});

module.exports = { createQuestionSchema, updateQuestionSchema, listQuestionsSchema };
