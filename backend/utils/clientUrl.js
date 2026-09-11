/**
 * Client URL helpers.
 *
 * CLIENT_URL is a COMMA-SEPARATED list of allowed frontend origins (used for
 * CORS), e.g. "https://examneeti.in,https://admin.examneeti.in". Building a link
 * by interpolating the raw env var therefore produces a broken URL like
 * "https://examneeti.in,https://admin.examneeti.in/student". Every outbound link
 * (emails, redirects) must go through here so it always resolves to the first,
 * canonical origin with no trailing slash.
 */

const primaryClientUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

/** Absolute URL for a path on the canonical frontend origin. */
const clientPath = (p = "") => {
  const path = String(p || "");
  return `${primaryClientUrl()}${path && !path.startsWith("/") ? `/${path}` : path}`;
};

/** Role-aware landing page (students and admins have different shells). */
const dashboardUrlFor = (role) =>
  clientPath(role === "admin" || role === "super_admin" ? "/admin" : "/student");

module.exports = { primaryClientUrl, clientPath, dashboardUrlFor };
