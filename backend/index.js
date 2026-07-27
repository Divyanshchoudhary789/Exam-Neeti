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

const app = express();

// ─── Trust Proxy (required for Render deployment) ─────────────────────────────
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
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

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Conservative default — 50kb covers all normal API payloads.
// Bulk-import route gets its own higher limit via express.json({limit:"2mb"}) if needed.
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

app.use("/api", apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Exam Neeti API is running.",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// Bulk-import endpoint needs a larger body limit for student CSV payloads
app.use("/api/v1/users/bulk-import", express.json({ limit: "2mb" }));

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
