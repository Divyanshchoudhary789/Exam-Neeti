/**
 * planAccess.service.js
 *
 * The single source of truth for "how many tests can this self-serve student
 * still take". Used by:
 *   - GET /subscriptions/me/access          (banner + Tests section header)
 *   - GET /exams/my-exams                   (per-exam `locked` flag)
 *   - POST /exams/:id/start                 (hard gate on a brand-new attempt)
 *
 * Rules
 * ─────
 *   • "current plan" = the plan on the student's active (non-expired)
 *     subscription; otherwise the free Trial plan.
 *   • A plan is CAPPED when it's a one-time plan (`durationDays == null`) with a
 *     positive `testsIncluded` — i.e. Trial (1) and Signature Entry (1). Those
 *     students may start at most `testsIncluded` DISTINCT exams, ever.
 *   • Duration-based plans (Core / Prime / Elite) are NOT capped here — access
 *     is the batch's full schedule until the subscription expires.
 *   • Coaching-batch students (Batch.source !== "public") are never limited by
 *     this service — their access is entirely admin-managed.
 */

"use strict";

const Subscription = require("../models/Subscription.model");
const Plan = require("../models/Plan.model");
const Attempt = require("../models/Attempt.model");
const User = require("../models/User.model");
const { SUBSCRIPTION_STATUS, BATCH_SOURCE, PLAN_KEYS } = require("../config/constants");

async function resolveStudentAccess(userId) {
  const [user, latestSub, trialPlan, distinctExams] = await Promise.all([
    User.findById(userId).select("batch").populate("batch", "source slug").lean(),
    Subscription.findOne({ student: userId }).sort({ createdAt: -1 }).populate("plan").lean(),
    Plan.findOne({ key: PLAN_KEYS.TRIAL }).lean(),
    Attempt.distinct("exam", { student: userId }),
  ]);

  const isPublic = user?.batch?.source === BATCH_SOURCE.PUBLIC;

  // Coaching students: unlimited as far as this service is concerned.
  if (!isPublic) {
    return {
      selfServe: false,
      tier: "coaching",
      status: null,
      plan: null,
      testsIncluded: null,
      capped: false,
      distinctExamsAttempted: distinctExams.length,
      remaining: null,
      atLimit: false,
      expiresAt: null,
    };
  }

  const now = Date.now();
  const subActive =
    latestSub &&
    latestSub.status === SUBSCRIPTION_STATUS.ACTIVE &&
    (!latestSub.expiresAt || new Date(latestSub.expiresAt).getTime() > now);

  const currentPlan = (subActive && latestSub.plan) || trialPlan || null;
  const status = subActive
    ? SUBSCRIPTION_STATUS.ACTIVE
    : latestSub?.status === SUBSCRIPTION_STATUS.EXPIRED
      ? SUBSCRIPTION_STATUS.EXPIRED
      : SUBSCRIPTION_STATUS.TRIAL;

  const testsIncluded = currentPlan?.testsIncluded ?? 0;
  const capped = Boolean(currentPlan && currentPlan.durationDays == null && testsIncluded > 0);

  const distinctExamsAttempted = distinctExams.length;
  const remaining = capped ? Math.max(0, testsIncluded - distinctExamsAttempted) : null;
  const atLimit = capped && remaining <= 0;

  return {
    selfServe: true,
    tier: capped ? "one_time" : subActive ? "subscription" : "trial",
    status,
    plan: currentPlan
      ? {
          key: currentPlan.key,
          name: currentPlan.name,
          testsIncluded,
          durationDays: currentPlan.durationDays ?? null,
          priceRupees: currentPlan.priceRupees ?? 0,
        }
      : null,
    testsIncluded,
    capped,
    distinctExamsAttempted,
    remaining,
    atLimit,
    expiresAt: subActive ? latestSub.expiresAt || null : null,
  };
}

/** Set of exam-id strings the student already has an Attempt for (any status). */
async function attemptedExamIdSet(userId) {
  const ids = await Attempt.distinct("exam", { student: userId });
  return new Set(ids.map(String));
}

module.exports = { resolveStudentAccess, attemptedExamIdSet };
