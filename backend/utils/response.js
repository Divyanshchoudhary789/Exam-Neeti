/**
 * Standardized API response helpers.
 * Every controller should use these to maintain consistent response shape.
 */

const sendSuccess = (res, statusCode, message, data = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode, message, errors = null) => {
  const payload = { success: false, message };
  if (errors !== null) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

const sendPaginated = (res, statusCode, message, data, pagination) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };
