"use strict";

const express = require("express");
const router = express.Router();

const resourceController = require("../controllers/resource.controller");
const authenticate = require("../middleware/authenticate");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { contentUpload } = require("../middleware/upload");
const {
  createResourceSchema, updateResourceSchema, listContentQuerySchema,
} = require("../validators/content.validator");
const { ROLES } = require("../config/constants");

function parseContentFields(req, res, next) {
  const b = req.body;
  if (typeof b.tags === "string" && b.tags.trim()) {
    try { b.tags = JSON.parse(b.tags); } catch { /* validator will reject */ }
  }
  for (const f of ["removeCoverImage", "removeFile"]) {
    if (b[f] === "true") b[f] = true;
    else if (b[f] === "false") b[f] = false;
  }
  next();
}

// ── Public (admins see drafts) ──────────────────────────────────────────────
router.get("/", optionalAuthenticate, validate(listContentQuerySchema, "query"), resourceController.listResources);
router.get("/:id", optionalAuthenticate, resourceController.getResource);

// ── Admin ───────────────────────────────────────────────────────────────────
router.use(authenticate, authorize(ROLES.ADMIN));
router.post("/", contentUpload, parseContentFields, validate(createResourceSchema), resourceController.createResource);
router.patch("/:id", contentUpload, parseContentFields, validate(updateResourceSchema), resourceController.updateResource);
router.delete("/:id", resourceController.deleteResource);

module.exports = router;
