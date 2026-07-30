const User = require("../models/User.model");
const { verifyAccessToken } = require("../utils/token");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Authentication middleware.
 *
 * Token extraction priority:
 *  1. Signed httpOnly cookie  → web app (most secure, automatic)
 *  2. Authorization: Bearer   → Postman / API clients / mobile (fallback)
 *
 * Security checks:
 *  1. Token present and valid signature
 *  2. User still exists in DB (catches deleted accounts)
 *  3. User account is active (catches deactivated accounts — token would
 *     otherwise remain valid until expiry)
 *  4. Password not changed after token was issued (catches stolen tokens
 *     after a password reset)
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // ── 1. Cookie (web app — preferred) ─────────────────────────────────────────
  if (req.signedCookies?.access_token) {
    token = req.signedCookies.access_token;
  }

  // ── 2. Authorization header (Postman / API clients — fallback) ───────────────
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return next(new AppError("Authentication required. Please log in.", 401));
  }

  // ── Verify signature & expiry ────────────────────────────────────────────────
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    // Clear cookie if it was a cookie-based token (might be tampered/expired)
    if (req.signedCookies?.access_token) {
      res.clearCookie("access_token", { httpOnly: true, signed: true });
    }
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Session expired. Please log in again.", 401));
    }
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  // ── DB lookup — always check current account state ───────────────────────────
  const user = await User.findById(decoded.id)
    .select("isActive role passwordChangedAt")
    .lean();

  if (!user) {
    return next(new AppError("The account belonging to this token no longer exists.", 401));
  }

  if (!user.isActive) {
    return next(
      new AppError("Your account has been deactivated. Contact an administrator.", 401)
    );
  }

  // ── Password change check ────────────────────────────────────────────────────
  if (user.passwordChangedAt) {
    const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < changedAt) {
      return next(
        new AppError("Password was recently changed. Please log in again.", 401)
      );
    }
  }

  // ── Attach to request — role always from DB, never stale JWT ─────────────────
  req.user = {
    id:    decoded.id,
    email: decoded.email,
    role:  user.role,
  };

  return next();
});

module.exports = authenticate;
