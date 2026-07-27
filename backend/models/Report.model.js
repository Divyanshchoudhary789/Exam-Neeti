const mongoose = require("mongoose");
const { REPORT_TYPE, REPORT_FORMAT, REPORT_SCOPE } = require("../config/constants");

const reportSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required."],
    },
    type: {
      type: String,
      enum: Object.values(REPORT_TYPE),
      required: [true, "Report type is required."],
    },
    format: {
      type: String,
      enum: Object.values(REPORT_FORMAT),
      required: [true, "Report format is required."],
    },
    scope: {
      type: String,
      enum: Object.values(REPORT_SCOPE),
      required: [true, "Report scope is required."],
    },
    /**
     * Flexible reference: could be an Attempt, Exam, Batch, or Sprint ObjectId
     * depending on the scope.
     */
    scopeRefId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
    },
    /**
     * For future cloud storage: store a key/URL here.
     * Currently reports are generated on-demand as buffers (no disk storage).
     */
    fileStorageKey: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ owner: 1, createdAt: -1 });
reportSchema.index({ sprint: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model("Report", reportSchema);
