const mongoose = require("mongoose");

/**
 * Establishes a named secondary connection to a MongoDB database.
 * Used for the Question Bank DB (separate DB on the same Atlas cluster).
 *
 * Unlike the primary connection which uses mongoose.connect() (auto-reconnects
 * built-in), createConnection() requires explicit reconnect handling.
 *
 * Throws on initial failure — lets startServer() in index.js decide whether
 * to exit. Never call process.exit() inside a utility function.
 */
const connectDB = async (uri, label = "Database") => {
  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS:          45000,
  });

  conn.on("connected", () =>
    console.log(`[DB] ${label} connected: ${conn.host}`)
  );

  conn.on("error", (err) =>
    console.error(`[DB] ${label} error:`, err.message)
  );

  // Exponential backoff for reconnects — avoids hammering a misconfigured DB
  // and filling logs/memory with infinite rapid retries.
  let reconnectAttempts = 0;
  const MAX_BACKOFF_MS  = 60 * 1000; // cap at 60 seconds

  conn.on("disconnected", () => {
    reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_BACKOFF_MS);
    console.warn(
      `[DB] ${label} disconnected. Reconnect attempt #${reconnectAttempts} in ${delay / 1000}s...`
    );
    setTimeout(() => {
      conn.openUri(uri).catch((err) => {
        console.error(`[DB] ${label} reconnect #${reconnectAttempts} failed:`, err.message);
      });
    }, delay);
  });

  conn.on("reconnected", () => {
    reconnectAttempts = 0; // reset counter on successful reconnect
    console.log(`[DB] ${label} reconnected.`);
  });

  return conn;
};

module.exports = connectDB;
