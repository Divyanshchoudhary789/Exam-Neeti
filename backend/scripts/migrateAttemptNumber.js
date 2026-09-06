/**
 * migrateAttemptNumber.js — one-time migration for reattempt support.
 *
 * Backfills `attemptNumber: 1` onto every pre-existing Attempt document (the
 * schema default only applies to NEW documents, not ones already in Mongo),
 * then swaps the old unique index { student, exam } for the new
 * { student, exam, attemptNumber } index that allows up to
 * MAX_ATTEMPTS_PER_EXAM (see config/constants.js) attempts per student per exam.
 *
 * MUST run before deploying the reattempt-enabled startAttempt/getMyExams code —
 * otherwise the old unique index rejects the second attempt with an E11000
 * before the new index even exists.
 *
 * Idempotent — safe to re-run (backfill only touches documents missing the
 * field; the index step no-ops if the target index already exists).
 *
 * Usage:
 *   node scripts/migrateAttemptNumber.js
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Attempt  = require("../models/Attempt.model");

const OLD_INDEX_NAME = "student_1_exam_1";
const NEW_INDEX_SPEC = { student: 1, exam: 1, attemptNumber: 1 };

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("\n[Migrate] ✖  MONGO_URI not set in .env\n");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("[Migrate] Connected.");

  // 1. Backfill attemptNumber on documents that predate the field.
  const backfillResult = await Attempt.updateMany(
    { attemptNumber: { $exists: false } },
    { $set: { attemptNumber: 1 } }
  );
  console.log(
    `[Migrate] Backfilled attemptNumber:1 on ${backfillResult.modifiedCount} attempt(s) ` +
    `(matched ${backfillResult.matchedCount}).`
  );

  // 2. Swap the unique index. Mongoose's own index sync (autoIndex) will
  //    create the new index from the schema on next connect, but we do it
  //    explicitly here so the drop+create happens in the right order and the
  //    script's exit code reflects success/failure.
  const existingIndexes = await Attempt.collection.indexes();
  const oldIndexExists = existingIndexes.some((idx) => idx.name === OLD_INDEX_NAME);
  const newIndexExists = existingIndexes.some(
    (idx) => JSON.stringify(idx.key) === JSON.stringify(NEW_INDEX_SPEC)
  );

  if (oldIndexExists) {
    await Attempt.collection.dropIndex(OLD_INDEX_NAME);
    console.log(`[Migrate] Dropped old unique index "${OLD_INDEX_NAME}".`);
  } else {
    console.log(`[Migrate] Old index "${OLD_INDEX_NAME}" not present — skipping drop.`);
  }

  if (!newIndexExists) {
    await Attempt.collection.createIndex(NEW_INDEX_SPEC, { unique: true });
    console.log("[Migrate] Created new unique index { student, exam, attemptNumber }.");
  } else {
    console.log("[Migrate] New index already present — skipping create.");
  }

  await mongoose.disconnect();
  console.log("[Migrate] Done.");
  process.exit(0);
};

run().catch((err) => {
  console.error("\n[Migrate] ✖  Failed:", err.message, "\n");
  process.exit(1);
});
