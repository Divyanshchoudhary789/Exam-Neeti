const Joi = require("joi");

const createBatchSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().allow("").default(""),
});

const updateBatchSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().allow(""),
  isActive: Joi.boolean(),
}).min(1);

const bulkImportStudentsSchema = Joi.object({
  students: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        email: Joi.string().email().lowercase().required(),
        phone: Joi.string().trim().allow(null, "").default(null),
        // Temporary password — if not provided, one is auto-generated
        password: Joi.string().min(8).max(72).allow(null, "").default(null),
      })
    )
    .min(1)
    .max(500)
    .required(),
  batchId: Joi.string().hex().length(24).required(),
});

// confirmName is required to prevent accidental hard deletes.
// force (optional) overrides the active-student safety gate.
const deleteBatchSchema = Joi.object({
  confirmName: Joi.string().trim().required().messages({
    "any.required": "confirmName is required to confirm deletion.",
    "string.empty": "confirmName cannot be empty.",
  }),
  force: Joi.boolean().default(false),
});

module.exports = { createBatchSchema, updateBatchSchema, bulkImportStudentsSchema, deleteBatchSchema };
