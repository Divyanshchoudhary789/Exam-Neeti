"use strict";

const express = require("express");
const router = express.Router();

const blogController = require("../controllers/blog.controller");
const authenticate = require("../middleware/authenticate");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { contentUpload, contentImageUpload } = require("../middleware/upload");
const {
  createBlogSchema, updateBlogSchema, listContentQuerySchema,
} = require("../validators/content.validator");
const { ROLES } = require("../config/constants");

// Multipart text fields arrive as strings — coerce the JSON / bool ones.
function parseContentFields(req, res, next) {
  const b = req.body;
  for (const f of ["tags", "style"]) {
    if (typeof b[f] === "string" && b[f].trim()) {
      try { b[f] = JSON.parse(b[f]); } catch { /* validator will reject */ }
    }
  }
  for (const f of ["removeCoverImage", "removeFile"]) {
    if (b[f] === "true") b[f] = true;
    else if (b[f] === "false") b[f] = false;
  }
  if (b.readMinutes !== undefined && b.readMinutes !== "") b.readMinutes = Number(b.readMinutes);
  next();
}

// ── Public (admins see drafts) ──────────────────────────────────────────────
router.get("/", optionalAuthenticate, validate(listContentQuerySchema, "query"), blogController.listBlogs);
router.get("/:slug", optionalAuthenticate, blogController.getBlog);

// ── Admin ───────────────────────────────────────────────────────────────────
router.use(authenticate, authorize(ROLES.ADMIN));
router.post("/upload-image", contentImageUpload, blogController.uploadBlogImage);
router.post("/", contentUpload, parseContentFields, validate(createBlogSchema), blogController.createBlog);
router.patch("/:id", contentUpload, parseContentFields, validate(updateBlogSchema), blogController.updateBlog);
router.delete("/:id", blogController.deleteBlog);

module.exports = router;
