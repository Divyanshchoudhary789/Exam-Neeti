const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Generates a signed JWT access token.
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: "examneeti",
  });
};

/**
 * Generates a signed JWT refresh token.
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    issuer: "examneeti",
  });
};

/**
 * Verifies an access token. Throws if invalid or expired.
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, { issuer: "examneeti" });
};

/**
 * Verifies a refresh token. Throws if invalid or expired.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: "examneeti",
  });
};

/**
 * Generates a cryptographically secure random hex token for password reset, etc.
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString("hex");
};

/**
 * Hashes a token using SHA-256 so it can be stored in DB without exposing raw value.
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
};
