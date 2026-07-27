const Joi = require("joi");

/**
 * Validation schemas for Admin Team Management endpoints.
 * Only super_admin can reach these routes, but we still validate input
 * to prevent bad data from entering the database.
 */

const createAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required.",
    "string.min":   "Name must be at least 2 characters.",
    "string.max":   "Name cannot exceed 100 characters.",
  }),

  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please provide a valid email address.",
    "string.empty": "Email is required.",
  }),

  phone: Joi.string().trim().allow(null, "").default(null),

  /**
   * role can only be "admin" when creating via this endpoint.
   * super_admin cannot be created through the API — only via seedAdmin.js
   * This prevents privilege escalation through the API.
   */
  role: Joi.string()
    .valid("admin")
    .default("admin")
    .messages({
      "any.only": "Role must be 'admin'. Super admin can only be created via seed script.",
    }),

  /**
   * Optional temporary password. If not provided, one is auto-generated.
   * Either way, it is emailed to the admin.
   */
  password: Joi.string().min(8).max(72).allow(null, "").default(null),
});

const updateAdminSchema = Joi.object({
  name:  Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().allow(null, ""),
}).min(1).messages({
  "object.min": "Provide at least one field to update.",
});

const listAdminsQuerySchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  search:   Joi.string().trim().allow("").default(""),
  role:     Joi.string().valid("admin", "super_admin", "").default(""),
  isActive: Joi.boolean().truthy("true").falsy("false"),
});

const auditLogQuerySchema = Joi.object({
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
  adminId:   Joi.string().hex().length(24).allow("").default(""),
  action:    Joi.string().trim().allow("").default(""),
  startDate: Joi.date().iso().allow("").default(null),
  endDate:   Joi.date().iso().allow("").default(null),
});

module.exports = {
  createAdminSchema,
  updateAdminSchema,
  listAdminsQuerySchema,
  auditLogQuerySchema,
};
