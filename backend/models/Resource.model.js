const mongoose = require("mongoose");

/**
 * Resource — a downloadable past paper / notes / guide, an external link, or a
 * reference YouTube video. Authored by an admin / super_admin from the
 * dashboard, shown publicly in the Resources area.
 */
const RESOURCE_KINDS = ["past_paper", "notes", "guide", "video", "link"];

const resourceSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, default: "", maxlength: 500 },
    detail:      { type: String, trim: true, default: "", maxlength: 5000 },   // longer body / instructions
    kind:        { type: String, enum: RESOURCE_KINDS, required: true, index: true },

    // Uploaded attachment (past_paper / notes / guide) — Cloudinary "raw" or image.
    file: {
      url:          { type: String, default: null },
      publicId:     { type: String, default: null },
      resourceType: { type: String, default: null },   // "raw" | "image"
      fileName:     { type: String, default: "" },
      sizeBytes:    { type: Number, default: 0 },
    },
    // Reference links
    youtubeUrl:  { type: String, default: null, trim: true },
    externalUrl: { type: String, default: null, trim: true },

    coverImage: {
      url:      { type: String, default: null },
      publicId: { type: String, default: null },
    },

    subject:    { type: String, trim: true, default: null },   // biology|chemistry|physics|null
    classLevel: { type: String, trim: true, default: null },   // XI|XII|dropper|null
    tags:       { type: [String], default: [] },
    status:     { type: String, enum: ["draft", "published"], default: "draft", index: true },

    uploadedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      email:  { type: String, default: "" },
    },
    publishedAt:   { type: Date, default: null },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

resourceSchema.index({ status: 1, kind: 1, publishedAt: -1 });

module.exports = mongoose.model("Resource", resourceSchema);
module.exports.RESOURCE_KINDS = RESOURCE_KINDS;
