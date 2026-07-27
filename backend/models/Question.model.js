const mongoose = require("mongoose");
const { DIFFICULTY, QUESTION_TYPE, SUBJECTS } = require("../config/constants");

/**
 * Question lives in a SEPARATE database (the question bank DB on the same Atlas cluster).
 * This model is registered on the questionBankConnection, not the default mongoose connection.
 * The factory function at the bottom accepts a connection and returns the model.
 */

const optionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    text: {
      type: String,
      required: [true, "Option text is required."],
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Tracks which pattern-slot (by sprintId + slotPosition) this question
 * has been used in, and when — for Question Reconstruction logic.
 */
const usageLogEntrySchema = new mongoose.Schema(
  {
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    slotPosition: {
      type: Number,
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Subject is required."],
      enum: {
        values: Object.values(SUBJECTS),
        message: "Subject must be biology, chemistry, or physics.",
      },
    },
    chapter: {
      type: String,
      required: [true, "Chapter is required."],
      trim: true,
    },
    topic: {
      type: String,
      required: [true, "Topic is required."],
      trim: true,
    },
    difficulty: {
      type: String,
      required: [true, "Difficulty is required."],
      enum: {
        values: Object.values(DIFFICULTY),
        message: "Difficulty must be easy, medium, or hard.",
      },
    },
    questionType: {
      type: String,
      enum: Object.values(QUESTION_TYPE),
      default: QUESTION_TYPE.MCQ,
    },
    text: {
      type: String,
      required: [true, "Question text is required."],
      trim: true,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: function (opts) {
          return opts && opts.length === 4;
        },
        message: "MCQ must have exactly 4 options.",
      },
    },
    correctAnswer: {
      type: String,
      required: [true, "Correct answer is required."],
      enum: {
        values: ["A", "B", "C", "D"],
        message: "Correct answer must be A, B, C, or D.",
      },
    },
    marks: {
      type: Number,
      required: [true, "Marks are required."],
      min: [0, "Marks cannot be negative."],
    },
    negativeMarks: {
      type: Number,
      default: 0,
      min: [0, "Negative marks value cannot be negative."],
    },
    /**
     * Tags for which pattern-slots (by sprint + position) this question is eligible.
     * Admin assigns these. The Question Reconstruction engine filters by these.
     */
    patternSlotTags: [
      {
        sprintId: { type: mongoose.Schema.Types.ObjectId, required: true },
        slotPosition: { type: Number, required: true },
        _id: false,
      },
    ],
    usageLog: {
      type: [usageLogEntrySchema],
      default: [],
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

questionSchema.index({ subject: 1, chapter: 1, topic: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ "patternSlotTags.sprintId": 1, "patternSlotTags.slotPosition": 1 });
questionSchema.index({ "usageLog.sprintId": 1, "usageLog.slotPosition": 1 });

/**
 * Returns a Mongoose model bound to the provided connection.
 * This allows the question bank to live in a separate DB.
 */
const createQuestionModel = (connection) => {
  return connection.model("Question", questionSchema);
};

module.exports = { createQuestionModel, questionSchema };
