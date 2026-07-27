const mongoose = require("mongoose");

/**
 * Stores the configurable formula rules for each analytics metric (Module 3, A–F).
 * Each document represents one named metric and its computation parameters.
 * This allows the client to supply formula logic without a code deploy.
 *
 * The `params` field is a flexible key-value store for thresholds and weights
 * that the analytics engine reads at runtime.
 *
 * Example metric keys:
 *   "guess_attempt_time_threshold_seconds" — max time (s) to classify a response as a guess
 *   "weak_topic_accuracy_threshold"        — accuracy below this % marks a topic as weak
 *   "strong_topic_accuracy_threshold"      — accuracy at or above this % marks a topic as strong
 *   "recoverable_incorrect_easy_weight"    — multiplier for recoverable marks on incorrect easy Qs
 */
const formulaConfigSchema = new mongoose.Schema(
  {
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: [true, "Sprint reference is required."],
    },
    metricKey: {
      type: String,
      required: [true, "Metric key is required."],
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    params: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

formulaConfigSchema.index({ sprint: 1, metricKey: 1 }, { unique: true });

module.exports = mongoose.model("FormulaConfig", formulaConfigSchema);
