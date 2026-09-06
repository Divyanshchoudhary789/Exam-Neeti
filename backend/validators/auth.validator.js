const Joi = require("joi");
const { PROGRAM_TYPES } = require("../config/constants");

// Public self-registration (POST /auth/register) — students only. Admin
// accounts can only ever be created by a super_admin via /admin-team; there
// is deliberately no `role` field here so a public request can never create
// anything but a student.
const selfRegisterSchema = Joi.object({
  name:        Joi.string().trim().min(2).max(100).required(),
  email:       Joi.string().email().lowercase().required(),
  password:    Joi.string().min(8).max(72).required(),
  phone:       Joi.string().trim().allow(null, "").default(null),
  programType: Joi.string().valid(...Object.values(PROGRAM_TYPES)).allow(null).default(null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
  // Which door the login screen's toggle was on. The server rejects a
  // role/portal mismatch before issuing a session. Optional so non-browser
  // API clients aren't forced to send it.
  portal: Joi.string().valid("student", "admin").optional(),
});

// Google Sign-In (POST /auth/google). `credential` is the ID token (a JWT)
// issued by Google Identity Services in the browser. The server verifies it
// against Google's public keys before trusting any claim inside it.
const googleAuthSchema = Joi.object({
  credential:  Joi.string().required(),
  programType: Joi.string().valid(...Object.values(PROGRAM_TYPES)).allow(null, "").default(null),
  portal:      Joi.string().valid("student", "admin").optional(),
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
  selfRegisterSchema,
  loginSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
};
