const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../config/constants");

/**
 * Order — audit trail + idempotency guard for a Razorpay payment. Created
 * with status 'created' when the checkout is initiated; flipped to 'paid'
 * exactly once by subscription.service.js's activateSubscriptionForOrder(),
 * whichever of /payments/verify or /payments/webhook gets there first.
 */
const orderSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
      select: false,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED,
    },
  },
  { timestamps: true }
);

orderSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
