const Joi = require("joi");

const createStudentSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(100).required(),
  email:    Joi.string().email().lowercase().trim().required(),
  phone:    Joi.string().trim().allow(null, "").default(null),
  batchId:  Joi.string().hex().length(24),
  batch:    Joi.string().hex().length(24),
  password: Joi.string().min(8).max(72).allow(null, "").default(null),
}).or("batchId", "batch");

const updateStudentSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(100),
  phone:    Joi.string().trim().allow(null, ""),
  batch:    Joi.string().hex().length(24),
  batchId:  Joi.string().hex().length(24),
  isActive: Joi.boolean(),
}).min(1);

const updateMyProfileSchema = Joi.object({
  name:  Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().allow(null, ""),
}).min(1);

// confirmEmail is required to prevent accidental hard deletes.
const deleteStudentSchema = Joi.object({
  confirmEmail: Joi.string().email().lowercase().trim().required().messages({
    "any.required": "confirmEmail is required to confirm deletion.",
    "string.email":  "confirmEmail must be a valid email address.",
  }),
});

module.exports = { createStudentSchema, updateStudentSchema, updateMyProfileSchema, deleteStudentSchema };
