const mongoose = require("mongoose");
const { SUBSCRIPTION_STATUS } = require("../config/constants");

/**
 * Subscription — one record per plan lifecycle event for a self-serve student
 * (trial signup, purchase, renewal). The most recent document (by createdAt)
 * for a student is treated as "current" — history is kept, never overwritten.
 * Coaching-batch students never get one of these; their access is entirely
 * admin-managed (see Batch.source).
 */
const subscriptionSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // null => never expires (trial, Signature Entry one-time access)
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
