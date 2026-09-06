/**
 * migrateQuestionStatus.js — one-time backfill for the draft/active status field.
 *
 * REQUIRED before (or with) the deploy that made exam-eligibility strict:
 * questionReconstruction.service.js and sprint.controller.js now select only
 * `status: "active"` (no longer `{$ne:"draft"}`), so any pre-existing question
 * with NO status field would silently drop out of every exam and every sprint
 * slot pool until this runs. It stamps status:"active" onto every such
 * question (these are the legacy seeded/manually-added questions that were
 * always meant to be exam-eligible).
 *
 * Safe + idempotent: only touches docs where `status` is missing.
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

  const conn = await connectDB(process.env.QUESTION_BANK_MONGO_URI, "Question Bank DB");
  // connectDB returns as soon as the Connection object exists; on a cold/slow
  // Atlas link the actual handshake can take longer than Mongoose's 10s
  // command-buffering window, so wait for it to be truly ready first.
  if (conn.readyState !== 1) await conn.asPromise();
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
