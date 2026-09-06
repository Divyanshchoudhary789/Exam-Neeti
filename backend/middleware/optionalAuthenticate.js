const User = require("../models/User.model");
const { verifyAccessToken } = require("../utils/token");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Best-effort authentication for endpoints that are PUBLIC but behave
 * differently for a signed-in admin (e.g. showing draft content). Sets
 * `req.user` when a valid token is present; otherwise silently continues
 * with `req.user` unset. Never returns 401.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  let token = req.signedCookies?.access_token;
  if (!token) {
    const h = req.headers.authorization;
    if (h && h.startsWith("Bearer ")) token = h.split(" ")[1];
  }
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select("name email role isActive passwordChangedAt");
    if (user && user.isActive && !user.changedPasswordAfter?.(decoded.iat)) {
      req.user = { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role };
    }
  } catch {
    /* ignore — treat as anonymous */
  }
  return next();
});

module.exports = optionalAuthenticate;
