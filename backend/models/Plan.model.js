const mongoose = require("mongoose");
const { PLAN_KEYS } = require("../config/constants");

/**
 * Plan — the self-serve pricing catalog (Signature Entry / Core / Prime / Elite
 * / the free Trial). Seed-managed (see scripts/seedPublicPlansAndBatches.js);
 * buying a plan is just: create a Subscription + point the student's `batch`
 * at `batchSlug`'s Batch. See payment.controller.js / subscription.service.js.
 */
const planSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: Object.values(PLAN_KEYS),
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    priceRupees: {
      type: Number,
      required: true,
      min: 0,
    },
    // null => never expires (Trial, Signature Entry one-time access)
    durationDays: {
      type: Number,
      default: null,
      min: 1,
    },
    // The 'public' Batch this plan grants access to — see Batch.slug
    batchSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    testsIncluded: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
