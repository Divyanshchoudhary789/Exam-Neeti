const Joi = require("joi");

// registerSchema is only used internally / not exposed as a public API endpoint.
// super_admin can only be created via the seedAdmin.js script, never via API.
const registerSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(100).required(),
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).max(72).required(),
  role:     Joi.string().valid("student", "admin").default("student"),
  batch:    Joi.string().hex().length(24).allow(null, "").default(null),
  phone:    Joi.string().trim().allow(null, "").default(null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(72).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match.",
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
  confirmNewPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Passwords do not match." }),
});

// refreshToken is sent via httpOnly signed cookie by web clients.
// API clients (Postman, mobile) can optionally send it in the body.
// We make the body field optional — the controller handles the cookie fallback.
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
};
