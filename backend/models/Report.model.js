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
    /** Multi-sprint scoping. When non-empty this wins over `sprint`; empty
     *  means "every sprint". */
    sprints: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Sprint",
      default: [],
    },
    /**
     * For future cloud storage: store a key/URL here.
     */
    fileStorageKey: {
      type: String,
      default: null,
    },
    /**
     * The generated report bytes. Reports are small (< ~1 MB) and Render's
     * filesystem is ephemeral, so the buffer lives on the document itself and
     * the download endpoint just streams it. `select: false` keeps it out of
     * list queries. Regenerated on demand if ever missing.
     */
    fileBuffer: {
      type: Buffer,
      select: false,
      default: null,
    },
    /** Human-friendly download filename, e.g. Exam-Neeti_Overall-Performance_2026-09-07.pdf */
    fileName: {
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
