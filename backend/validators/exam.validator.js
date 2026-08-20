const Joi = require("joi");
const { EXAM_STATUS } = require("../config/constants");

const createExamSchema = Joi.object({
  sprintId:        Joi.string().hex().length(24).optional(),
  sprint:          Joi.string().hex().length(24).optional(),
  batchId:         Joi.string().hex().length(24).optional(),
  batch:           Joi.string().hex().length(24).optional(),
  title:           Joi.string().trim().allow("").default(""),
  durationMinutes: Joi.number().integer().min(1).required(),
  scheduledAt:     Joi.date().allow(null, "").default(null),
  instructions:    Joi.string().trim().allow("").default(""),
}).or("sprintId", "sprint").or("batchId", "batch");

const updateExamSchema = Joi.object({
  title:           Joi.string().trim().allow(""),
  durationMinutes: Joi.number().integer().min(1),
  scheduledAt:     Joi.date().allow(null),
  status:          Joi.string().valid(...Object.values(EXAM_STATUS)),
  instructions:    Joi.string().trim().allow(""),
}).min(1);

const submitAttemptSchema = Joi.object({
  responses: Joi.array()
    .items(
      Joi.object({
        slotPosition: Joi.number().integer().min(1).required(),
        // questionId is optional — scoring is done by slotPosition, not questionId.
        // Keeping it optional avoids unnecessary client friction.
        questionId: Joi.string().hex().length(24).optional(),
        selectedAnswer: Joi.string()
          .valid("A", "B", "C", "D")
          .allow(null)
          .default(null),
        timeSpentSeconds: Joi.number().min(0).default(0),
        sequencePosition: Joi.number().integer().min(1).allow(null).default(null),
        firstAnswerTimeSeconds: Joi.number().min(0).allow(null).default(null),
        lastAnswerTimeSeconds: Joi.number().min(0).allow(null).default(null),
        reattemptDelaySeconds: Joi.number().min(0).allow(null).default(null),
        wasReattempted: Joi.boolean().default(false),
        answerChanges: Joi.number().integer().min(0).default(0),
        initialAnswer: Joi.string().valid("A", "B", "C", "D").allow(null).default(null),
        confidence: Joi.number().min(0).max(100).allow(null).default(null),
      })
    )
    .required(),
  totalTimeSeconds: Joi.number().min(0).required(),
});

module.exports = { createExamSchema, updateExamSchema, submitAttemptSchema };
