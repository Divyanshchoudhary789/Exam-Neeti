/**
 * Revenue & Billing Controller — super_admin only.
 *
 * Everything here is derived from real payment records:
 *   - Order        → one row per Razorpay checkout (status: created | paid | failed)
 *   - Subscription → one row per plan lifecycle event (trial / active / expired)
 *   - Plan         → the priced catalog
 *
 * There is no mock data anywhere in this file. When the platform has taken no
 * payments yet every figure below is simply 0 / empty.
 */

const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const Subscription = require("../models/Subscription.model");
const Plan = require("../models/Plan.model");
const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const {
  ORDER_STATUS,
  SUBSCRIPTION_STATUS,
  ROLES,
  BATCH_SOURCE,
  PLAN_KEYS,
} = require("../config/constants");

const PAISE_PER_RUPEE = 100;
const rupees = (paise) => Math.round((Number(paise || 0) / PAISE_PER_RUPEE) * 100) / 100;
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const pct = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);

const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A paid order's money changed hands when it flipped to `paid` (updatedAt).
 *  Falls back to createdAt for any legacy row that never got re-saved. */
const paidAtExpr = { $ifNull: ["$updatedAt", "$createdAt"] };

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d) => d.toLocaleString("en-US", { month: "short", year: "2-digit" });

// ───────────────────────────────────────────────────────────────────────────
// GET /revenue/summary — headline KPIs + 12-month trend + per-plan split
// ───────────────────────────────────────────────────────────────────────────

exports.getRevenueSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = addMonths(thisMonthStart, -1);
  const monthsBack = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 3), 24);
  const windowStart = addMonths(thisMonthStart, -(monthsBack - 1));

  const paidMatch = { status: ORDER_STATUS.PAID };

  // Public batches back the self-serve plan catalog. The trial batch is free.
  const publicBatches = await Batch.find({ source: BATCH_SOURCE.PUBLIC })
    .select("_id slug")
    .lean();
  const publicBatchIds = publicBatches.map((b) => b._id);
  const paidBatchIds = publicBatches
    .filter((b) => b.slug !== "public-trial")
    .map((b) => b._id);

  const [
    lifetimeAgg,
    thisMonthAgg,
    lastMonthAgg,
    statusCountsAgg,
    payingCustomersAgg,
    firstOrder,
    subStatusAgg,
    mrrAgg,
    trendAgg,
    planAgg,
    activeSubsByPlanAgg,
    totalStudents,
    activeStudents,
    selfServeStudents,
    payingStudentsNow,
    trialStudentsNow,
  ] = await Promise.all([
    Order.aggregate([
      { $match: paidMatch },
      { $group: { _id: null, revenue: { $sum: "$amountPaise" }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, $expr: { $gte: [paidAtExpr, thisMonthStart] } } },
      { $group: { _id: null, revenue: { $sum: "$amountPaise" }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      {
        $match: {
          ...paidMatch,
          $expr: {
            $and: [
              { $gte: [paidAtExpr, lastMonthStart] },
              { $lt: [paidAtExpr, thisMonthStart] },
            ],
          },
        },
      },
      { $group: { _id: null, revenue: { $sum: "$amountPaise" }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: paidMatch },
      { $group: { _id: "$student" } },
      { $count: "count" },
    ]),
    Order.findOne(paidMatch).sort({ createdAt: 1 }).select("createdAt updatedAt").lean(),
    Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Subscription.aggregate([
      { $match: { status: SUBSCRIPTION_STATUS.ACTIVE } },
      { $match: { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] } },
      { $lookup: { from: "plans", localField: "plan", foreignField: "_id", as: "plan" } },
      { $unwind: "$plan" },
      {
        $group: {
          _id: null,
          activeCount: { $sum: 1 },
          mrrPaise: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$plan.durationDays", 0] },
                    { $gt: ["$plan.priceRupees", 0] },
                  ],
                },
                {
                  $multiply: [
                    { $divide: [{ $multiply: ["$plan.priceRupees", PAISE_PER_RUPEE] }, "$plan.durationDays"] },
                    30,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...paidMatch, $expr: { $gte: [paidAtExpr, windowStart] } } },
      {
        $group: {
          _id: {
            y: { $year: paidAtExpr },
            m: { $month: paidAtExpr },
          },
          revenue: { $sum: "$amountPaise" },
          orders: { $sum: 1 },
          customers: { $addToSet: "$student" },
        },
      },
      { $project: { revenue: 1, orders: 1, customers: { $size: "$customers" } } },
    ]),
    Order.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: "$plan",
          revenue: { $sum: "$amountPaise" },
          orders: { $sum: 1 },
          customers: { $addToSet: "$student" },
        },
      },
      { $project: { revenue: 1, orders: 1, customers: { $size: "$customers" } } },
    ]),
    Subscription.aggregate([
      { $match: { status: SUBSCRIPTION_STATUS.ACTIVE } },
      { $match: { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] } },
      { $group: { _id: "$plan", count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
    publicBatchIds.length
      ? User.countDocuments({ role: ROLES.STUDENT, batch: { $in: publicBatchIds } })
      : 0,
    paidBatchIds.length
      ? User.countDocuments({ role: ROLES.STUDENT, batch: { $in: paidBatchIds } })
      : 0,
    Batch.findOne({ slug: "public-trial", source: BATCH_SOURCE.PUBLIC })
      .select("_id")
      .lean()
      .then((b) => (b ? User.countDocuments({ role: ROLES.STUDENT, batch: b._id }) : 0)),
  ]);

  const lifetimeRevenuePaise = lifetimeAgg[0]?.revenue || 0;
  const paidOrders = lifetimeAgg[0]?.orders || 0;
  const payingCustomers = payingCustomersAgg[0]?.count || 0;

  const statusCounts = statusCountsAgg.reduce(
    (acc, r) => ({ ...acc, [r._id]: r.count }),
    { created: 0, paid: 0, failed: 0 }
  );
  const totalOrders = statusCounts.created + statusCounts.paid + statusCounts.failed;

  const subCounts = subStatusAgg.reduce(
    (acc, r) => ({ ...acc, [r._id]: r.count }),
    { trial: 0, active: 0, expired: 0, cancelled: 0 }
  );

  const revenueThisMonthPaise = thisMonthAgg[0]?.revenue || 0;
  const revenueLastMonthPaise = lastMonthAgg[0]?.revenue || 0;

  // ── 12-month trend, zero-filled so the chart never has gaps ──────────────
  const trendMap = new Map(
    trendAgg.map((t) => [`${t._id.y}-${String(t._id.m).padStart(2, "0")}`, t])
  );
  const timeseries = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = addMonths(windowStart, i);
    const hit = trendMap.get(monthKey(d));
    timeseries.push({
      month: monthKey(d),
      label: monthLabel(d),
      revenue: rupees(hit?.revenue || 0),
      orders: hit?.orders || 0,
      customers: hit?.customers || 0,
    });
  }

  // ── Per-plan split ──────────────────────────────────────────────────────
  const plans = await Plan.find({})
    .select("key name priceRupees durationDays testsIncluded programType isActive")
    .sort({ sortOrder: 1, priceRupees: 1 })
    .lean();
  const planRevMap = new Map(planAgg.map((p) => [String(p._id), p]));
  const activeSubMap = new Map(
    activeSubsByPlanAgg.map((p) => [String(p._id), p.count])
  );

  const byPlan = plans.map((p) => {
    const rev = planRevMap.get(String(p._id));
    const revenuePaise = rev?.revenue || 0;
    return {
      planId: p._id,
      key: p.key,
      name: p.name,
      priceRupees: p.priceRupees,
      durationDays: p.durationDays ?? null,
      programType: p.programType || null,
      isActive: p.isActive,
      isTrial: p.key === PLAN_KEYS.TRIAL,
      isFree: p.priceRupees === 0,
      revenue: rupees(revenuePaise),
      paidOrders: rev?.orders || 0,
      customers: rev?.customers || 0,
      activeSubscriptions: activeSubMap.get(String(p._id)) || 0,
      revenueShare: pct(revenuePaise, lifetimeRevenuePaise),
    };
  });

  const overview = {
    currency: "INR",
    lifetimeRevenue: rupees(lifetimeRevenuePaise),
    revenueThisMonth: rupees(revenueThisMonthPaise),
    revenueLastMonth: rupees(revenueLastMonthPaise),
    momChangePct:
      revenueLastMonthPaise > 0
        ? round2(
            ((revenueThisMonthPaise - revenueLastMonthPaise) / revenueLastMonthPaise) * 100
          )
        : revenueThisMonthPaise > 0
          ? 100
          : 0,
    ordersThisMonth: thisMonthAgg[0]?.orders || 0,

    paidOrders,
    failedOrders: statusCounts.failed,
    pendingOrders: statusCounts.created,
    totalOrders,
    checkoutConversionPct: pct(statusCounts.paid, totalOrders),

    payingCustomers,
    averageOrderValue: paidOrders > 0 ? rupees(lifetimeRevenuePaise / paidOrders) : 0,
    revenuePerCustomer:
      payingCustomers > 0 ? rupees(lifetimeRevenuePaise / payingCustomers) : 0,
    estimatedMrr: rupees(mrrAgg[0]?.mrrPaise || 0),
    firstPaymentAt: firstOrder ? firstOrder.updatedAt || firstOrder.createdAt : null,

    subscriptions: {
      active: mrrAgg[0]?.activeCount || 0,
      trial: subCounts.trial,
      expired: subCounts.expired,
      cancelled: subCounts.cancelled,
      total: subCounts.trial + subCounts.active + subCounts.expired + subCounts.cancelled,
    },

    students: {
      total: totalStudents,
      active: activeStudents,
      selfServe: selfServeStudents,
      paying: payingStudentsNow,
      onTrial: trialStudentsNow,
      coaching: Math.max(totalStudents - selfServeStudents, 0),
      paidConversionPct: pct(payingStudentsNow, selfServeStudents),
    },
  };

  return sendSuccess(res, 200, "Revenue summary fetched.", { overview, timeseries, byPlan });
});

// ───────────────────────────────────────────────────────────────────────────
// GET /revenue/transactions — the full payment ledger, paginated + filterable
// ───────────────────────────────────────────────────────────────────────────

exports.listTransactions = asyncHandler(async (req, res) => {
  // Allow a larger page size than the platform default so the console's
  // "Export CSV" can pull the whole filtered ledger in one call.
  const { page, limit, skip } = getPaginationParams(req.query, 2000);

  const filter = {};
  if (req.query.status && Object.values(ORDER_STATUS).includes(req.query.status)) {
    filter.status = req.query.status;
  }
  if (req.query.planId && mongoose.Types.ObjectId.isValid(req.query.planId)) {
    filter.plan = new mongoose.Types.ObjectId(req.query.planId);
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) {
      const to = new Date(req.query.dateTo);
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }
  if (req.query.search && req.query.search.trim()) {
    const rx = new RegExp(esc(req.query.search), "i");
    const matchedUsers = await User.find({ $or: [{ name: rx }, { email: rx }] })
      .select("_id")
      .limit(200)
      .lean();
    const ids = matchedUsers.map((u) => u._id);
    filter.$or = [{ razorpayOrderId: rx }, { razorpayPaymentId: rx }];
    if (ids.length) filter.$or.push({ student: { $in: ids } });
  }

  const [orders, total, filteredAgg] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("student", "name email")
      .populate("plan", "name key priceRupees")
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: { ...filter, status: ORDER_STATUS.PAID } },
      { $group: { _id: null, revenue: { $sum: "$amountPaise" }, count: { $sum: 1 } } },
    ]),
  ]);

  const transactions = orders.map((o) => ({
    _id: o._id,
    student: o.student
      ? { _id: o.student._id, name: o.student.name, email: o.student.email }
      : null,
    plan: o.plan
      ? { _id: o.plan._id, name: o.plan.name, key: o.plan.key }
      : null,
    amount: rupees(o.amountPaise),
    currency: o.currency || "INR",
    status: o.status,
    razorpayOrderId: o.razorpayOrderId,
    razorpayPaymentId: o.razorpayPaymentId || null,
    createdAt: o.createdAt,
    paidAt: o.status === ORDER_STATUS.PAID ? o.updatedAt || o.createdAt : null,
  }));

  return sendPaginated(
    res,
    200,
    "Transactions fetched.",
    {
      transactions,
      filteredTotals: {
        paidRevenue: rupees(filteredAgg[0]?.revenue || 0),
        paidCount: filteredAgg[0]?.count || 0,
      },
    },
    buildPaginationMeta(total, page, limit)
  );
});
