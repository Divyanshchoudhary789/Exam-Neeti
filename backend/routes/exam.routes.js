const express = require("express");
const router = express.Router();

const examController = require("../controllers/exam.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { heavyOperationLimiter } = require("../middleware/rateLimiter");
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

// Student: get attempt detail WITH full question text/options from Question Bank
// Used by the analytics Solutions tab to show question content after submission
router.get("/attempts/:attemptId/with-questions", examController.getAttemptWithQuestions);

// Student: submit an in-progress attempt (controller verifies attempt.student === req.user.id)
// Rate-limited: triggers scoring + the full post-submission analytics pipeline.
router.post(
  "/attempts/:attemptId/submit",
  heavyOperationLimiter,
  validate(submitAttemptSchema),
  examController.submitAttempt
);

// Student: start an attempt (controller enforces batch membership).
// Deliberately NOT behind heavyOperationLimiter: unlike submit (once per exam),
// this endpoint is also the resume path — a student reconnecting after a
// network drop or refresh during a live timed exam calls it again. Rate-limiting
// it risks locking a student out of their own in-progress exam, which is worse
// than the abuse it would prevent (the general apiLimiter still applies).
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
