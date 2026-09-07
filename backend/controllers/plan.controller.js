const Plan = require("../models/Plan.model");
const Batch = require("../models/Batch.model");
const Exam = require("../models/Exam.model");
const User = require("../models/User.model");
const Subscription = require("../models/Subscription.model");
const AdminAuditLog = require("../models/AdminAuditLog.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { BATCH_SOURCE, ROLES, EXAM_STATUS, PLAN_KEYS, ADMIN_ACTIONS } = require("../config/constants");

// Plan keys / batch slugs are strict lowercase-dash slugs (see Plan.model).
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** A slug unique across the Plan collection (`base`, `base-2`, `base-3`, …). */
async function uniquePlanKey(base) {
  const root = slugify(base) || "plan";
  let key = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (await Plan.exists({ key })) {
    n += 1;
    key = `${root}-${n}`.slice(0, 40);
  }
  return key;
}

const audit = (req, action, metadata) =>
  AdminAuditLog.create({
    actor: req.user.id,
    actorRole: req.user.role,
    action,
    target: null,
    metadata,
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
  }).catch((err) => console.error(`[Plan] audit ${action} failed:`, err.message));

// ─── Public: list active plans ────────────────────────────────────────────────
// Prices/features are served from here (not hardcoded in the frontend) so the
// pricing page and the in-dashboard upgrade modal both stay in sync with the DB.
// /payments/create-order always re-looks-up the price server-side.

exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true })
    .select("key name priceRupees durationDays testsIncluded description batchSlug programType tagline features examBreakdown featured sortOrder")
    .sort({ sortOrder: 1, priceRupees: 1 });

  return sendSuccess(res, 200, "Plans fetched.", { plans });
});

// ─── Admin: Per-plan overview ────────────────────────────────────────────────
// For each plan: its public batch, how many exams target it (total + published),
// how many students sit on it and how many subscriptions reference it. Powers
// the admin "Plans & Tiers" panel.

exports.getAdminOverview = asyncHandler(async (req, res) => {
  const plans = await Plan.find({}).sort({ sortOrder: 1, priceRupees: 1 }).lean();
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

      const subscriberCount = await Subscription.countDocuments({ plan: plan._id });

      return {
        _id: plan._id,
        key: plan.key,
        name: plan.name,
        priceRupees: plan.priceRupees,
        durationDays: plan.durationDays ?? null,
        testsIncluded: plan.testsIncluded,
        description: plan.description || "",
        programType: plan.programType || null,
        tagline: plan.tagline || "",
        features: plan.features || [],
        examBreakdown: plan.examBreakdown || { minor: 0, semiMajor: 0, major: 0 },
        featured: Boolean(plan.featured),
        sortOrder: plan.sortOrder ?? 0,
        isActive: plan.isActive,
        isTrial: plan.key === PLAN_KEYS.TRIAL,
        batchId: batch?._id || null,
        batchSlug: plan.batchSlug,
        batchName: batch?.name || null,
        examCount,
        publishedCount,
        studentCount,
        subscriberCount,
        isFreeTier: plan.priceRupees === 0,
      };
    })
  );

  return sendSuccess(res, 200, "Plan overview fetched.", { overview });
});

// ─── Admin: create a plan (+ its public batch) ───────────────────────────────

exports.createPlan = asyncHandler(async (req, res, next) => {
  const {
    name, priceRupees, durationDays, testsIncluded, description,
    programType, tagline, features, examBreakdown, featured, sortOrder,
    batchMode, batchName, batchSlug,
  } = req.body;

  const key = await uniquePlanKey(name);

  // ── Resolve the linked public batch ──────────────────────────────────────
  let batch;
  let createdBatch = false;

  if (batchMode === "link") {
    batch = await Batch.findOne({ slug: batchSlug, source: BATCH_SOURCE.PUBLIC });
    if (!batch) {
      return next(new AppError(`No public batch found with slug "${batchSlug}".`, 404));
    }
    const taken = await Plan.exists({ batchSlug: batch.slug });
    if (taken) {
      return next(new AppError(`Batch "${batch.name}" is already linked to another plan.`, 409));
    }
  } else {
    const newSlug = `plan-${key}`;
    if (await Batch.exists({ slug: newSlug })) {
      return next(new AppError(`A batch with slug "${newSlug}" already exists. Rename the plan or link that batch.`, 409));
    }
    batch = await Batch.create({
      name: (batchName || name).trim(),
      description: `Self-serve batch for the "${name}" plan. Students who buy this plan join here.`,
      programType: programType || null,
      source: BATCH_SOURCE.PUBLIC,
      slug: newSlug,
      isActive: true,
      createdBy: req.user.id,
    });
    createdBatch = true;
  }

  // ── Create the plan ─────────────────────────────────────────────────────
  let plan;
  try {
    plan = await Plan.create({
      key,
      name: name.trim(),
      priceRupees,
      durationDays: durationDays ?? null,
      testsIncluded: testsIncluded ?? 0,
      description: description || "",
      programType: programType || null,
      tagline: tagline || "",
      features: Array.isArray(features) ? features : [],
      examBreakdown: examBreakdown || {},
      featured: Boolean(featured),
      sortOrder: sortOrder ?? 0,
      batchSlug: batch.slug,
      isActive: true,
    });
  } catch (err) {
    // Roll back a batch we just created so we don't leak an orphan.
    if (createdBatch) await Batch.deleteOne({ _id: batch._id }).catch(() => {});
    throw err;
  }

  await audit(req, ADMIN_ACTIONS.PLAN_CREATED, {
    planId: plan._id, planKey: key, planName: plan.name,
    batchId: batch._id, batchSlug: batch.slug, batchCreated: createdBatch,
  });

  return sendSuccess(res, 201, "Plan created.", { plan, batch });
});

// ─── Admin: update a plan ───────────────────────────────────────────────────

exports.updatePlan = asyncHandler(async (req, res, next) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) return next(new AppError("Plan not found.", 404));

  const isTrial = plan.key === PLAN_KEYS.TRIAL;
  const body = req.body;
  const FIELDS = [
    "name", "priceRupees", "durationDays", "testsIncluded", "description",
    "programType", "tagline", "features", "examBreakdown", "featured", "sortOrder", "isActive",
  ];

  const before = {};
  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    if (isTrial && f === "priceRupees") continue;          // free tier stays free
    if (isTrial && f === "isActive" && body[f] === false) continue; // can't disable the free tier
    before[f] = plan[f];
    plan[f] = body[f];
  }
  if (isTrial) plan.priceRupees = 0;

  await plan.save();

  // Keep the linked batch's programType in lock-step with the plan.
  if (body.programType !== undefined) {
    await Batch.updateOne(
      { slug: plan.batchSlug, source: BATCH_SOURCE.PUBLIC },
      { $set: { programType: body.programType || null } }
    );
  }

  await audit(req, ADMIN_ACTIONS.PLAN_UPDATED, {
    planId: plan._id, planKey: plan.key, changed: Object.keys(before),
  });

  return sendSuccess(res, 200, "Plan updated.", { plan });
});

// ─── Super admin: delete a plan (+ its empty public batch) ───────────────────

exports.deletePlan = asyncHandler(async (req, res, next) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) return next(new AppError("Plan not found.", 404));

  if (plan.key === PLAN_KEYS.TRIAL) {
    return next(new AppError("The free Trial plan is required by the platform and can't be deleted.", 400));
  }

  const batch = await Batch.findOne({ slug: plan.batchSlug, source: BATCH_SOURCE.PUBLIC });

  const [subCount, studentCount, examCount] = await Promise.all([
    Subscription.countDocuments({ plan: plan._id }),
    batch ? User.countDocuments({ batch: batch._id, role: ROLES.STUDENT }) : 0,
    batch ? Exam.countDocuments({ batch: batch._id }) : 0,
  ]);

  if (subCount > 0 || studentCount > 0 || examCount > 0) {
    return next(new AppError(
      `This plan has history (${subCount} subscription(s), ${studentCount} student(s), ${examCount} exam(s)). ` +
      `Deactivate it instead — it'll disappear from checkout while keeping records intact.`,
      409
    ));
  }

  await Plan.deleteOne({ _id: plan._id });
  if (batch) await Batch.deleteOne({ _id: batch._id });

  await audit(req, ADMIN_ACTIONS.PLAN_DELETED, {
    planId: plan._id, planKey: plan.key, planName: plan.name,
    batchId: batch?._id || null, batchSlug: plan.batchSlug,
  });

  return sendSuccess(res, 200, "Plan and its batch deleted.", {
    deletedPlanId: plan._id,
    deletedBatchId: batch?._id || null,
  });
});
