const mongoose = require("mongoose");

/**
 * Establishes a named secondary connection to a MongoDB database.
 * Used for the Question Bank DB (separate DB on the same Atlas cluster).
 *
 * Throws on failure — let the caller (startServer in index.js) decide
 * whether to exit. Never call process.exit() inside a utility function.
 */
const connectDB = async (uri, label = "Database") => {
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  conn.on("connected",    ()    => console.log(`[DB] ${label} connected: ${conn.host}`));
  conn.on("error",        (err) => console.error(`[DB] ${label} error:`, err.message));
  conn.on("disconnected", ()    => console.warn(`[DB] ${label} disconnected.`));
  conn.on("reconnected",  ()    => console.log(`[DB] ${label} reconnected.`));

  return conn;
};

module.exports = connectDB;
