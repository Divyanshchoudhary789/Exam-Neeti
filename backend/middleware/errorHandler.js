const AppError = require("../utils/AppError");

const handleCastErrorDB = (err) =>
  new AppError(`Invalid value for field: ${err.path}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || "field";
  return new AppError(`Duplicate value for ${field}. Please use a different value.`, 409);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Validation failed: ${errors.join(". ")}`, 400);
};

const handleJWTError       = () => new AppError("Invalid token. Please log in again.", 401);
const handleJWTExpiredError = () => new AppError("Your session has expired. Please log in again.", 401);

// ─── Dev: full details ────────────────────────────────────────────────────────

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success:    false,
    message:    err.message,
    stack:      err.stack,
    error:      err,
  });
};

// ─── Prod: operational errors only ───────────────────────────────────────────

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  // Programming / unknown error — never leak internals
  console.error("[ERROR] Unhandled:", err);
  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
  });
};

// ─── Global error handler ─────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === "development") {
    return sendErrorDev(err, res);
  }

  // Shallow-clone preserving all enumerable + essential non-enumerable props
  // Using spread + explicit key copy avoids the Object.assign prototype issue
  // where Mongoose ValidationError.errors (non-enumerable) was missed.
  const error = {
    ...err,
    message:  err.message,
    name:     err.name,
    code:     err.code,
    path:     err.path,
    keyValue: err.keyValue,
    errors:   err.errors,
  };
  error.isOperational = err.isOperational;
  error.statusCode    = err.statusCode || 500;

  if (error.name === "CastError")       return sendErrorProd(handleCastErrorDB(error),       res);
  if (error.code === 11000)             return sendErrorProd(handleDuplicateFieldsDB(error),  res);
  if (error.name === "ValidationError") return sendErrorProd(handleValidationErrorDB(error),  res);
  if (error.name === "JsonWebTokenError") return sendErrorProd(handleJWTError(),              res);
  if (error.name === "TokenExpiredError") return sendErrorProd(handleJWTExpiredError(),       res);

  sendErrorProd(error, res);
};

module.exports = errorHandler;
