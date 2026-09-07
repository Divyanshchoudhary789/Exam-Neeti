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
 *
 * Namespacing:
 *  `res.locals.authClient` (set by an app-level middleware in index.js from the
 *  `X-Auth-Client` header) prefixes the cookie names — the Super Admin console
 *  sends `superadmin` and gets `sa_access_token` / `sa_refresh_token`, keeping
 *  its session isolated from the main site that shares the same API + (in dev)
 *  the same `localhost` cookie jar.
 */

const isProd = () => process.env.NODE_ENV === "production";

// Base cookie names — a per-client prefix (e.g. "sa_") may be prepended.
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;                 // 15 min
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000;      // 30 days

/** Per-request cookie-name prefix ("" for the main site, "sa_" for the console). */
const prefixOf = (res) => (res && res.locals && res.locals.authClient) || "";

const accessCookieName = (res) => `${prefixOf(res)}${ACCESS_TOKEN_COOKIE}`;
const refreshCookieName = (res) => `${prefixOf(res)}${REFRESH_TOKEN_COOKIE}`;
/** The refresh cookie is scoped to the refresh endpoint only. */
const REFRESH_PATH = "/api/v1/auth/refresh-token";

const getSameSiteValue = () => (isProd() ? "none" : "lax");

/** Attach both tokens as httpOnly cookies on the response. */
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const sameSite = getSameSiteValue();
  const secure = isProd();

  res.cookie(accessCookieName(res), accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    signed: true,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  res.cookie(refreshCookieName(res), refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    signed: true,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: REFRESH_PATH,
  });
};

/** Clear both auth cookies on logout / invalid-token. */
const clearAuthCookies = (res) => {
  const sameSite = getSameSiteValue();
  const secure = isProd();

  res.clearCookie(accessCookieName(res), { httpOnly: true, secure, sameSite, signed: true });
  res.clearCookie(refreshCookieName(res), { httpOnly: true, secure, sameSite, signed: true, path: REFRESH_PATH });
};

/** Read the access token from the correctly-namespaced signed cookie. */
const readAccessCookie = (req, res) => req.signedCookies?.[accessCookieName(res)];
/** Read the refresh token from the correctly-namespaced signed cookie. */
const readRefreshCookie = (req, res) => req.signedCookies?.[refreshCookieName(res)];

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
};
