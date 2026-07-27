const express = require("express");
const router = express.Router();

const analyticsController = require("../controllers/analytics.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { upsertFormulaSchema } = require("../validators/formula.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// Each controller action re-validates ownership via DB query (belt-and-suspenders).

// Student: own attempt analytics (controller scopes to req.user.id for students)
router.get("/attempts/:attemptId", analyticsController.getAttemptAnalytics);
router.get("/attempts/:attemptId/advanced", analyticsController.getAdvancedAttemptAnalytics);
router.get("/attempts/:attemptId/order-quality", analyticsController.getAttemptOrderQuality);

// Student: own sprint summary — controller uses req.user.id
router.get("/sprint/:sprintId/me", analyticsController.getStudentSprintSummary);

// ── Mixed-role routes (route-level authorize) ─────────────────────────────────

// Admin-only: view any student's sprint summary by studentId.
// IMPORTANT: must be authorize-guarded — a student could otherwise enumerate
// other students' data by calling /sprint/:id/student/:anyStudentId.
router.get(
  "/sprint/:sprintId/student/:studentId",
  authorize(ROLES.ADMIN),
  analyticsController.getStudentSprintSummary
);

// ── Admin-only routes ─────────────────────────────────────────────────────────

// Admin: force-recompute analytics for a specific attempt
router.post(
  "/attempts/:attemptId/recompute",
  authorize(ROLES.ADMIN),
  analyticsController.recomputeAnalytics
);

// Admin: upsert scoring formula config for a sprint
router.post(
  "/formula-config",
  authorize(ROLES.ADMIN),
  validate(upsertFormulaSchema),
  analyticsController.upsertFormulaConfig
);

// Admin: list formula configs for a sprint
router.get(
  "/formula-config/sprint/:sprintId",
  authorize(ROLES.ADMIN),
  analyticsController.listFormulaConfigs
);

module.exports = router;
