const { sendError } = require("../utils/response");

/**
 * Joi validation middleware factory.
 * Pass a Joi schema and the part of req to validate ('body', 'query', 'params').
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message.replace(/"/g, "'"));
      return sendError(res, 400, "Validation failed.", messages);
    }

    req[source] = value;
    next();
  };
};

module.exports = validate;
