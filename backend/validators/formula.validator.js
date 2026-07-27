const Joi = require("joi");

const upsertFormulaSchema = Joi.object({
  sprintId: Joi.string().hex().length(24).required(),
  metricKey: Joi.string().trim().min(1).max(100).required(),
  label: Joi.string().trim().allow("").default(""),
  description: Joi.string().trim().allow("").default(""),
  params: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  isActive: Joi.boolean().default(true),
});

module.exports = { upsertFormulaSchema };
