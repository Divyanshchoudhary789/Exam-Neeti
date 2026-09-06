const mongoose = require("mongoose");
const { PROGRAM_TYPES, BATCH_SOURCE } = require("../config/constants");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Batch name is required."],
      trim: true,
      unique: true,
      maxlength: [100, "Batch name cannot exceed 100 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters."],
      default: "",
    },
    /**
     * programType — links this batch to a test-series program.
     * Drives blueprint filtering and syllabus coverage scoping.
     * class_xi | class_xii | dropper
     */
    programType: {
      type: String,
      enum: [...Object.values(PROGRAM_TYPES), null],
      default: null,
    },
    /**
     * source — 'coaching' batches are created & managed by an admin for a
     * coaching partner (billed offline, always active). 'public' batches back
     * the self-serve Plan catalog — students land here via registration/
     * payment and are subject to Subscription expiry checks (see
     * auth.controller.js getMe/login). Defaults to 'coaching' so every
     * existing batch is unaffected.
     */
    source: {
      type: String,
      enum: Object.values(BATCH_SOURCE),
      default: BATCH_SOURCE.COACHING,
    },
    /**
     * slug — stable machine-readable identifier for 'public' batches
     * (e.g. "public-trial", "public-core") so backend code can look them up
     * deterministically instead of hardcoding ObjectIds. Unused/absent on
     * ordinary coaching batches.
     */
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: count of students in this batch
batchSchema.virtual("studentCount", {
  ref: "User",
  localField: "_id",
  foreignField: "batch",
  count: true,
});

batchSchema.index({ isActive: 1 });

module.exports = mongoose.model("Batch", batchSchema);
