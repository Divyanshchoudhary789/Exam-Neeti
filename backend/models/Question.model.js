const mongoose = require("mongoose");
const { DIFFICULTY, QUESTION_TYPE, SUBJECTS, CLASS_LEVELS } = require("../config/constants");

/**
 * Question lives in a SEPARATE database (the question bank DB on the same Atlas cluster).
 * This model is registered on the questionBankConnection, not the default mongoose connection.
 * The factory function at the bottom accepts a connection and returns the model.
 */

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Cloudinary image reference — stored wherever an image can appear:
 * on the question itself, on an option, or on the solution.
 */
const cloudinaryImageSchema = new mongoose.Schema(
  {
    url:      { type: String, default: null },   // https://res.cloudinary.com/...
    publicId: { type: String, default: null },   // examneeti/questions/<filename>
  },
  { _id: false }
);

const optionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    text: {
      type: String,
      trim: true,
      default: "",                // text can be empty if option is image-only
    },
    image: {
      type: cloudinaryImageSchema,
      default: () => ({ url: null, publicId: null }),
    },
  },
  { _id: false }
);

/**
 * Full step-by-step solution stored alongside each question.
 * hasLatex = true tells the frontend to run KaTeX over the text.
 *
 * images[] supports multiple diagrams/steps in one solution.
 * image (singular) is kept for backward compatibility.
 */
const solutionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      default: "",
    },
    hasLatex: {
      type: Boolean,
      default: false,
    },
    // Single image — kept for backward compatibility
    image: {
      type: cloudinaryImageSchema,
      default: () => ({ url: null, publicId: null }),
    },
    // Multiple images — use this when solution has more than one diagram
    images: {
      type: [cloudinaryImageSchema],
      default: [],
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
    sprintId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    slotPosition: { type: Number,                         required: true },
    examId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    usedAt:       { type: Date,                           default: Date.now },
  },
  { _id: false }
);

// ─── Main Question Schema ─────────────────────────────────────────────────────

const questionSchema = new mongoose.Schema(
  {
    // ── Core classification ──────────────────────────────────────────────────
    subject: {
      type: String,
      required: [true, "Subject is required."],
      enum: {
        values: Object.values(SUBJECTS),
        message: "Subject must be biology, chemistry, or physics.",
      },
    },
    /**
     * Class level — XI or XII.
     * Stored as a string so it serialises naturally ("XI", "XII").
     */
    classLevel: {
      type: String,
      required: [true, "Class level is required."],
      enum: {
        values: Object.values(CLASS_LEVELS),
        message: "Class level must be XI or XII.",
      },
    },
    chapter: {
      type: String,
      required: [true, "Chapter is required."],
      trim: true,
    },
    /**
     * topic maps to the "Concept" field in the source document
     * e.g. "Multiplication of vectors"
     */
    topic: {
      type: String,
      required: [true, "Topic is required."],
      trim: true,
    },
    /**
     * questionCategory maps to "Question type" in the source document
     * e.g. "Cross-product of vectors", "Dot-product of vectors"
     */
    questionCategory: {
      type: String,
      trim: true,
      default: "",
    },
    /**
     * questionVariant maps to "Variant" in the source document
     * e.g. "Rectangular component form", "Direction of cross-product"
     */
    questionVariant: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Difficulty & timing ──────────────────────────────────────────────────
    difficulty: {
      type: String,
      required: [true, "Difficulty is required."],
      enum: {
        values: Object.values(DIFFICULTY),
        message: "Difficulty must be easy, medium, or hard.",
      },
    },
    /**
     * idealTimeSeconds — the recommended time to solve this question.
     * Sourced from the "Ideal time" field in the source document (e.g. 40 sec).
     */
    idealTimeSeconds: {
      type: Number,
      default: null,
      min: [0, "Ideal time cannot be negative."],
    },

    // ── Question body ────────────────────────────────────────────────────────
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
    /**
     * hasLatex = true when the question text contains LaTeX/math notation.
     * Frontend uses this flag to activate KaTeX rendering.
     */
    hasLatex: {
      type: Boolean,
      default: false,
    },
    /**
     * Optional image for the question (diagrams, figures, etc.)
     */
    questionImage: {
      type: cloudinaryImageSchema,
      default: () => ({ url: null, publicId: null }),
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

    // ── Marks ────────────────────────────────────────────────────────────────
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

    // ── Solution ─────────────────────────────────────────────────────────────
    solution: {
      type: solutionSchema,
      default: () => ({ text: "", hasLatex: false, image: { url: null, publicId: null } }),
    },

    // ── Deduplication ────────────────────────────────────────────────────────
    /**
     * contentHash — SHA-256 of (subject + classLevel + chapter + topic + normalised question text).
     * Seed script uses this to skip already-imported questions (idempotent seeding).
     */
    contentHash: {
      type: String,
      unique: true,
      index: true,
    },

    // ── Source tracking ──────────────────────────────────────────────────────
    /**
     * sourceRef — human-readable label of the source file/paper this question
     * came from. e.g. "Minor 1 Physics XI 2024". Used for audit + traceability.
     */
    sourceRef: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Pattern slot tagging (Question Reconstruction engine) ────────────────
    /**
     * Tags for which pattern-slots (by sprint + position) this question is eligible.
     * Admin assigns these. The Question Reconstruction engine filters by these.
     */
    patternSlotTags: [
      {
        sprintId:     { type: mongoose.Schema.Types.ObjectId, required: true },
        slotPosition: { type: Number,                         required: true },
        _id: false,
      },
    ],

    // ── Usage history ────────────────────────────────────────────────────────
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

// ─── Indexes ──────────────────────────────────────────────────────────────────

questionSchema.index({ subject: 1, classLevel: 1, chapter: 1, topic: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ classLevel: 1, subject: 1 });
questionSchema.index({ questionCategory: 1, questionVariant: 1 });
questionSchema.index({ sourceRef: 1 });
questionSchema.index({ "patternSlotTags.sprintId": 1, "patternSlotTags.slotPosition": 1 });
questionSchema.index({ "usageLog.sprintId": 1, "usageLog.slotPosition": 1 });

// ─── Model factory ────────────────────────────────────────────────────────────

/**
 * Returns a Mongoose model bound to the provided connection.
 * This allows the question bank to live in a separate DB.
 */
const createQuestionModel = (connection) => {
  return connection.model("Question", questionSchema);
};

module.exports = { createQuestionModel, questionSchema };
