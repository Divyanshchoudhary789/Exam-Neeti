const Joi = require("joi");
const { SUBJECTS, QUESTIONNAIRE_LEVELS } = require("../config/constants");

const questionnaireSchema = Joi.object({
  sprintId: Joi.string().hex().length(24).required(),
  chapters: Joi.array()
    .items(
      Joi.object({
        subject: Joi.string()
          .valid(...Object.values(SUBJECTS))
          .required(),
        chapter: Joi.string().trim().min(1).max(150).required(),
        level: Joi.string()
          .valid(...Object.values(QUESTIONNAIRE_LEVELS))
          .required()
          .messages({
            "any.only": `Level must be one of: ${Object.values(QUESTIONNAIRE_LEVELS).join(", ")}`,
          }),
      })
    )
    .min(1)
    .required(),
});

module.exports = { questionnaireSchema };
