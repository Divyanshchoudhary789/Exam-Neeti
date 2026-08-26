const mongoose = require("mongoose");

/**
 * QuestionFieldDefinition — admin-defined extra fields for the Question Bank
 * (e.g. "Sub Topic", "Reference Book"). Lives on the DEFAULT mongoose
 * connection (same as SyllabusConfig) — it's just config metadata, so it
 * doesn't need to depend on QUESTION_BANK_MONGO_URI being set.
 *
 * The actual per-question VALUES are stored in Question.customFields (a Map),
 * on the question bank connection. This collection only holds the field
 * DEFINITIONS (label, type, options, required, active).
 *
 * `key` and `type` are immutable after creation (enforced by the validator
 * only accepting them on create, never on update) — changing either after
 * questions have stored values under this key would silently corrupt data.
 */
const questionFieldDefinitionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Key is required."],
      unique: true,
      trim: true,
      match: [
        /^[a-z][a-zA-Z0-9]{0,39}$/,
        "Key must start with a lowercase letter and contain only letters/numbers (max 40 chars).",
      ],
    },
    label: {
      type: String,
      required: [true, "Label is required."],
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["text", "textarea", "number", "select", "boolean"],
        message: "Type must be text, textarea, number, select, or boolean.",
      },
    },
    /**
     * Dropdown options — only meaningful when type === "select".
     */
    options: {
      type: [String],
      default: [],
    },
    required: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /**
     * Display order in the Add/Edit Question forms (ascending).
     */
    order: {
      type: Number,
      default: 0,
    },
    helpText: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    /**
     * Only used when type === "number".
     */
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, default: null },
      email: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

questionFieldDefinitionSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model("QuestionFieldDefinition", questionFieldDefinitionSchema);
