/**
 * clearPatternSlotTags.js  — ONE-TIME migration script
 *
 * Run this ONCE on your Question Bank DB to reset patternSlotTags on all
 * existing questions to [] (empty array).
 *
 * WHY:
 *   Previous versions required manual sprint-tagging. Questions may have been
 *   tagged to a now-deleted sprint, or tagged in a way that restricts them from
 *   being picked for new sprints.
 *
 *   After this migration, the reconstruction engine uses attribute-based matching
 *   (subject / chapter / difficulty / topic) and empty patternSlotTags means
 *   "open pool — eligible for any sprint".
 *
 * SAFETY:
 *   - Only touches the Question Bank DB (QUESTION_BANK_MONGO_URI).
 *   - Does NOT delete questions or modify any other field.
 *   - Safe to re-run — already-empty tags are a no-op in MongoDB $set.
 *   - Use --dry-run to preview without writing.
 *
 * Usage:
 *   node scripts/clearPatternSlotTags.js
 *   node scripts/clearPatternSlotTags.js --dry-run
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const connectDB          = require("../config/db");
const { questionSchema } = require("../models/Question.model");

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  if (!process.env.QUESTION_BANK_MONGO_URI) {
    console.error("\n[Migration] ✖  QUESTION_BANK_MONGO_URI not set in .env\n");
    process.exit(1);
  }

  console.log("\n[Migration] Connecting to Question Bank DB...");
  const conn     = await connectDB(process.env.QUESTION_BANK_MONGO_URI, "Question Bank DB");
  const Question = conn.model("Question", questionSchema);
  console.log("[Migration] ✔  Connected.\n");

  // Count how many questions have non-empty patternSlotTags
  const taggedCount = await Question.countDocuments({
    patternSlotTags: { $exists: true, $not: { $size: 0 } },
  });

  const totalCount = await Question.countDocuments({});

  console.log(`[Migration] Total questions      : ${totalCount}`);
  console.log(`[Migration] With patternSlotTags : ${taggedCount}`);
  console.log(`[Migration] Dry run              : ${isDryRun}\n`);

  if (taggedCount === 0) {
    console.log("[Migration] ✔  No questions have patternSlotTags — nothing to do.\n");
    await conn.close();
    process.exit(0);
  }

  if (isDryRun) {
    console.log(`[Migration] DRY RUN — would reset patternSlotTags on ${taggedCount} question(s).\n`);
    await conn.close();
    process.exit(0);
  }

  console.log(`[Migration] Clearing patternSlotTags on ${taggedCount} question(s)...`);

  const result = await Question.updateMany(
    { patternSlotTags: { $exists: true, $not: { $size: 0 } } },
    { $set: { patternSlotTags: [] } }
  );

  console.log(`[Migration] ✔  Done — ${result.modifiedCount} question(s) updated.\n`);
  console.log(
    "[Migration] All questions now have empty patternSlotTags.\n" +
    "            They are eligible for any sprint — no further steps needed.\n"
  );

  await conn.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("\n[Migration] ✖  Fatal error:", err.message, "\n");
  process.exit(1);
});
