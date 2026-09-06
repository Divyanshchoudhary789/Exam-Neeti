const Joi = require("joi");
const { DIFFICULTY, QUESTION_TYPE, SUBJECTS, SPRINT_STATUS, CLASS_LEVELS } = require("../config/constants");

const objectIdRule = Joi.string().pattern(/^[a-f\d]{24}$/i);
const classLevelRule = Joi.string().valid(...Object.values(CLASS_LEVELS)).allow(null, "");

const patternSlotSchema = Joi.object({
  position: Joi.number().integer().min(1).required(),
  subject: Joi.string()
    .valid(...Object.values(SUBJECTS))
    .required(),
  chapter: Joi.string().trim().allow(null, "").default(null),
  topic: Joi.string().trim().allow(null, "").default(null),
  difficulty: Joi.string()
    .valid(...Object.values(DIFFICULTY))
    .allow(null)
    .default(null),
  questionType: Joi.string()
    .valid(...Object.values(QUESTION_TYPE))
    .default("mcq"),
  marks: Joi.number().min(0).required(),
  negativeMarks: Joi.number().min(0).default(0),
  // Admin-fixed questions for this slot (Question Bank _id values). Empty =
  // engine auto-selects best fit; non-empty = engine uses ONLY these.
  pinnedQuestionIds: Joi.array().items(objectIdRule).default([]),
});

const createSprintSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().allow("").default(""),
  status: Joi.string().valid(...Object.values(SPRINT_STATUS)).default(SPRINT_STATUS.DRAFT),
  classLevel: classLevelRule.default(null),
  totalQuestions: Joi.number().integer().min(1).required(),
  patternSlots: Joi.array().items(patternSlotSchema).min(1).required(),
  startDate: Joi.date().allow(null).default(null),
  endDate: Joi.date().min(Joi.ref("startDate")).allow(null).default(null),
});

const updateSprintSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().allow(""),
  status:      Joi.string().valid(...Object.values(SPRINT_STATUS)),
  classLevel:  classLevelRule,
  startDate:   Joi.date().allow(null),
  endDate:     Joi.date().allow(null),
}).min(1);

// Mark (or reopen) one subject's slice of the blueprint in the multi-admin flow.
const subjectProgressSchema = Joi.object({
  subject: Joi.string().valid(...Object.values(SUBJECTS)).required(),
  status:  Joi.string().valid("pending", "in_progress", "done").required(),
  note:    Joi.string().trim().allow("").max(500).default(""),
});

// Admin raises a deletion request; super_admin decides.
const deletionRequestSchema = Joi.object({
  reason: Joi.string().trim().allow("").max(1000).default(""),
});
const deletionDecisionSchema = Joi.object({
  decision: Joi.string().valid("approve", "reject").required(),
  note:     Joi.string().trim().allow("").max(1000).default(""),
});

/**
 * Replaces the full blueprint (meta + every pattern slot) of a DRAFT sprint.
 * The controller additionally blocks this when the sprint is not DRAFT or has
 * exams referencing it.
 */
const updateSprintBlueprintSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().allow(""),
  status: Joi.string().valid(SPRINT_STATUS.DRAFT, SPRINT_STATUS.ACTIVE),
  classLevel: classLevelRule,
  totalQuestions: Joi.number().integer().min(1).required(),
  patternSlots: Joi.array().items(patternSlotSchema).min(1).required(),
  startDate: Joi.date().allow(null),
  endDate: Joi.date().min(Joi.ref("startDate")).allow(null),
}).min(1);

/**
 * Query params for GET /sprints/slot-questions — the per-slot candidate list
 * the Sprint Builder shows so an admin can pin specific questions.
 */
const slotQuestionsQuerySchema = Joi.object({
  subject: Joi.string().valid(...Object.values(SUBJECTS)).required(),
  chapter: Joi.string().trim().max(200).allow(""),
  topic: Joi.string().trim().max(200).allow(""),
  difficulty: Joi.string().valid(...Object.values(DIFFICULTY)).allow(""),
  search: Joi.string().trim().max(200).allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
});

const paperQuerySchema = Joi.object({
  format: Joi.string().valid("pdf", "docx").default("pdf"),
});

const listSprintsQuerySchema = Joi.object({
  status:     Joi.string().valid(...Object.values(SPRINT_STATUS)),
  classLevel: Joi.string().valid(...Object.values(CLASS_LEVELS)),
  search:     Joi.string().trim().max(200).allow(""),
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(10),
}).unknown(true);

module.exports = {
  createSprintSchema,
  updateSprintSchema,
  updateSprintBlueprintSchema,
  slotQuestionsQuerySchema,
  listSprintsQuerySchema,
  paperQuerySchema,
  subjectProgressSchema,
  deletionRequestSchema,
  deletionDecisionSchema,
};
