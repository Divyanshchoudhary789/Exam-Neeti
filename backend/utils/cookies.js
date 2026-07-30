/**
 * Cookie utility — centralised cookie config so every auth endpoint
 * uses identical settings. Change once here, applies everywhere.
 *
 * Security properties:
 *  httpOnly  — JS cannot read the cookie (blocks XSS token theft)
 *  secure    — sent only over HTTPS in production
 *  sameSite  — "lax" for cross-origin support with CORS credentials
 *              (allows cookies on safe cross-site navigation like GET)
 *              Use "none" only if frontend is on different domain AND secure=true
 *  signed    — COOKIE_SECRET signs the cookie value; tamper-evident
 *  path      — refresh token scoped to its own endpoint only
 */

const isProd = () => process.env.NODE_ENV === "production";

// Access token cookie — 15 minutes
const ACCESS_TOKEN_COOKIE = "access_token";
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 min in ms

// Refresh token cookie — 30 days, scoped to refresh endpoint only
const REFRESH_TOKEN_COOKIE = "refresh_token";
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

/**
 * Determine sameSite value based on environment.
 * - Production: "none" if cross-origin, "lax" if same-origin
 * - Development: "lax" (works with localhost cross-port scenarios)
 */
const getSameSiteValue = () => {
  if (isProd()) {
    // In production, if CLIENT_URL is different domain, use "none" with secure:true
    // Otherwise use "lax" for better security
    const clientUrl = process.env.CLIENT_URL || "";
    const isClientCrossOrigin = clientUrl && !clientUrl.includes("://localhost");
    return isClientCrossOrigin ? "none" : "lax";
  }
  // Development: "lax" allows cookies across ports (localhost:3000 → localhost:10000)
  return "lax";
};

/**
 * Attach both tokens as httpOnly cookies on the response.
 */
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const sameSite = getSameSiteValue();
  const secure = isProd(); // Always true in production, false in development

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly:  true,
    secure:    secure,
    sameSite:  sameSite,
    signed:    true,
    maxAge:    ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly:  true,
    secure:    secure,
    sameSite:  sameSite,
    signed:    true,
    maxAge:    REFRESH_TOKEN_MAX_AGE,
    // Scope refresh token cookie to the refresh endpoint only.
    // Browser will NOT send it to any other route — limits exposure.
    path:      "/api/v1/auth/refresh-token",
  });
};

/**
 * Clear both auth cookies on logout.
 */
const clearAuthCookies = (res) => {
  const sameSite = getSameSiteValue();
  const secure = isProd();

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure:   secure,
    sameSite: sameSite,
    signed:   true,
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure:   secure,
    sameSite: sameSite,
    signed:   true,
    path:     "/api/v1/auth/refresh-token",
  });
};

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  clearAuthCookies,
};
