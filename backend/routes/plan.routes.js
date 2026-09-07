const express = require("express");
const router = express.Router();

const planController = require("../controllers/plan.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { createPlanSchema, updatePlanSchema } = require("../validators/plan.validator");
const { ROLES } = require("../config/constants");

// Public — the pricing page and the in-dashboard upgrade modal both read
// live prices from here instead of hardcoding them.
router.get("/", planController.listPlans);

// ── Admin — plan catalog management ────────────────────────────────────────
router.use(authenticate, authorize(ROLES.ADMIN));

// Per-plan exam/student/subscriber overview for the "Plans & Tiers" panel.
router.get("/admin/overview", planController.getAdminOverview);

router.post("/", validate(createPlanSchema), planController.createPlan);
router.patch("/:id", validate(updatePlanSchema), planController.updatePlan);

// Hard delete — super_admin only, and only when the plan has no history.
router.delete("/:id", authorize(ROLES.SUPER_ADMIN), planController.deletePlan);

module.exports = router;
