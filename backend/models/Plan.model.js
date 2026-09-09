const mongoose = require("mongoose");
const { PROGRAM_TYPES } = require("../config/constants");

/**
 * Plan — the self-serve pricing catalog (the free Trial + one-time / yearly
 * paid tiers). Created and edited from the admin / super-admin "Plans & Tiers"
 * panel; `scripts/seedPublicPlansAndBatches.js` restores the default set.
 *
 * Buying a plan = create a Subscription + point the student's `batch` at the
 * Batch whose `slug` matches `batchSlug` (a `source: "public"` batch, created
 * alongside the plan). See payment.controller.js / subscription.service.js.
 *
 * One plan ⇄ one public Batch. The `trial` key is structural (referenced by
 * auth.controller / planAccess.service) and cannot be deleted or renamed.
 */
const planSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      immutable: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]{2,40}$/, "Plan key must be 2-40 chars of a-z, 0-9 or '-'."],
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
    // Original (pre-discount) price. Drives the struck-through price + "% OFF"
    // pill on the public pricing card. null => no discount shown.
    mrpRupees: {
      type: Number,
      default: null,
      min: 0,
    },
    // null => never expires (Trial, one-time access tiers)
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

    // ── Marketing / presentation (drives the public pricing page) ────────────
    // Links the plan to a class level — also mirrored onto the linked batch.
    programType: {
      type: String,
      enum: [...Object.values(PROGRAM_TYPES), null],
      default: null,
    },
    // Short one-liner under the plan name on the pricing card.
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    // Per-plan feature bullets; empty => the pricing page uses its default list.
    features: {
      type: [String],
      default: [],
    },
    // The "Minor / Semi Major / Major Tests" footer on the pricing card.
    examBreakdown: {
      minor:     { type: Number, default: 0, min: 0 },
      semiMajor: { type: Number, default: 0, min: 0 },
      major:     { type: Number, default: 0, min: 0 },
    },
    // The highlighted card on the pricing page (should be true for one plan).
    featured: {
      type: Boolean,
      default: false,
    },
    // Ascending display order on the pricing page + in-app upgrade modal.
    sortOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
