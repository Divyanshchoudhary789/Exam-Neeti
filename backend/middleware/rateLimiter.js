const rateLimit = require("express-rate-limit");

/**
 * General API rate limiter — applied to all /api routes.
 * Skip is controlled by an explicit env flag, not NODE_ENV,
 * so rate limiting is never accidentally disabled in production.
 */
const apiLimiter = rateLimit({
  windowMs:       parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:            parseInt(process.env.RATE_LIMIT_MAX,        10) || 100,
  standardHeaders: true,
  legacyHeaders:  false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
});

/**
 * Stricter limiter for auth endpoints — slows brute-force and credential-stuffing attacks.
 * Window is also configurable via env.
 */
const authLimiter = rateLimit({
  windowMs:       parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:            parseInt(process.env.AUTH_RATE_LIMIT_MAX,        10) || 10,
  standardHeaders: true,
  legacyHeaders:  false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
});

module.exports = { apiLimiter, authLimiter };
