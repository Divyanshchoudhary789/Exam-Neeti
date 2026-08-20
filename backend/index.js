require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const mainRouter = require("./routes/main.router");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { createQuestionModel } = require("./models/Question.model");
const AppError = require("./utils/AppError");

// ─── Startup: Validate required environment variables ─────────────────────────
// Fail fast with a clear error rather than mysterious runtime failures.
const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_PASS",
  "EMAIL_FROM_ADDRESS",
  "CLIENT_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "NODE_ENV",
];

const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(
    `[Startup] FATAL: Missing required environment variables:\n  ${missingVars.join("\n  ")}\n` +
    `Check your .env file against .env.example`
  );
  process.exit(1);
}

// Validate NODE_ENV is a recognised value — prevents silent dev-mode leaks in prod
if (!["development", "production", "test"].includes(process.env.NODE_ENV)) {
  console.error(
    `[Startup] FATAL: NODE_ENV must be "development", "production", or "test". Got: "${process.env.NODE_ENV}"`
  );
  process.exit(1);
}

// Warn if QUESTION_BANK_MONGO_URI is not set — exam generation will be unavailable
if (!process.env.QUESTION_BANK_MONGO_URI) {
  console.warn(
    "[Startup] WARNING: QUESTION_BANK_MONGO_URI is not set — " +
    "exam generation and slot stats will be unavailable."
  );
}

const app = express();

// ─── Trust Proxy (required for Render deployment) ─────────────────────────────
// Render (and most cloud platforms) sit behind a reverse proxy.
// Without this, req.ip will be the proxy IP, breaking rate limiting and audit logs.
// Set TRUST_PROXY=true in your Render/production environment variables.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "[Startup] WARNING: TRUST_PROXY is not set to 'true'. " +
    "Rate limiting and IP-based audit logs may not work correctly behind a reverse proxy. " +
    "Set TRUST_PROXY=true in your production environment."
  );
}

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Parse CLIENT_URL as comma-separated list for multiple origins
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,                    // required for cookies to work cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: [],
  })
);

// ─── CSRF mitigation ──────────────────────────────────────────────────────────
// Auth cookies use SameSite=None in production (required for the cross-origin
// frontend/backend deployment), which does NOT stop a third-party page from
// making the browser send a state-changing request with those cookies attached
// (CORS only blocks the attacker from reading the *response*). As defense in
// depth, reject state-changing requests whose Origin header doesn't match an
// allowed origin. Only enforced when Origin is present — non-browser API
// clients (Postman, mobile, server-to-server) don't send it and use the
// Authorization header instead, which isn't vulnerable to CSRF anyway.
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ success: false, message: "Request origin not allowed." });
  }
  return next();
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// FIX: Bulk-import override MUST come BEFORE the 50kb global parser, otherwise
// the 50kb limit fires first and rejects large payloads with a 413.
// Multer handles multipart/form-data for question uploads separately (no body-parser needed).
app.use("/api/v1/users/bulk-import", express.json({ limit: "2mb" }));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

app.use("/api", apiLimiter);

// ─── Root & Health Check ──────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Exam Neeti.",
    version: "1.0.0",
    docs:    "/health",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Exam Neeti API is running.",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api/v1", mainRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.all("/{*splat}", (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found.`, 404));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Database Connections & Server Bootstrap ─────────────────────────────────

const startServer = async () => {
  try {
    // Connect to platform database using default mongoose connection
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("[DB] Platform DB connected:", mongoose.connection.host);

    // Reconnect event handlers for the primary connection
    mongoose.connection.on("error", (err) => {
      console.error("[DB] Platform DB error:", err.message);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[DB] Platform DB disconnected. Mongoose will auto-reconnect.");
    });
    mongoose.connection.on("reconnected", () => {
      console.log("[DB] Platform DB reconnected.");
    });

    // Question bank database (separate DB, same Atlas cluster)
    let QuestionModel = null;
    if (process.env.QUESTION_BANK_MONGO_URI) {
      const questionBankConn = await connectDB(
        process.env.QUESTION_BANK_MONGO_URI,
        "Question Bank DB"
      );
      QuestionModel = createQuestionModel(questionBankConn);
      app.set("QuestionModel", QuestionModel);
      console.log("[App] Question model bound to Question Bank DB.");
    } else {
      console.warn(
        "[App] QUESTION_BANK_MONGO_URI not set — question bank features will be unavailable."
      );
    }

    const PORT = parseInt(process.env.PORT, 10) || 10000;

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `[App] Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
    });

    // ─── Graceful Shutdown ────────────────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n[App] ${signal} received. Closing server...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log("[App] MongoDB connection closed.");
        process.exit(0);
      });

      // Force exit if graceful shutdown hangs
      setTimeout(() => {
        console.error("[App] Forced shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      console.error("[App] Unhandled Rejection:", err.message);
      server.close(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      console.error("[App] Uncaught Exception:", err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error("[App] Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
