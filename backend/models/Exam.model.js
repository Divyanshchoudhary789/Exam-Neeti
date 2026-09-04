const mongoose = require("mongoose");
const { EXAM_STATUS } = require("../config/constants");

/**
 * Each ExamQuestion records exactly which question filled which slot in this exam.
 * questionId references a document in the Question Bank DB.
 */
const examQuestionSchema = new mongoose.Schema(
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
    questionType: { type: String, required: true },
    hasImage: { type: Boolean, default: false },
    marks: { type: Number, required: true },
    negativeMarks: { type: Number, default: 0 },
    correctAnswer: { type: String, required: true },
    // Recommended solving time for this question (from the Question Bank). Used
    // as the "expected solving time" denominator in ROI, so ROI stays a
    // question property, not a function of how long the student actually took.
    idealTimeSeconds: { type: Number, default: null },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
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
    examNumber: {
      type: Number,
      required: [true, "Exam number within the sprint is required."],
      min: 1,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(EXAM_STATUS),
      default: EXAM_STATUS.DRAFT,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      required: [true, "Exam duration is required."],
      min: [1, "Duration must be at least 1 minute."],
    },
    questions: {
      type: [examQuestionSchema],
      default: [],
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    instructions: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

examSchema.index({ sprint: 1, batch: 1 });
// Unique exam number per sprint+batch combination (not globally per sprint,
// because each batch gets its own independent exam sequence within a sprint)
examSchema.index({ sprint: 1, batch: 1, examNumber: 1 }, { unique: true });
examSchema.index({ status: 1 });
examSchema.index({ batch: 1, status: 1 });

module.exports = mongoose.model("Exam", examSchema);
