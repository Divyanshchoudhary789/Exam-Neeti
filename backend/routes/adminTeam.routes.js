/**
 * Admin Team Management Routes
 *
 * Base path: /api/v1/admin-team
 */

const express = require("express");
const router = express.Router();

const adminTeamController = require("../controllers/adminTeam.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const {
  createAdminSchema,
  updateAdminSchema,
  listAdminsQuerySchema,
  auditLogQuerySchema,
} = require("../validators/adminTeam.validator");
const { ROLES } = require("../config/constants");

// All admin-team routes require authentication
router.use(authenticate);

// ── Routes accessible to both admin and super_admin ───────────────────────────
// authorize(ROLES.ADMIN) automatically lets super_admin through too
// (see authorize middleware — super_admin has blanket bypass).

// Platform-wide stats (admins see this too for context)
router.get(
  "/platform-stats",
  authorize(ROLES.ADMIN),
  adminTeamController.getPlatformStats
);

// Audit log viewer — admins can see their own team's activity
router.get(
  "/audit-logs",
  authorize(ROLES.ADMIN),
  validate(auditLogQuerySchema, "query"),
  adminTeamController.getAuditLogs
);

// List all admins/super_admins
router.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(listAdminsQuerySchema, "query"),
  adminTeamController.listAdmins
);

// Get a specific admin's profile + recent activity
router.get(
  "/:id",
  authorize(ROLES.ADMIN),
  adminTeamController.getAdmin
);

// Update admin's own name/phone (controller enforces super_admin can only
// update themselves; regular admin can update their own profile too)
router.patch(
  "/:id",
  authorize(ROLES.ADMIN),
  validate(updateAdminSchema),
  adminTeamController.updateAdmin
);

// ── Super-admin-exclusive routes ──────────────────────────────────────────────
// Only super_admin can create, deactivate, or reactivate admin accounts.
// These are privileged lifecycle operations that must never be delegated down.

// Create a new admin account (invite)
router.post(
  "/",
  authorize(ROLES.SUPER_ADMIN),
  validate(createAdminSchema),
  adminTeamController.createAdmin
);

// Deactivate an admin (revoke access)
router.patch(
  "/:id/deactivate",
  authorize(ROLES.SUPER_ADMIN),
  adminTeamController.deactivateAdmin
);

// Reactivate a previously deactivated admin
router.patch(
  "/:id/reactivate",
  authorize(ROLES.SUPER_ADMIN),
  adminTeamController.reactivateAdmin
);

module.exports = router;
