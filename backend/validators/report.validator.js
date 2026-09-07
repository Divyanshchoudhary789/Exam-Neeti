const Joi = require("joi");
const { REPORT_TYPE, REPORT_FORMAT, REPORT_SCOPE } = require("../config/constants");

const generateReportSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(REPORT_TYPE))
    .required(),
  format: Joi.string()
    .valid(...Object.values(REPORT_FORMAT))
    .required(),
  scope: Joi.string()
    .valid(...Object.values(REPORT_SCOPE))
    .required(),
  scopeRefId: Joi.string().hex().length(24).allow(null, "").default(null),
  sprintId: Joi.string().hex().length(24).allow(null, "").default(null),
  // Optional multi-sprint scoping — when present, overrides sprintId. Empty
  // array (or omitted) means "every sprint".
  sprintIds: Joi.array().items(Joi.string().hex().length(24)).max(50).default([]),
  sendEmail: Joi.boolean().default(false),
});

module.exports = { generateReportSchema };
