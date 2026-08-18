const mongoose = require("mongoose");

/**
 * Stores per-student probability estimates per chapter.
 * 
 * Two phases:
 * 1. Questionnaire Phase — initial probability from self-assessment
 * 2. Objective Phase    — overrides questionnaire once actual test data exists
 * 
 * Easy → Medium → Hard probabilities are derived from each other per client formula.
 */

const QUESTIONNAIRE_PROBABILITY = Object.freeze({
  never_studied: 0.10,
  started: 0.30,
  can_solve_basic: 0.55,
  comfortable: 0.80,
  can_explain: 0.95,
});

const chapterProbabilitySchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    chapter: { type: String, required: true },

    // Source of probability
    source: {
      type: String,
      enum: ["questionnaire", "objective"],
      default: "questionnaire",
    },

    // Questionnaire self-assessment level
    questionnaireLevel: {
      type: String,
      enum: Object.keys(QUESTIONNAIRE_PROBABILITY),
      default: null,
    },

    // P(correct) for each difficulty
    pEasy: { type: Number, min: 0, max: 1, default: 0.55 },
    pMedium: { type: Number, min: 0, max: 1, default: 0.40 },
    pHard: { type: Number, min: 0, max: 1, default: 0.20 },

    // Objective data tracking
    totalAttempted: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },

    // History of objective assessments (test results)
    assessmentHistory: [
      {
        attemptId: mongoose.Schema.Types.ObjectId,
        correct: Number,
        total: Number,
        date: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const studentProbabilitySchema = new mongoose.Schema(
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
    chapters: {
      type: [chapterProbabilitySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const TOTAL_SYLLABUS_CHAPTERS = 86;

studentProbabilitySchema.virtual("readinessIndex").get(function () {
  if (!this.chapters || this.chapters.length === 0) return 0;
  const sum = this.chapters.reduce((acc, c) => acc + (c.pEasy || 0), 0);
  return Math.round((sum / TOTAL_SYLLABUS_CHAPTERS) * 100);
});

studentProbabilitySchema.virtual("assessedCount").get(function () {
  return this.chapters ? this.chapters.length : 0;
});

studentProbabilitySchema.virtual("assessedAverage").get(function () {
  if (!this.chapters || this.chapters.length === 0) return 0;
  const sum = this.chapters.reduce((acc, c) => acc + (c.pEasy || 0), 0);
  return Math.round((sum / this.chapters.length) * 100);
});

studentProbabilitySchema.index({ student: 1, sprint: 1 }, { unique: true });

studentProbabilitySchema.statics.QUESTIONNAIRE_PROBABILITY = QUESTIONNAIRE_PROBABILITY;

module.exports = mongoose.model("StudentProbability", studentProbabilitySchema);
