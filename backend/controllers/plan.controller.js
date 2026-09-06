const Plan = require("../models/Plan.model");
const Batch = require("../models/Batch.model");
const Exam = require("../models/Exam.model");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { BATCH_SOURCE, ROLES, EXAM_STATUS } = require("../config/constants");

// ─── Public: List active plans ────────────────────────────────────────────────
// Prices/features are served from here (not hardcoded twice in the frontend)
// so a pricing change is one seed re-run away and can never be tampered with
// client-side — /payments/create-order always re-looks-up the price server-side.

exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true })
    .select("key name priceRupees durationDays testsIncluded description batchSlug")
    .sort({ priceRupees: 1 });

  return sendSuccess(res, 200, "Plans fetched.", { plans });
});

// ─── Admin: Per-plan overview ────────────────────────────────────────────────
// For each self-serve plan: its public batch, how many exams target it (total
// + published) and how many students are on it. Powers the admin "Plans &
// Tiers" panel and lets an admin pick a plan's batch when creating an exam.

exports.getAdminOverview = asyncHandler(async (req, res) => {
  const plans = await Plan.find({}).sort({ priceRupees: 1 }).lean();
  const slugs = plans.map((p) => p.batchSlug);

  const batches = await Batch.find({ slug: { $in: slugs }, source: BATCH_SOURCE.PUBLIC })
    .lean({ virtuals: true });
  const batchBySlug = new Map(batches.map((b) => [b.slug, b]));

  const overview = await Promise.all(
    plans.map(async (plan) => {
      const batch = batchBySlug.get(plan.batchSlug) || null;
      let examCount = 0;
      let publishedCount = 0;
      let studentCount = 0;

      if (batch) {
        [examCount, publishedCount, studentCount] = await Promise.all([
          Exam.countDocuments({ batch: batch._id }),
          Exam.countDocuments({ batch: batch._id, status: { $in: [EXAM_STATUS.PUBLISHED, EXAM_STATUS.COMPLETED] } }),
          User.countDocuments({ batch: batch._id, role: ROLES.STUDENT, isActive: true }),
        ]);
      }

      return {
        key: plan.key,
        name: plan.name,
        priceRupees: plan.priceRupees,
        durationDays: plan.durationDays ?? null,
        testsIncluded: plan.testsIncluded,
        isActive: plan.isActive,
        batchId: batch?._id || null,
        batchSlug: plan.batchSlug,
        batchName: batch?.name || null,
        examCount,
        publishedCount,
        studentCount,
        isFreeTier: plan.priceRupees === 0,
      };
    })
  );

  return sendSuccess(res, 200, "Plan overview fetched.", { overview });
});
