const Order = require("../models/Order.model");
const Plan = require("../models/Plan.model");
const Subscription = require("../models/Subscription.model");
const Batch = require("../models/Batch.model");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const { sendEmail, templates } = require("./email.service");
const { clientPath } = require("../utils/clientUrl");
const { ORDER_STATUS, SUBSCRIPTION_STATUS, NOTIFICATION_TRIGGER, BATCH_SOURCE } = require("../config/constants");

const fmtDateIST = (d) =>
  d
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d))
    : null;

/**
 * Turns a paid Razorpay order into live access: activates a Subscription and
 * reassigns the student's batch to the plan's public batch (the same batch-
 * membership check every exam endpoint already uses — see exam.controller.js).
 *
 * Called from both /payments/verify (fast client path) and /payments/webhook
 * (server-of-record path) — either or both may fire for the same order, so
 * the claim below is a single atomic conditional update that only the first
 * caller can win; the loser is a safe no-op.
 */
async function activateSubscriptionForOrder(orderId) {
  const existingOrder = await Order.findById(orderId);
  if (!existingOrder || existingOrder.status === ORDER_STATUS.PAID) return;

  const plan = await Plan.findById(existingOrder.plan);
  if (!plan) throw new AppError("Plan not found for this order.", 404);

  const targetBatch = await Batch.findOne({ slug: plan.batchSlug, source: BATCH_SOURCE.PUBLIC });
  if (!targetBatch) {
    throw new AppError(`Public batch "${plan.batchSlug}" has not been set up yet.`, 500);
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $ne: ORDER_STATUS.PAID } },
    { status: ORDER_STATUS.PAID },
    { new: true }
  );
  if (!order) return; // already activated by a concurrent caller

  const now = new Date();
  const expiresAt = plan.durationDays
    ? new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
    : null;

  await Subscription.create({
    student: order.student,
    plan: plan._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startedAt: now,
    expiresAt,
  });

  const student = await User.findByIdAndUpdate(
    order.student,
    { batch: targetBatch._id },
    { new: true }
  );

  if (student) {
    sendEmail({
      to: student.email,
      subject: `Your ${plan.name} plan is active — Exam Neeti`,
      html: templates.subscriptionActivated({
        name: student.name,
        planName: plan.name,
        expiresAt: fmtDateIST(expiresAt),
        amount: Number.isFinite(order.amountPaise) ? Math.round(order.amountPaise / 100).toLocaleString("en-IN") : null,
        dashboardUrl: clientPath("/student"),
      }),
      trigger: NOTIFICATION_TRIGGER.SUBSCRIPTION_ACTIVATED,
      recipientId: student._id,
      contextRef: order._id,
    }).catch((err) => console.error("[Subscription] Activation email failed:", err.message));
  }
}

module.exports = { activateSubscriptionForOrder };
