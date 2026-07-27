/**
 * Wraps an async route handler to automatically catch errors
 * and forward them to Express's error-handling middleware.
 * Eliminates repetitive try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
