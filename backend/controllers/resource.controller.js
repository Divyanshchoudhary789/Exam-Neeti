"use strict";

const Resource = require("../models/Resource.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/upload");

const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isImageMime = (m) => /^image\//.test(m || "");

async function storeAttachment(file) {
  const resourceType = isImageMime(file.mimetype) ? "image" : "raw";
  const uploaded = await uploadToCloudinary(file.buffer, "examneeti/resources", null, resourceType);
  return {
    url: uploaded.url,
    publicId: uploaded.publicId,
    resourceType,
    fileName: file.originalname,
    sizeBytes: file.size || 0,
  };
}

// ─── Public / admin: list ──────────────────────────────────────────────────

exports.listResources = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin");

  const filter = {};
  if (isAdmin && req.query.status && req.query.status !== "all") filter.status = req.query.status;
  else if (!isAdmin || !req.query.status) filter.status = "published";

  if (req.query.kind) filter.kind = req.query.kind;
  if (req.query.subject) filter.subject = new RegExp("^" + esc(req.query.subject) + "$", "i");
  if (req.query.classLevel) filter.classLevel = new RegExp("^" + esc(req.query.classLevel) + "$", "i");
  if (req.query.tag) filter.tags = new RegExp("^" + esc(req.query.tag) + "$", "i");
  if (req.query.search) {
    const rx = new RegExp(esc(req.query.search), "i");
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
  }

  const [resources, total] = await Promise.all([
    Resource.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Resource.countDocuments(filter),
  ]);

  return sendPaginated(res, 200, "Resources fetched.", { resources }, buildPaginationMeta(total, page, limit));
});

// ─── Public: single (bumps downloadCount for file/link kinds) ───────────────

exports.getResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id).lean();
  if (!resource) return next(new AppError("Resource not found.", 404));
  const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "super_admin");
  if (resource.status !== "published" && !isAdmin) return next(new AppError("Resource not found.", 404));
  return sendSuccess(res, 200, "Resource fetched.", { resource });
});

// ─── Admin: create ─────────────────────────────────────────────────────────

exports.createResource = asyncHandler(async (req, res, next) => {
  const b = req.body;

  const file = req.files?.file?.[0];
  const cover = req.files?.coverImage?.[0];

  if (["past_paper", "notes", "guide"].includes(b.kind) && !file && !b.externalUrl) {
    return next(new AppError("A file upload or an external link is required for this resource type.", 400));
  }
  if (b.kind === "video" && !b.youtubeUrl) {
    return next(new AppError("A YouTube URL is required for a video resource.", 400));
  }
  if (b.kind === "link" && !b.externalUrl) {
    return next(new AppError("An external URL is required for a link resource.", 400));
  }

  const status = b.status || "draft";
  const resource = await Resource.create({
    title: b.title.trim(),
    description: b.description || "",
    detail: b.detail || "",
    kind: b.kind,
    file: file ? await storeAttachment(file) : {},
    youtubeUrl: b.youtubeUrl || null,
    externalUrl: b.externalUrl || null,
    coverImage: cover ? await uploadToCloudinary(cover.buffer, "examneeti/resources") : { url: null, publicId: null },
    subject: b.subject || null,
    classLevel: b.classLevel || null,
    tags: Array.isArray(b.tags) ? b.tags : [],
    status,
    uploadedBy: { userId: req.user.id, email: req.user.email },
    publishedAt: status === "published" ? new Date() : null,
  });

  return sendSuccess(res, 201, "Resource created.", { resource });
});

// ─── Admin: update ─────────────────────────────────────────────────────────

exports.updateResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) return next(new AppError("Resource not found.", 404));

  const b = req.body;
  for (const f of ["title", "description", "detail", "kind", "youtubeUrl", "externalUrl", "subject", "classLevel"]) {
    if (b[f] !== undefined) resource[f] = b[f] === "" ? null : b[f];
  }
  if (b.title !== undefined) resource.title = String(b.title).trim();
  if (b.tags !== undefined) resource.tags = Array.isArray(b.tags) ? b.tags : [];
  if (b.status !== undefined && b.status !== resource.status) {
    resource.status = b.status;
    if (b.status === "published" && !resource.publishedAt) resource.publishedAt = new Date();
  }

  const file = req.files?.file?.[0];
  const cover = req.files?.coverImage?.[0];

  if (b.removeFile && resource.file?.publicId) {
    await deleteFromCloudinary(resource.file.publicId, resource.file.resourceType || "raw");
    resource.file = {};
  } else if (file) {
    if (resource.file?.publicId) await deleteFromCloudinary(resource.file.publicId, resource.file.resourceType || "raw");
    resource.file = await storeAttachment(file);
  }

  if (b.removeCoverImage && resource.coverImage?.publicId) {
    await deleteFromCloudinary(resource.coverImage.publicId);
    resource.coverImage = { url: null, publicId: null };
  } else if (cover) {
    if (resource.coverImage?.publicId) await deleteFromCloudinary(resource.coverImage.publicId);
    resource.coverImage = await uploadToCloudinary(cover.buffer, "examneeti/resources");
  }

  await resource.save();
  return sendSuccess(res, 200, "Resource updated.", { resource });
});

// ─── Admin: delete ─────────────────────────────────────────────────────────

exports.deleteResource = asyncHandler(async (req, res, next) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) return next(new AppError("Resource not found.", 404));

  if (resource.file?.publicId) await deleteFromCloudinary(resource.file.publicId, resource.file.resourceType || "raw");
  if (resource.coverImage?.publicId) await deleteFromCloudinary(resource.coverImage.publicId);
  await resource.deleteOne();

  return sendSuccess(res, 200, "Resource deleted.", { deletedId: resource._id });
});
