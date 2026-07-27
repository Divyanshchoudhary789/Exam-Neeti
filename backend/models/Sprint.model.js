const mongoose = require("mongoose");
const { SPRINT_STATUS, DIFFICULTY, QUESTION_TYPE, SUBJECTS } = require("../config/constants");

/**
 * A PatternSlot defines one fixed position in every exam of this Sprint.
 * The actual question filling that slot changes per exam via Question Reconstruction,
 * but the rules for that slot (subject, difficulty, type, marks) are fixed here.
 */
const patternSlotSchema = new mongoose.Schema(
  {
    position: {
      type: Number,
      required: [true, "Slot position is required."],
      min: [1, "Position must be at least 1."],
    },
    subject: {
      type: String,
      required: [true, "Subject is required for a pattern slot."],
      enum: {
        values: Object.values(SUBJECTS),
        message: "Subject must be biology, chemistry, or physics.",
      },
    },
    chapter: {
      type: String,
      trim: true,
      default: null,
    },
    topic: {
      type: String,
      trim: true,
      default: null,
    },
    difficulty: {
      type: String,
      enum: {
        values: [...Object.values(DIFFICULTY), null],
        message: "Difficulty must be easy, medium, or hard.",
      },
      default: null,
    },
    questionType: {
      type: String,
      enum: Object.values(QUESTION_TYPE),
      default: QUESTION_TYPE.MCQ,
    },
    marks: {
      type: Number,
      required: [true, "Marks for this slot are required."],
      min: [0, "Marks cannot be negative."],
    },
    negativeMarks: {
      type: Number,
      default: 0,
      min: [0, "Negative marks value cannot be negative."],
    },
  },
  { _id: true }
);

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sprint name is required."],
      trim: true,
      unique: true,
      maxlength: [150, "Sprint name cannot exceed 150 characters."],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(SPRINT_STATUS),
      default: SPRINT_STATUS.ACTIVE,
    },
    totalQuestions: {
      type: Number,
      required: [true, "Total questions count is required."],
      min: [1, "Sprint must have at least 1 question."],
    },
    patternSlots: {
      type: [patternSlotSchema],
      validate: {
        validator: function (slots) {
          if (!slots || slots.length === 0) return false;
          // Ensure no duplicate positions
          const positions = slots.map((s) => s.position);
          return new Set(positions).size === positions.length;
        },
        message: "Pattern slots must be non-empty and have unique positions.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sprintSchema.index({ status: 1 });

module.exports = mongoose.model("Sprint", sprintSchema);
