"use strict";

const Blog = require("../models/Blog.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/upload");

const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "post";

async function uniqueSlug(base, ignoreId = null) {
  let slug = slugify(base);
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await Blog.findOne({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }).select("_id").lean();
    if (!clash) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

const estimateReadMinutes = (markdown) =>
  Math.max(1, Math.round(String(markdown || "").split(/\s+/).filter(Boolean).length / 200));

// ─── Public: list published blogs ───────────────────────────────────────────

exports.listBlogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin");

  const filter = {};
  if (isAdmin && req.query.status && req.query.status !== "all") filter.status = req.query.status;
  else if (!isAdmin || !req.query.status) filter.status = "published";

  if (req.query.category) filter.category = new RegExp("^" + esc(req.query.category) + "$", "i");
  if (req.query.tag) filter.tags = new RegExp("^" + esc(req.query.tag) + "$", "i");
  if (req.query.search) {
    const rx = new RegExp(esc(req.query.search), "i");
    filter.$or = [{ title: rx }, { excerpt: rx }, { category: rx }, { tags: rx }];
  }

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .select("-content")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Blog.countDocuments(filter),
  ]);

  return sendPaginated(res, 200, "Blogs fetched.", { blogs }, buildPaginationMeta(total, page, limit));
});

// ─── Public: single blog by slug (increments views) ─────────────────────────

exports.getBlog = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin");

  const blog = await Blog.findOneAndUpdate(
    { slug, ...(isAdmin ? {} : { status: "published" }) },
    isAdmin ? {} : { $inc: { views: 1 } },
    { new: true }
  ).lean();

  if (!blog) return next(new AppError("Blog not found.", 404));
  return sendSuccess(res, 200, "Blog fetched.", { blog });
});

// ─── Admin: create ─────────────────────────────────────────────────────────

exports.createBlog = asyncHandler(async (req, res) => {
  const b = req.body;
  const slug = await uniqueSlug(b.title);

  let coverImage = { url: null, publicId: null };
  const coverFile = req.files?.coverImage?.[0];
  if (coverFile) {
    coverImage = await uploadToCloudinary(coverFile.buffer, "examneeti/blogs");
  }

  const status = b.status || "draft";
  const blog = await Blog.create({
    title: b.title.trim(),
    slug,
    excerpt: b.excerpt || "",
    content: b.content,
    category: b.category || "General",
    tags: Array.isArray(b.tags) ? b.tags : [],
    status,
    style: b.style || {},
    readMinutes: b.readMinutes || estimateReadMinutes(b.content),
    coverImage,
    author: { userId: req.user.id, email: req.user.email, name: req.user.name || "" },
    publishedAt: status === "published" ? new Date() : null,
  });

  return sendSuccess(res, 201, "Blog created.", { blog });
});

// ─── Admin: update ─────────────────────────────────────────────────────────

exports.updateBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return next(new AppError("Blog not found.", 404));

  const b = req.body;
  if (b.title !== undefined && b.title.trim() !== blog.title) {
    blog.title = b.title.trim();
    blog.slug = await uniqueSlug(b.title, blog._id);
  }
  for (const f of ["excerpt", "content", "category"]) {
    if (b[f] !== undefined) blog[f] = b[f];
  }
  if (b.tags !== undefined) blog.tags = Array.isArray(b.tags) ? b.tags : [];
  if (b.style !== undefined) blog.style = { ...blog.style.toObject?.() ?? blog.style, ...b.style };
  if (b.readMinutes !== undefined) blog.readMinutes = b.readMinutes;

  if (b.status !== undefined && b.status !== blog.status) {
    blog.status = b.status;
    if (b.status === "published" && !blog.publishedAt) blog.publishedAt = new Date();
  }

  const coverFile = req.files?.coverImage?.[0];
  if (b.removeCoverImage && blog.coverImage?.publicId) {
    await deleteFromCloudinary(blog.coverImage.publicId);
    blog.coverImage = { url: null, publicId: null };
  } else if (coverFile) {
    if (blog.coverImage?.publicId) await deleteFromCloudinary(blog.coverImage.publicId);
    blog.coverImage = await uploadToCloudinary(coverFile.buffer, "examneeti/blogs");
  }

  await blog.save();
  return sendSuccess(res, 200, "Blog updated.", { blog });
});

// ─── Admin: delete ─────────────────────────────────────────────────────────

exports.deleteBlog = asyncHandler(async (req, res, next) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return next(new AppError("Blog not found.", 404));

  if (blog.coverImage?.publicId) await deleteFromCloudinary(blog.coverImage.publicId);
  await blog.deleteOne();

  return sendSuccess(res, 200, "Blog deleted.", { deletedId: blog._id });
});

// ─── Admin: inline image upload for the block editor ───────────────────────
// Accepts one "image" file, stores it in Cloudinary, returns its URL for
// embedding in blog body content. Not tied to any Blog document.
exports.uploadBlogImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError("No image file provided.", 400));
  const { url } = await uploadToCloudinary(req.file.buffer, "examneeti/blogs/content");
  return sendSuccess(res, 201, "Image uploaded.", { url });
});
