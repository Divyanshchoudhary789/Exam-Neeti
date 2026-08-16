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

  conn.on("disconnected", () => {
    console.warn(`[DB] ${label} disconnected. Attempting to reconnect...`);
    // FIX: Explicit reconnect for secondary connections — createConnection()
    // does not auto-reconnect the way mongoose.connect() does.
    setTimeout(() => {
      conn.openUri(uri).catch((err) => {
        console.error(`[DB] ${label} reconnect failed:`, err.message);
      });
    }, 5000); // back-off 5 seconds before retry
  });

  conn.on("reconnected", () =>
    console.log(`[DB] ${label} reconnected.`)
  );

  return conn;
};

module.exports = connectDB;
