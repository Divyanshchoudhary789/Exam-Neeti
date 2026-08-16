const mongoose = require("mongoose");
const { SUBJECTS, CLASS_LEVELS } = require("../config/constants");

/**
 * SyllabusConfig — Stores the official NEET syllabus taxonomy.
 *
 * Each document represents one TOPIC (the finest granularity):
 *   Subject → Chapter (Unit) → Topic (Concept)
 *
 * This powers:
 *   - Syllabus Coverage = Completed Chapters / Total Chapters × 100
 *   - Concept Coverage  = Attempted Topics / Total Topics in Chapter × 100
 *   - Weighted Coverage = Σ(covered topic weights) / Σ(all topic weights) × 100
 *   - Blueprint mapping  (which topics appear in which test)
 *
 * Data is seeded once via scripts/seedSyllabus.js and never changes unless
 * NTA revises the NEET syllabus. Admins can update weights via API.
 */

const syllabusTopicSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      enum: Object.values(SUBJECTS),
      index: true,
    },
    classLevel: {
      type: String,
      required: true,
      // XI, XII, or dropper (dropper covers both XI and XII)
      enum: [...Object.values(CLASS_LEVELS)],
      index: true,
    },
    /**
     * unitCode  — e.g. "U1", "U2", "U3.1"
     * Matches the naming convention from the Nomenclature documents
     * e.g. "U1 – Units, dimensions and measurement"
     */
    unitCode: {
      type: String,
      trim: true,
      default: "",
    },
    /**
     * chapter — the full chapter/unit name
     * e.g. "Units, Dimensions and Measurement"
     */
    chapter: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    /**
     * topic — the concept/sub-topic within the chapter
     * e.g. "Vernier calipers, micrometer, screw gauge"
     */
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * topicOrder — display order within the chapter (1-indexed)
     */
    topicOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
    /**
     * chapterOrder — display order within the subject + classLevel (1-indexed)
     */
    chapterOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
    /**
     * weight — relative importance for weighted coverage calculation.
     * Default 1.0 (equal weight). Admin can update per-topic weights
     * via the syllabus API to reflect NTA marking trends.
     */
    weight: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },
    /**
     * isActive — false means this topic has been removed from the
     * current-year NEET syllabus (NTA occasionally drops topics).
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint — one entry per subject + classLevel + chapter + topic
syllabusTopicSchema.index(
  { subject: 1, classLevel: 1, chapter: 1, topic: 1 },
  { unique: true }
);

syllabusTopicSchema.index({ subject: 1, classLevel: 1, chapter: 1 });
syllabusTopicSchema.index({ isActive: 1 });

module.exports = mongoose.model("SyllabusConfig", syllabusTopicSchema);
