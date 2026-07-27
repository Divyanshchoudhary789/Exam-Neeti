const mongoose = require("mongoose");

/**
 * Advanced Analytics Model — Contains ALL client-supplied formulas
 * Linked 1:1 with AnalyticsResult for extended metrics
 */

// Error Classification Metrics
const errorClassificationSchema = new mongoose.Schema(
  {
    sillyMistakes: Number,
    sillyMistakeRate: Number,
    conceptErrors: Number,
    conceptErrorRate: Number,
    guesses: Number,
    guessRate: Number,
    sillyMistakeQuestions: [{ questionId: mongoose.Schema.Types.ObjectId, slotPosition: Number, _id: false }],
    conceptErrorQuestions: [{ questionId: mongoose.Schema.Types.ObjectId, slotPosition: Number, _id: false }],
    guessQuestions: [{ questionId: mongoose.Schema.Types.ObjectId, slotPosition: Number, _id: false }],
  },
  { _id: false }
);

// ROI Metrics
const roiMetricsSchema = new mongoose.Schema(
  {
    highROICoverage: Number,
    lowROIAttempts: Number,
    scoreOpportunityIndex: Number,
    soiBreakdown: {
      sillyMistakesLoss: Number,
      highROISkippedLoss: Number,
      lowROIAttemptedLoss: Number,
      guessingLoss: Number,
      _id: false,
    },
  },
  { _id: false }
);

// Fatigue & Performance Curve
const performanceWindowSchema = new mongoose.Schema(
  {
    windowIndex: Number,
    windowSize: Number,
    startPosition: Number,
    endPosition: Number,
    accuracy: Number,
    correct: Number,
    total: Number,
    _id: false,
  },
  { _id: false }
);

const fatigueCurveSchema = new mongoose.Schema(
  {
    rollingWindows: [performanceWindowSchema],
    firstDrop: { windowIndex: Number, dropAmount: Number, _id: false },
    maxDrop: Number,
    highestSpike: Number,
    lowestSpike: Number,
    criticalWindowsCount: Number,
    recoveryWindow: Number,
    _id: false,
  },
  { _id: false }
);

// Streak Metrics
const streakMetricsSchema = new mongoose.Schema(
  {
    goodStreakLength: Number,
    badStreakLength: Number,
    goodStreaks: [{ start: Number, end: Number, length: Number, _id: false }],
    badStreaks: [{ start: Number, end: Number, length: Number, _id: false }],
  },
  { _id: false }
);

// Reattempt Metrics
const reattemptMetricsSchema = new mongoose.Schema(
  {
    reattemptRate: Number,
    answerSwitchCount: Number,
    productiveReattemptRate: Number,
    harmfulReattemptRate: Number,
    reattemptAccuracy: Number,
    totalReattempts: Number,
    wrongToCorrect: Number,
    correctToWrong: Number,
    wrongToWrong: Number,
  },
  { _id: false }
);

// Time Distribution by Subject & Difficulty
const timeDistributionSchema = new mongoose.Schema(
  {
    subject: String,
    difficulty: String,
    totalTimeSeconds: Number,
    avgTimePerQuestion: Number,
    percentageOfTotal: Number,
    attemptedQuestions: Number,
    _id: false,
  },
  { _id: false }
);

// Variance & Statistical Metrics
const timeVarianceSchema = new mongoose.Schema(
  {
    variance: Number,
    standardDeviation: Number,
    avgTimeOnCorrect: Number,
    avgTimeOnIncorrect: Number,
    _id: false,
  },
  { _id: false }
);

// Attempt Order Quality — Spearman Rank Correlation
const questionOrderDetailSchema = new mongoose.Schema(
  {
    slotPosition: Number,
    questionId: mongoose.Schema.Types.ObjectId,
    subject: String,
    difficulty: String,
    priorityScore: Number,
    idealRank: Number,
    actualRank: Number,
    rankDifference: Number,
    roi: Number,
    marks: Number,
    isAttempted: Boolean,
    _id: false,
  },
  { _id: false }
);

const highROIAttemptedLateSchema = new mongoose.Schema(
  {
    slotPosition: Number,
    questionId: mongoose.Schema.Types.ObjectId,
    subject: String,
    difficulty: String,
    priorityScore: Number,
    idealRank: Number,
    actualRank: Number,
    rankDifference: Number,
    estimatedExtraMarks: Number,
    _id: false,
  },
  { _id: false }
);

const lowROIAttemptedEarlySchema = new mongoose.Schema(
  {
    slotPosition: Number,
    questionId: mongoose.Schema.Types.ObjectId,
    subject: String,
    difficulty: String,
    priorityScore: Number,
    idealRank: Number,
    actualRank: Number,
    rankDifference: Number,
    _id: false,
  },
  { _id: false }
);

const attemptOrderQualitySchema = new mongoose.Schema(
  {
    spearmanRho: Number,
    totalAttempted: Number,
    totalSequenced: Number,
    sequenceCoverage: Number,
    interpretation: {
      type: String,
      enum: ["excellent", "good", "average", "needs_improvement", "poor", "insufficient_data"],
    },
    estimatedExtraMarksFromBetterOrder: Number,
    highROIAttemptedLate: [highROIAttemptedLateSchema],
    lowROIAttemptedEarly: [lowROIAttemptedEarlySchema],
    questionOrderDetails: [questionOrderDetailSchema],
    priorityWeights: {
      roi: Number,
      easyBonus: Number,
      marks: Number,
      _id: false,
    },
    _id: false,
  },
  { _id: false }
);

const advancedAnalyticsSchema = new mongoose.Schema(
  {
    analyticsResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalyticsResult",
      required: true,
      unique: true,
    },
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
    },
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

    // Error Classification (Silly Mistakes, Concept Errors, Guesses)
    errorClassification: {
      type: errorClassificationSchema,
      default: () => ({}),
    },

    // ROI & Score Opportunity
    roiMetrics: {
      type: roiMetricsSchema,
      default: () => ({}),
    },

    // Fatigue Curve & Performance Windows
    fatigueCurve: {
      type: fatigueCurveSchema,
      default: () => ({}),
    },

    // Streak Analysis
    streakMetrics: {
      type: streakMetricsSchema,
      default: () => ({}),
    },

    // Reattempt Analysis
    reattemptMetrics: {
      type: reattemptMetricsSchema,
      default: () => ({}),
    },

    // Time Distribution (Subject × Difficulty matrix)
    timeDistribution: {
      type: [timeDistributionSchema],
      default: [],
    },

    // Time Variance & Statistical Metrics
    timeVariance: {
      type: timeVarianceSchema,
      default: () => ({}),
    },

    // Attempt Order Quality — Spearman Rank Correlation
    attemptOrderQuality: {
      type: attemptOrderQualitySchema,
      default: () => ({}),
    },

    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

advancedAnalyticsSchema.index({ student: 1, sprint: 1 });
advancedAnalyticsSchema.index({ attempt: 1 });

module.exports = mongoose.model("AdvancedAnalytics", advancedAnalyticsSchema);
