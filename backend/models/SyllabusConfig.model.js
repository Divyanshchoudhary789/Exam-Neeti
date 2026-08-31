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
 *   - Weightage Framework (chapterWeightage/topicWeightage/subtopics[].weightage,
 *     1=High/2=Medium/3=Low) — taxonomy-level priority scoring, NOT tagged on
 *     individual questions, meant to inform test-generation strategy
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
     *
     * Distinct from the Weightage Framework fields below — this `weight` is
     * an older, continuous coverage-analytics input (Weighted Coverage %);
     * chapterWeightage/topicWeightage/subtopics[].weightage are the newer
     * 1-3 priority framework, kept as separate fields rather than replacing
     * `weight` so nothing already reading it breaks.
     */
    weight: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },

    // ── Weightage Framework — 1 (High) / 2 (Medium) / 3 (Low) priority ─────
    // Taxonomy-level, NOT tagged on individual questions — intended to feed
    // test/exam generation strategy (e.g. favouring high-priority chapters
    // when building a blueprint) once that's wired up; purely descriptive
    // data until then. `null` = not yet set by an admin.
    /**
     * chapterWeightage — same value across every topic document that
     * shares this (subject, classLevel, chapter) — kept per-document
     * (not a separate "chapter" collection) to match this model's existing
     * flat one-document-per-topic shape. Set it via
     * PATCH /syllabus/chapters/weightage, which updates every topic under
     * the chapter atomically — never edit it document-by-document, or
     * topics in the same chapter can end up disagreeing.
     */
    chapterWeightage: {
      type: Number,
      enum: [1, 2, 3],
      default: null,
    },
    /** topicWeightage — this ONE topic's priority within its chapter. */
    topicWeightage: {
      type: Number,
      enum: [1, 2, 3],
      default: null,
    },
    /**
     * subtopics — admin-managed finer breakdown within this topic, each
     * with its own 1-3 weightage. Free-form (no NEET-wide predefined list —
     * subtopic naming/granularity is an admin judgment call, unlike
     * chapter/topic which come from the official Nomenclature documents).
     */
    subtopics: {
      type: [
        {
          name:      { type: String, required: true, trim: true },
          weightage: { type: Number, enum: [1, 2, 3], default: null },
        },
      ],
      default: [],
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
