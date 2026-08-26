const Joi = require("joi");

const upsertFormulaSchema = Joi.object({
  sprintId: Joi.string().hex().length(24).required(),
  metricKey: Joi.string().trim().min(1).max(100).required(),
  label: Joi.string().trim().allow("").default(""),
  description: Joi.string().trim().allow("").default(""),
  // Every formula param is consumed as a number by the analytics engine (thresholds,
  // weights, mark values) — constraining the value type here stops an admin typo
  // (e.g. a stray space making "4 " a string) from silently becoming NaN once it
  // reaches arithmetic in advancedAnalytics.service.js and gets persisted forever.
  params: Joi.object().pattern(Joi.string(), Joi.number()).default({}),
  isActive: Joi.boolean().default(true),
});

module.exports = { upsertFormulaSchema };
