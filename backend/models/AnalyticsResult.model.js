const mongoose = require("mongoose");

/**
 * Stores all computed analytics for one Attempt.
 * One AnalyticsResult document per Attempt — linked 1:1.
 * Covers client formula sections A–F plus extended metrics.
 */

const subjectBreakdownSchema = new mongoose.Schema(
  {
    subject: String,
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    unattempted: Number,
    marksObtained: Number,
    negativeMarks: Number,
    accuracy: Number,
    attemptRate: Number,
    totalTimeSeconds: Number,
    avgTimePerQuestion: Number,
  },
  { _id: false }
);

const chapterBreakdownSchema = new mongoose.Schema(
  {
    subject: String,
    chapter: String,
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    unattempted: Number,
    marksObtained: Number,
    negativeMarks: Number,
    accuracy: Number,
    attemptRate: Number,
  },
  { _id: false }
);

const topicBreakdownSchema = new mongoose.Schema(
  {
    subject: String,
    chapter: String,
    topic: String,
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    accuracy: Number,
    isWeak: Boolean,
    isStrong: Boolean,
  },
  { _id: false }
);

// Extended difficulty breakdown that includes subject dimension
const difficultyBreakdownSchema = new mongoose.Schema(
  {
    difficulty: String,
    subject: String,
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    incorrect: Number,
    unattempted: Number,
    accuracy: Number,
    attemptRate: Number,
    avgTimeSeconds: Number,
    percentageOfTotal: Number,
  },
  { _id: false }
);

const questionTimeSchema = new mongoose.Schema(
  {
    slotPosition: Number,
    questionId: mongoose.Schema.Types.ObjectId,
    subject: String,
    difficulty: String,
    timeSpentSeconds: Number,
    isCorrect: Boolean,
    isAttempted: Boolean,
  },
  { _id: false }
);

const recoverableMarksSchema = new mongoose.Schema(
  {
    totalRecoverable: Number,
    incorrectEasyQuestions: Number,
    negativeLoss: Number,
    timeMisallocation: Number,
    lowAccuracyAreas: Number,
    missedHighROI: Number,
    breakdownBySubject: [
      {
        subject: String,
        recoverableMarks: Number,
        _id: false,
      },
    ],
  },
  { _id: false }
);

const subjectTimeDistributionSchema = new mongoose.Schema(
  {
    subject: String,
    totalTimeSeconds: Number,
    avgTimePerQuestion: Number,
    percentageOfTotal: Number,
  },
  { _id: false }
);

const analyticsResultSchema = new mongoose.Schema(
  {
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },

    // --- Section A: Accuracy ---
    overallAccuracy: { type: Number, default: 0 },
    subjectAccuracy: { type: [subjectBreakdownSchema], default: [] },
    chapterAccuracy: { type: [chapterBreakdownSchema], default: [] },
    topicAccuracy: { type: [topicBreakdownSchema], default: [] },
    difficultyAccuracy: { type: [difficultyBreakdownSchema], default: [] },

    // --- Section B: Attempt Analysis ---
    totalQuestions: { type: Number, default: 0 },
    totalAttempted: { type: Number, default: 0 },
    totalUnattempted: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalIncorrect: { type: Number, default: 0 },
    totalGuessAttempts: { type: Number, default: 0 },
    overallAttemptRate: { type: Number, default: 0 },

    // --- Section C: Negative Marking ---
    totalNegativeMarks: { type: Number, default: 0 },
    negativeMarkingPercentageLoss: { type: Number, default: 0 },
    recoverableNegativeMarks: { type: Number, default: 0 },
    negativeMarksBySubject: { type: [subjectBreakdownSchema], default: [] },

    // --- Section D: Time Utilization ---
    totalTimeSeconds: { type: Number, default: 0 },
    avgTimePerQuestion: { type: Number, default: 0 },
    avgTimeOnCorrect: { type: Number, default: 0 },
    avgTimeOnIncorrect: { type: Number, default: 0 },
    timeVariance: { type: Number, default: 0 },
    timeStdDeviation: { type: Number, default: 0 },
    subjectTimeDistribution: { type: [subjectTimeDistributionSchema], default: [] },
    questionTimings: { type: [questionTimeSchema], default: [] },
    fastestQuestions: { type: [questionTimeSchema], default: [] },
    slowestQuestions: { type: [questionTimeSchema], default: [] },

    // --- Section E: Recoverable Marks ---
    recoverableMarks: { type: recoverableMarksSchema, default: () => ({}) },

    // --- Computed score summary (denormalized for fast reads) ---
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },

    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

analyticsResultSchema.index({ student: 1, sprint: 1 });
analyticsResultSchema.index({ exam: 1 });
analyticsResultSchema.index({ batch: 1, sprint: 1 });

module.exports = mongoose.model("AnalyticsResult", analyticsResultSchema);
