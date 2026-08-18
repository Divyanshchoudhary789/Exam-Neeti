const User = require("../models/User.model");
const AdminAuditLog = require("../models/AdminAuditLog.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
} = require("../utils/token");
const { setAuthCookies, clearAuthCookies } = require("../utils/cookies");
const { sendEmail, templates } = require("../services/email.service");
const { NOTIFICATION_TRIGGER, ROLES, ADMIN_ACTIONS } = require("../config/constants");

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isActive: true }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password.", 401));
  }

  const payload      = { id: user._id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token hash in DB for rotation / invalidation
  user.refreshTokenHash = hashToken(refreshToken);
  user.lastLoginAt      = new Date();
  await user.save({ validateBeforeSave: false });

  // Set httpOnly cookies — browser handles storage automatically
  setAuthCookies(res, { accessToken, refreshToken });

  // Audit log for admin/super_admin logins
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    try {
      await AdminAuditLog.create({
        actor:     user._id,
        actorRole: user.role,
        action:    ADMIN_ACTIONS.LOGIN,
        metadata:  { email: user.email },
        ip:        req.ip || null,
        userAgent: req.headers?.["user-agent"] || null,
      });
    } catch (err) {
      console.error("[Audit] Login audit write failed:", err.message);
    }
  }

  // Return user info in body — tokens are in cookies (production).
  // In non-production, also return accessToken in body so frontend dev on
  // localhost can use it via Authorization: Bearer header (cross-origin
  // HTTP→HTTPS environments don't support SameSite=None cookies).
  const responseData = {
    user: {
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      batch:       user.batch,
      lastLoginAt: user.lastLoginAt,
    },
  };

  // Only expose token in body in non-production for dev convenience
  if (process.env.NODE_ENV !== "production") {
    responseData.accessToken = accessToken;
  }

  return sendSuccess(res, 200, "Login successful.", responseData);
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

exports.refreshToken = asyncHandler(async (req, res, next) => {
  // Read from signed cookie first; fall back to request body for API clients
  const refreshToken =
    req.signedCookies?.refresh_token || req.body?.refreshToken;

  if (!refreshToken) {
    return next(new AppError("Refresh token not found. Please log in again.", 401));
  }

  // Verify signature
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    return next(new AppError("Invalid or expired refresh token. Please log in again.", 401));
  }

  // DB lookup — explicitly select all fields needed for validation
  const user = await User.findById(decoded.id)
    .select("+refreshTokenHash +passwordChangedAt isActive");

  if (!user || !user.isActive) {
    clearAuthCookies(res);
    return next(new AppError("User not found or inactive.", 401));
  }

  // Token rotation — verify hash matches what we stored
  const submittedHash = hashToken(refreshToken);
  if (!user.refreshTokenHash || user.refreshTokenHash !== submittedHash) {
    // Reuse detected — nuke all sessions
    user.refreshTokenHash = null;
    await user.save({ validateBeforeSave: false });
    clearAuthCookies(res);
    return next(
      new AppError("Refresh token reuse detected. All sessions invalidated. Please log in again.", 401)
    );
  }

  // Reject if password changed after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    clearAuthCookies(res);
    return next(new AppError("Password was recently changed. Please log in again.", 401));
  }

  // Issue new token pair (rotation)
  const payload         = { id: user._id, role: user.role, email: user.email };
  const newAccessToken  = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  // Set new cookies
  setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });

  // Only expose token in body in non-production (httpOnly cookie is the source of truth in prod)
  const responseData = process.env.NODE_ENV !== "production"
    ? { accessToken: newAccessToken }
    : {};

  return sendSuccess(res, 200, "Token refreshed.", responseData);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res, _next) => {
  // Clear DB hash so this refresh token can never be used again
  await User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null });

  // Clear cookies from browser
  clearAuthCookies(res);

  return sendSuccess(res, 200, "Logged out successfully.");
});

// ─── Logout All Devices ───────────────────────────────────────────────────────

exports.logoutAll = asyncHandler(async (req, res, _next) => {
  // Bump passwordChangedAt → ALL access tokens for this user are instantly invalid
  // (authenticate.js rejects tokens issued before this timestamp)
  await User.findByIdAndUpdate(req.user.id, {
    refreshTokenHash:  null,
    passwordChangedAt: new Date(),
  });

  clearAuthCookies(res);

  return sendSuccess(res, 200, "Logged out from all devices.");
});

// ─── Get Current User ─────────────────────────────────────────────────────────

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate("batch", "name");

  if (!user || !user.isActive) {
    return next(new AppError("User not found.", 404));
  }

  return sendSuccess(res, 200, "User profile fetched.", { user });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email, isActive: true });

  // Always same response — prevents email enumeration
  if (!user) {
    return sendSuccess(res, 200, "If that email is registered, a reset link has been sent.");
  }

  const rawToken    = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  user.passwordResetToken   = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendEmail({
      to:          user.email,
      subject:     "Password Reset Request — Exam Neeti",
      html:        templates.passwordReset({ name: user.name, resetUrl }),
      trigger:     NOTIFICATION_TRIGGER.PASSWORD_RESET,
      recipientId: user._id,
      contextRef:  user._id,
    });
  } catch (emailErr) {
    // FIX: Email failed — clear the orphaned token so the user can retry
    console.error("[Auth] forgotPassword email failed:", emailErr.message);
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send reset email. Please try again later.", 502));
  }

  return sendSuccess(res, 200, "If that email is registered, a reset link has been sent.");
});

// ─── Reset Password ───────────────────────────────────────────────────────────

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token }    = req.params;
  const { password } = req.body;

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    isActive: true,
  }).select("+password +passwordResetToken +passwordResetExpires");

  if (!user) {
    return next(new AppError("Reset token is invalid or has expired.", 400));
  }

  user.password             = password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash     = null; // invalidate all active sessions
  await user.save();

  // Clear any cookies still in browser
  clearAuthCookies(res);

  return sendSuccess(res, 200, "Password has been reset successfully. Please log in.");
});

// ─── Change Password ──────────────────────────────────────────────────────────

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");

  if (!user || !(await user.comparePassword(currentPassword))) {
    return next(new AppError("Current password is incorrect.", 401));
  }

  // Save first — pre-save hook sets passwordChangedAt.
  // Tokens are generated AFTER save so their iat is always > passwordChangedAt,
  // preventing an immediate "password changed" rejection on the very next request.
  user.password = newPassword;
  await user.save(); // pre-save hook hashes password and sets passwordChangedAt

  const payload         = { id: user._id, role: user.role, email: user.email };
  const newAccessToken  = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save({ validateBeforeSave: false });

  // Set fresh cookies so user stays logged in after password change
  setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });

  // Audit log for admins
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    try {
      await AdminAuditLog.create({
        actor:     user._id,
        actorRole: user.role,
        action:    ADMIN_ACTIONS.PASSWORD_CHANGED,
        metadata:  { email: user.email, selfChange: true },
        ip:        req.ip || null,
        userAgent: req.headers?.["user-agent"] || null,
      });
    } catch (err) {
      console.error("[Audit] Password change audit write failed:", err.message);
    }
  }

  return sendSuccess(res, 200, "Password changed successfully.");
});
