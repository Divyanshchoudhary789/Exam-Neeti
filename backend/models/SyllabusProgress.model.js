const mongoose = require("mongoose");
const { SUBJECTS } = require("../config/constants");

/**
 * SyllabusProgress — Tracks per-student syllabus coverage within a Sprint.
 *
 * Updated automatically after each attempt is submitted.
 * Drives the 4 Coverage Formulas:
 *
 *  1. Syllabus Coverage (%)     = covered chapters / total chapters × 100
 *  2. Concept Coverage (%)      = attempted topics / total topics in chapter × 100
 *  3. Weighted Coverage (%)     = Σ(covered topic weights) / Σ(all weights) × 100
 *  4. Revision Coverage (%)     = topics attempted ≥3 times / completed topics × 100
 *
 * One document per (student × sprint).
 */

const topicProgressSchema = new mongoose.Schema(
  {
    subject:  { type: String, required: true, enum: Object.values(SUBJECTS) },
    chapter:  { type: String, required: true, trim: true },
    topic:    { type: String, required: true, trim: true },
    weight:   { type: Number, default: 1.0 },

    // How many times this topic has been tested (question appeared in an attempt)
    timesAttempted: { type: Number, default: 0, min: 0 },
    timesCorrect:   { type: Number, default: 0, min: 0 },

    // A topic is "covered" when it has been attempted at least once
    isCovered: { type: Boolean, default: false },
    // A topic is "revised" when attempted ≥ 3 times (configurable)
    isRevised:  { type: Boolean, default: false },

    // When was this topic first tested in this sprint
    firstAttemptedAt: { type: Date, default: null },
    lastAttemptedAt:  { type: Date, default: null },
  },
  { _id: false }
);

const syllabusProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
    },
    topics: {
      type: [topicProgressSchema],
      default: [],
    },
    /**
     * Cached coverage metrics — recomputed after every attempt submission.
     * Stored here so the dashboard API never needs to do heavy aggregation.
     */
    syllabusCoverage:  { type: Number, default: 0, min: 0, max: 100 },
    conceptCoverage:   { type: Number, default: 0, min: 0, max: 100 },
    weightedCoverage:  { type: Number, default: 0, min: 0, max: 100 },
    revisionCoverage:  { type: Number, default: 0, min: 0, max: 100 },

    lastUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

syllabusProgressSchema.index({ student: 1, sprint: 1 }, { unique: true });
syllabusProgressSchema.index({ sprint: 1 });

module.exports = mongoose.model("SyllabusProgress", syllabusProgressSchema);
