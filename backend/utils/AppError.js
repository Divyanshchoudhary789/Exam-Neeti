/**
 * Custom error class for operational errors.
 * Carries an HTTP status code so the global error handler can respond correctly.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} [code] machine-readable code the frontend can branch on
   *   (e.g. "PLAN_LIMIT") — surfaced by the error handler as `errorCode`.
   */
  constructor(message, statusCode, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
