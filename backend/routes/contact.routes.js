"use strict";

const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contact.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  submitContactSchema, listContactQuerySchema, updateContactSchema,
} = require("../validators/contact.validator");
const { ROLES } = require("../config/constants");

// ── Public — the website contact form ──────────────────────────────────────
// authLimiter (10 / 15 min / IP) keeps a bot from flooding the support inbox.
router.post("/", authLimiter, validate(submitContactSchema), contactController.submitContact);

// ── Admin — the support inbox ─────────────────────────────────────────────
router.use(authenticate, authorize(ROLES.ADMIN));
router.get("/", validate(listContactQuerySchema, "query"), contactController.listContactMessages);
router.patch("/:id", validate(updateContactSchema), contactController.updateContactMessage);
router.delete("/:id", contactController.deleteContactMessage);

module.exports = router;
