const mongoose = require("mongoose");
const { SUBJECTS, CLASS_LEVELS, PROGRAM_TYPES, EXAM_TYPE } = require("../config/constants");

/**
 * TestBlueprint — Stores the complete test-series blueprint.
 *
 * Each document is one test entry in the blueprint:
 *   Program (Class XI / Class XII / Dropper) → Test (Minor 1, Semi Major 1, Major 1…) 
 *     → subject-wise topic coverage
 *
 * This model is used to:
 *   1. Show admins which topics are covered in which test
 *   2. Auto-tag pattern slots when generating Sprint patternSlots
 *   3. Drive Syllabus Coverage analytics — "how much of the blueprint
 *      has a student actually been tested on"
 *   4. Frontend Blueprint Explorer — students can see upcoming test topics
 *
 * Blueprint data is seeded via scripts/seedBlueprint.js and can be
 * updated by admins via API.
 */

// Describes what topics a single subject covers in this test
const subjectCoverageSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      enum: Object.values(SUBJECTS),
    },
    /**
     * Raw description from the blueprint document.
     * e.g. "Units, Dimensions, Vectors"
     * e.g. "Minor1-5 (cumulative)"
     */
    coverageDescription: {
      type: String,
      trim: true,
      default: "",
    },
    /**
     * Resolved chapter names — populated when seeding/updating.
     * These should match SyllabusConfig.chapter values exactly
     * for the coverage formulas to work correctly.
     */
    chapters: {
      type: [String],
      default: [],
    },
    /**
     * isCumulative — true for Semi-Major and Major tests that cover
     * all chapters from previous tests (e.g. "Minor1-5 cumulative")
     */
    isCumulative: {
      type: Boolean,
      default: false,
    },
    /**
     * cumulativeFrom — for cumulative tests, the test numbers covered.
     * e.g. [1, 2, 3, 4, 5]
     */
    cumulativeFrom: {
      type: [Number],
      default: [],
    },
  },
  { _id: false }
);

const testBlueprintEntrySchema = new mongoose.Schema(
  {
    /**
     * programType — which program/batch this test belongs to.
     * class_xi | class_xii | dropper
     */
    programType: {
      type: String,
      required: true,
      enum: Object.values(PROGRAM_TYPES),
      index: true,
    },
    /**
     * testCode — unique code within the program.
     * Class XI: "minor_1", "minor_2", "semi_major_1", "major_1" …
     * Dropper:  "m1", "m2", "semi1", "major_1" …
     */
    testCode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    /**
     * testNumber — sequential number within the program.
     * Used for display ordering.
     */
    testNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    /**
     * displayName — human-readable name for UI.
     * e.g. "Minor 1", "Semi Major 1", "Major 3"
     */
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    examType: {
      type: String,
      required: true,
      enum: Object.values(EXAM_TYPE),
    },
    /**
     * subjectCoverage — per-subject breakdown of what's covered.
     */
    subjectCoverage: {
      type: [subjectCoverageSchema],
      default: [],
    },
    /**
     * suggestedDurationMinutes — recommended exam duration.
     * Minor: 60min, Semi-Major: 90min, Major: 180min (full NEET)
     */
    suggestedDurationMinutes: {
      type: Number,
      default: 60,
      min: 10,
    },
    /**
     * suggestedQuestionCount — total questions recommended for this test type.
     * Minor: 45, Semi-Major: 90, Major: 180
     */
    suggestedQuestionCount: {
      type: Number,
      default: 45,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Each program has unique test codes
testBlueprintEntrySchema.index(
  { programType: 1, testCode: 1 },
  { unique: true }
);
testBlueprintEntrySchema.index({ programType: 1, testNumber: 1 });
testBlueprintEntrySchema.index({ examType: 1 });

module.exports = mongoose.model("TestBlueprint", testBlueprintEntrySchema);
