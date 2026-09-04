/**
 * recomputeAnalytics.js — recompute analytics after a formula change.
 *
 * Run this once after deploying the Difficulty Probability Multiplier V1
 * (P(Medium)=P(Easy)×0.8, P(Hard)=P(Easy)×0.6) and the relative ROI
 * Classification Framework, so existing StudentProbability / AnalyticsResult /
 * AdvancedAnalytics documents stop reflecting the old formulas.
 *
 * What it does:
 *   1. Re-derives pMedium / pHard from the stored pEasy on every
 *      StudentProbability chapter (new multipliers).
 *   2. Re-runs computeCompleteAnalytics() for every SUBMITTED attempt
 *      (basic + advanced analytics upsert in place).
 *
 * It is idempotent — safe to run more than once.
 *
 * Usage:
 *   node scripts/recomputeAnalytics.js                 # everything
 *   node scripts/recomputeAnalytics.js --dry-run       # report only, no writes
 *   node scripts/recomputeAnalytics.js --sprint=<id>   # limit to one sprint
 *   node scripts/recomputeAnalytics.js --skip-probability
 *   node scripts/recomputeAnalytics.js --skip-analytics
 *   node scripts/recomputeAnalytics.js --limit=50
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const getFlag = (name) => args.includes(`--${name}`);
const getOpt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

const DRY_RUN = getFlag("dry-run");
const SPRINT_ID = getOpt("sprint");
const LIMIT = getOpt("limit") ? parseInt(getOpt("limit"), 10) : null;
const SKIP_PROBABILITY = getFlag("skip-probability");
const SKIP_ANALYTICS = getFlag("skip-analytics");

const StudentProbability = require("../models/StudentProbability.model");
const Attempt = require("../models/Attempt.model");
const { ATTEMPT_STATUS } = require("../config/constants");
const { deriveDifficultyProbabilities } = require("../config/analyticsFormulas");
const { computeCompleteAnalytics } = require("../services/analytics.service");

const log = (...a) => console.log("[recompute]", ...a);

async function recomputeProbabilities(sprintFilter) {
  const filter = sprintFilter ? { sprint: sprintFilter } : {};
  const docs = await StudentProbability.find(filter);
  log(`StudentProbability docs: ${docs.length}`);

  let changed = 0;
  for (const doc of docs) {
    let touched = false;
    for (const ch of doc.chapters || []) {
      const { pMedium, pHard } = deriveDifficultyProbabilities(ch.pEasy);
      if (round4(ch.pMedium) !== round4(pMedium) || round4(ch.pHard) !== round4(pHard)) {
        ch.pMedium = pMedium;
        ch.pHard = pHard;
        touched = true;
      }
    }
    if (touched) {
      changed++;
      if (!DRY_RUN) await doc.save();
    }
  }
  log(`  re-derived pMedium/pHard on ${changed} doc(s)${DRY_RUN ? " (dry-run, not saved)" : ""}`);
}

const round4 = (v) => Math.round((Number(v) || 0) * 1e4) / 1e4;

async function recomputeAttemptAnalytics(sprintFilter) {
  const filter = { status: ATTEMPT_STATUS.SUBMITTED };
  if (sprintFilter) filter.sprint = sprintFilter;

  const total = await Attempt.countDocuments(filter);
  log(`Submitted attempts: ${total}${LIMIT ? ` (processing first ${LIMIT})` : ""}`);
  if (DRY_RUN) {
    log("  dry-run — not recomputing analytics");
    return;
  }

  const cursor = Attempt.find(filter).sort({ submittedAt: 1 }).lean().cursor();
  let done = 0;
  let failed = 0;
  for await (const attempt of cursor) {
    try {
      await computeCompleteAnalytics(attempt);
    } catch (err) {
      failed++;
      console.error(`  ! attempt ${attempt._id}: ${err.message}`);
    }
    done++;
    if (done % 25 === 0) log(`  ${done}/${LIMIT || total}`);
    if (LIMIT && done >= LIMIT) break;
  }
  log(`  recomputed ${done} attempt(s), ${failed} failure(s)`);
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("\n[recompute] MONGO_URI not set in .env\n");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  log(`connected${DRY_RUN ? " (DRY RUN)" : ""}${SPRINT_ID ? ` sprint=${SPRINT_ID}` : ""}`);

  const sprintFilter =
    SPRINT_ID && mongoose.Types.ObjectId.isValid(SPRINT_ID)
      ? new mongoose.Types.ObjectId(SPRINT_ID)
      : null;
  if (SPRINT_ID && !sprintFilter) {
    console.error(`[recompute] invalid --sprint id: ${SPRINT_ID}`);
    process.exit(1);
  }

  if (!SKIP_PROBABILITY) await recomputeProbabilities(sprintFilter);
  if (!SKIP_ANALYTICS) await recomputeAttemptAnalytics(sprintFilter);

  await mongoose.connection.close();
  log("done");
  process.exit(0);
})().catch((err) => {
  console.error("[recompute] fatal:", err);
  process.exit(1);
});
