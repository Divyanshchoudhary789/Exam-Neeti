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
  sendEmail: Joi.boolean().default(false),
});

module.exports = { generateReportSchema };
