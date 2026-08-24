/**
 * migrateQuestionStatus.js — one-time backfill for the draft/active status field.
 *
 * NOT required for correctness — questionReconstruction.service.js already
 * treats a missing `status` field as exam-eligible (status: {$ne:"draft"}),
 * so nothing breaks if this never runs. This is purely for dashboard-display
 * cleanliness: it stamps status:"active" onto every pre-existing question so
 * status badges/filters in the UI reflect real values instead of "undefined".
 *
 * Usage:
 *   node scripts/migrateQuestionStatus.js
 */

require("dotenv").config();

const connectDB          = require("../config/db");
const { questionSchema } = require("../models/Question.model");

const run = async () => {
  if (!process.env.QUESTION_BANK_MONGO_URI) {
    console.error("\n[Migrate] ✖  QUESTION_BANK_MONGO_URI not set in .env\n");
    process.exit(1);
  }

  const conn     = await connectDB(process.env.QUESTION_BANK_MONGO_URI, "Question Bank DB");
  const Question = conn.model("Question", questionSchema);

  const result = await Question.updateMany(
    { status: { $exists: false } },
    { $set: { status: "active" } }
  );

  console.log(
    `\n[Migrate] Backfilled status:"active" on ${result.modifiedCount} question(s) ` +
    `(matched ${result.matchedCount}).\n`
  );

  await conn.close();
  process.exit(0);
};

run().catch((err) => {
  console.error("\n[Migrate] ✖  Failed:", err.message, "\n");
  process.exit(1);
});
