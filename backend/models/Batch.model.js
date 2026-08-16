const mongoose = require("mongoose");
const { PROGRAM_TYPES } = require("../config/constants");

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
