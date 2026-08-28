const mongoose = require("mongoose");

/**
 * BulkUploadJob — tracks one async bulk-upload run so the frontend can poll
 * progress instead of holding a synchronous HTTP request open (real
 * documents run 100+ Gemini equation-conversion calls, which can easily
 * exceed a normal reverse-proxy timeout).
 *
 * Lives on the SAME connection as Question (question-bank DB) — see the
 * factory pattern in Question.model.js. No cross-DB reference needed:
 * `uploaderId`/`uploaderEmail` are denormalized, same reasoning as
 * Question.createdBy.
 */
const bulkUploadJobSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    uploaderId:    { type: mongoose.Schema.Types.ObjectId, required: true },
    uploaderEmail: { type: String, default: "" },
    fileName:      { type: String, default: "" },
    format:        { type: String, enum: ["docx", "xlsx"], required: true },

    status: {
      type: String,
      enum: ["processing", "done", "failed"],
      default: "processing",
      index: true,
    },

    progress: {
      processed: { type: Number, default: 0 },
      total:     { type: Number, default: 0 },
      stage: {
        type: String,
        enum: ["parsing", "converting_equations", "uploading_images", "saving", "done"],
        default: "parsing",
      },
    },

    // Same shape as the old synchronous bulk-upload response, filled in once done.
    result: {
      totalRows:         { type: Number, default: 0 },
      createdCount:      { type: Number, default: 0 },
      created:           { type: [mongoose.Schema.Types.ObjectId], default: [] },
      skippedDuplicates: { type: [mongoose.Schema.Types.Mixed], default: [] },
      failed:            { type: [mongoose.Schema.Types.Mixed], default: [] },
      flaggedForReview:  { type: Number, default: 0 },
    },

    errorMessage: { type: String, default: "" }, // set only if status === "failed"
  },
  { timestamps: true }
);

// Jobs are short-lived polling state, not permanent records — auto-clean
// after 24h so this collection never grows unbounded.
bulkUploadJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const createBulkUploadJobModel = (connection) => {
  return connection.model("BulkUploadJob", bulkUploadJobSchema);
};

module.exports = { createBulkUploadJobModel, bulkUploadJobSchema };
