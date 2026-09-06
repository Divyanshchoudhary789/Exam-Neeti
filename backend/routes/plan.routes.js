const express = require("express");
const router = express.Router();

const planController = require("../controllers/plan.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

// Public — the pricing page and the in-dashboard upgrade modal both read
// live prices from here instead of hardcoding them.
router.get("/", planController.listPlans);

// Admin — per-plan exam/student overview for the "Plans & Tiers" panel.
router.get("/admin/overview", authenticate, authorize(ROLES.ADMIN), planController.getAdminOverview);

module.exports = router;
