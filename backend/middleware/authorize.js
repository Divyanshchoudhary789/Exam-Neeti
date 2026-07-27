const AppError = require("../utils/AppError");
const { ROLES } = require("../config/constants");

/**
 * Authorization middleware factory.
 *
 * Usage:
 *   authorize(ROLES.ADMIN)                  — admin + super_admin
 *   authorize(ROLES.SUPER_ADMIN)            — super_admin only
 *   authorize(ROLES.ADMIN, ROLES.STUDENT)   — admin, super_admin, and student
 *
 * Rules:
 *  1. Must be used AFTER `authenticate` (req.user must be set).
 *  2. super_admin always passes through regardless of the roles list —
 *     they have platform-wide access to every endpoint.
 *  3. For super_admin-exclusive endpoints, pass authorize(ROLES.SUPER_ADMIN).
 *     super_admin still passes via the blanket bypass, while admin is blocked
 *     because "admin" is not in the roles array ["super_admin"].
 *
 * Role hierarchy (high → low):
 *   super_admin > admin > student
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required.", 401));
    }

    // super_admin has blanket access to every endpoint on the platform.
    // This single check is the source of truth — no route file needs to
    // list super_admin explicitly alongside admin.
    if (req.user.role === ROLES.SUPER_ADMIN) return next();

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    return next();
  };
};

module.exports = authorize;
