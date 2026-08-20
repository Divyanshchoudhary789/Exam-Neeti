const mongoose = require("mongoose");
const { ATTEMPT_STATUS } = require("../config/constants");

/**
 * One Response = student's answer to one question in this attempt.
 */
const responseSchema = new mongoose.Schema(
  {
    slotPosition: {
      type: Number,
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    subject: { type: String, required: true },
    chapter: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, required: true },
    questionType: { type: String, default: "mcq" },
    hasImage: { type: Boolean, default: false },
    marks: { type: Number, required: true },
    negativeMarks: { type: Number, default: 0 },
    // correctAnswer is intentionally NOT required here — it is omitted at attempt
    // creation time (startAttempt) for security, and populated only after submission
    // scoring. Analytics services read it from Exam.questions instead.
    correctAnswer: { type: String, default: null },

    selectedAnswer: {
      type: String,
      enum: ["A", "B", "C", "D", null],
      default: null,
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
    isAttempted: {
      type: Boolean,
      default: false,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    sequencePosition: {
      type: Number,
      default: null,
    },
    firstAnswerTimeSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    lastAnswerTimeSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    reattemptDelaySeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    marksAwarded: {
      type: Number,
      default: 0,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    wasReattempted: {
      type: Boolean,
      default: false,
    },
    answerChanges: {
      type: Number,
      default: 0,
      min: 0,
    },
    initialAnswer: {
      type: String,
      enum: ["A", "B", "C", "D", null],
      default: null,
    },
    finalAnswer: {
      type: String,
      enum: ["A", "B", "C", "D", null],
      default: null,
    },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required."],
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: [true, "Exam reference is required."],
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: [true, "Sprint reference is required."],
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch reference is required."],
    },
    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUS),
      default: ATTEMPT_STATUS.IN_PROGRESS,
    },
    responses: {
      type: [responseSchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    totalTimeSeconds: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    /**
     * analyticsComputed is set to true once the Analytics Engine finishes
     * processing this attempt — used to avoid double-processing.
     */
    analyticsComputed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Enforce one attempt per student per exam
attemptSchema.index({ student: 1, exam: 1 }, { unique: true });
attemptSchema.index({ student: 1, sprint: 1 });
attemptSchema.index({ exam: 1 });
attemptSchema.index({ batch: 1, sprint: 1 });
attemptSchema.index({ status: 1 });
attemptSchema.index({ analyticsComputed: 1 });

module.exports = mongoose.model("Attempt", attemptSchema);
