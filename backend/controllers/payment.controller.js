const crypto = require("crypto");
const { getRazorpayClient } = require("../config/razorpay");
const Plan = require("../models/Plan.model");
const Order = require("../models/Order.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { ORDER_STATUS } = require("../config/constants");
const { activateSubscriptionForOrder } = require("../services/subscription.service");

// ─── Student: Create a Razorpay order for a plan ─────────────────────────────

exports.createOrder = asyncHandler(async (req, res, next) => {
  const { planKey } = req.body;

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return next(new AppError("Razorpay is not configured.", 500));
  }

  const plan = await Plan.findOne({ key: planKey, isActive: true });
  if (!plan) return next(new AppError("This plan is not available.", 404));
  if (plan.priceRupees <= 0) {
    return next(new AppError("This plan does not require payment.", 400));
  }

  const amountPaise = Math.round(plan.priceRupees * 100);

  const razorpayOrder = await getRazorpayClient().orders.create({
    amount:   amountPaise,
    currency: "INR",
    receipt:  `rcpt_${req.user.id}_${Date.now()}`,
    notes:    { studentId: String(req.user.id), planKey: plan.key },
  });

  await Order.create({
    student:         req.user.id,
    plan:            plan._id,
    razorpayOrderId: razorpayOrder.id,
    amountPaise,
    currency:        "INR",
    status:          ORDER_STATUS.CREATED,
  });

  return sendSuccess(res, 201, "Order created.", {
    orderId:  razorpayOrder.id,
    amount:   amountPaise,
    currency: "INR",
    keyId:    process.env.RAZORPAY_KEY_ID,
    planName: plan.name,
  });
});

// ─── Student: Verify a completed payment (client-side fast path) ────────────

exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const order = await Order.findOne({
    razorpayOrderId: razorpay_order_id,
    student:         req.user.id,
  });
  if (!order) return next(new AppError("Order not found.", 404));

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(razorpay_signature || "", "hex");
  const signatureMatches =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!signatureMatches) {
    if (order.status !== ORDER_STATUS.PAID) {
      order.status = ORDER_STATUS.FAILED;
      await order.save();
    }
    return next(new AppError("Payment verification failed.", 400));
  }

  if (order.status !== ORDER_STATUS.PAID) {
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();
  }

  await activateSubscriptionForOrder(order._id);

  return sendSuccess(res, 200, "Payment verified. Your plan is now active.");
});

// ─── Razorpay: Server-to-server webhook (source of truth) ───────────────────
// Mounted with express.raw() in index.js — req.body is a Buffer here, not JSON.

exports.webhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return next(new AppError("Webhook not configured.", 400));
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(String(signature), "hex");
  const signatureMatches =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!signatureMatches) {
    return next(new AppError("Invalid webhook signature.", 400));
  }

  const payload = JSON.parse(req.body.toString("utf8"));

  if (payload.event === "payment.captured") {
    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;

    const order = await Order.findOne({ razorpayOrderId });
    if (order) {
      if (!order.razorpayPaymentId) {
        order.razorpayPaymentId = paymentEntity.id;
        await order.save();
      }
      await activateSubscriptionForOrder(order._id);
    }
  }

  return sendSuccess(res, 200, "Webhook processed.");
});
