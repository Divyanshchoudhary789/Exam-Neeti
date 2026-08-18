const Joi = require("joi");
const { DIFFICULTY, QUESTION_TYPE, SUBJECTS, SPRINT_STATUS } = require("../config/constants");

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
});

const createSprintSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().allow("").default(""),
  status: Joi.string().valid(...Object.values(SPRINT_STATUS)).default(SPRINT_STATUS.DRAFT),
  totalQuestions: Joi.number().integer().min(1).required(),
  patternSlots: Joi.array().items(patternSlotSchema).min(1).required(),
  startDate: Joi.date().allow(null).default(null),
  endDate: Joi.date().min(Joi.ref("startDate")).allow(null).default(null),
});

const updateSprintSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().allow(""),
  status:      Joi.string().valid(...Object.values(SPRINT_STATUS)),
  startDate:   Joi.date().allow(null),
  endDate:     Joi.date().allow(null),
}).min(1);

module.exports = { createSprintSchema, updateSprintSchema };
