const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
} = require("../validators/auth.validator");

// ── Public routes ─────────────────────────────────────────────────────────────

router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.patch("/reset-password/:token", authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// ── Protected routes (require valid JWT) ─────────────────────────────────────

router.use(authenticate);

router.get("/me", authController.getMe);

router.patch(
  "/change-password",
  validate(changePasswordSchema),
  authController.changePassword
);

/**
 * POST /auth/logout
 * Invalidates the refresh token stored in the DB.
 * The access token remains valid until it expires naturally (short-lived by design).
 * Client must discard both tokens on receiving this response.
 */
router.post("/logout", authController.logout);

/**
 * POST /auth/logout-all
 * Invalidates ALL active sessions across every device.
 * Bumps passwordChangedAt so even valid access tokens are rejected by authenticate middleware.
 */
router.post("/logout-all", authController.logoutAll);

module.exports = router;
