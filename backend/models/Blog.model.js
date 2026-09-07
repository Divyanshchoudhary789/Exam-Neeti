const mongoose = require("mongoose");

/**
 * Blog — a public article authored by an admin / super_admin from the dashboard
 * and shown in the landing-page Resources area + /resources. `content` is
 * lightweight markdown (rendered with a small safe renderer on the client);
 * `style` carries per-article typography the author sets from the dashboard.
 */
const blogStyleSchema = new mongoose.Schema(
  {
    fontFamily:   { type: String, default: "sans", enum: ["sans", "serif", "mono", "inter", "poppins", "lora"] },
    fontSizePx:   { type: Number, default: 16, min: 12, max: 24 },
    lineHeight:   { type: Number, default: 1.7, min: 1.2, max: 2.4 },
    textColor:    { type: String, default: "#1f2937" },
    headingColor: { type: String, default: "#111827" },
    accentColor:  { type: String, default: "#4338ca" },
    align:        { type: String, default: "left", enum: ["left", "center", "justify"] },
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true, maxlength: 200 },
    slug:    { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, trim: true, default: "", maxlength: 400 },
    content: { type: String, required: true },                 // markdown
    coverImage: {
      url:      { type: String, default: null },
      publicId: { type: String, default: null },
    },
    category: { type: String, trim: true, default: "General" },
    tags:     { type: [String], default: [] },
    status:   { type: String, enum: ["draft", "published"], default: "draft", index: true },
    style:    { type: blogStyleSchema, default: () => ({}) },
    readMinutes: { type: Number, default: 3 },
    author: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      email:  { type: String, default: "" },
      name:   { type: String, default: "" },
    },
    publishedAt: { type: Date, default: null },
    views:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model("Blog", blogSchema);
