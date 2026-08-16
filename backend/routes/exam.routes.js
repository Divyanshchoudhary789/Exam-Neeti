const express = require("express");
const router = express.Router();

const examController = require("../controllers/exam.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const {
  createExamSchema,
  updateExamSchema,
  submitAttemptSchema,
} = require("../validators/exam.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// These must be defined BEFORE router.use(authorize(ROLES.ADMIN)) so students
// can reach them. Each controller enforces its own ownership / batch checks.

// Student: list all published/completed exams for own batch (with attempt status annotation)
router.get("/my-exams", examController.getMyExams);

// Student: list own submitted attempts
router.get("/my-attempts", examController.getMyAttempts);

// Student: get single attempt detail (controller scopes to req.user.id for students)
router.get("/attempts/:attemptId", examController.getAttemptDetail);

// Student: submit an in-progress attempt (controller verifies attempt.student === req.user.id)
router.post(
  "/attempts/:attemptId/submit",
  validate(submitAttemptSchema),
  examController.submitAttempt
);

// Student: start an attempt (controller enforces batch membership)
router.post("/:id/start", examController.startAttempt);

// Student: view a single published exam (controller strips answers + enforces batch membership)
router.get("/:id", examController.getExam);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.use(authorize(ROLES.ADMIN));

// Admin: list all exams (with sprint/batch/status filters)
router.get("/", examController.listExams);

// Admin: generate (create) a new exam for a batch
router.post("/", validate(createExamSchema), examController.generateExam);

// Admin: update exam metadata (title, duration, status, etc.)
router.patch("/:id", validate(updateExamSchema), examController.updateExam);

// Admin: list attempts for a specific exam (for review/monitoring)
router.get("/:id/attempts", examController.listExamAttempts);

// Admin: delete a DRAFT exam (cannot delete published/in-use exams)
router.delete("/:id", examController.deleteExam);

module.exports = router;
