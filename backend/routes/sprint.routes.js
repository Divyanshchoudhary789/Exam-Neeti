const express = require("express");
const router = express.Router();

const sprintController = require("../controllers/sprint.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const {
  createSprintSchema,
  updateSprintSchema,
  updateSprintBlueprintSchema,
  slotQuestionsQuerySchema,
  listSprintsQuerySchema,
  paperQuerySchema,
  subjectProgressSchema,
  deletionRequestSchema,
  deletionDecisionSchema,
} = require("../validators/sprint.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// Students can only see the currently active sprint (stripped of internal fields).
router.get("/active", sprintController.getActiveSprint);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.use(authorize(ROLES.ADMIN));

router.get("/", validate(listSprintsQuerySchema, "query"), sprintController.listSprints);
router.post("/", validate(createSprintSchema), sprintController.createSprint);

// Per-slot candidate questions for the Sprint Builder (fixed path — must stay
// above "/:id" so Express doesn't treat "slot-questions" as an id).
router.get(
  "/slot-questions",
  validate(slotQuestionsQuerySchema, "query"),
  sprintController.listSlotQuestions
);

// Super-admin: queue of pending sprint deletion requests (fixed path before /:id).
router.get(
  "/deletion-requests",
  authorize(ROLES.SUPER_ADMIN),
  sprintController.listDeletionRequests
);

// NOTE: /:id param routes must come AFTER fixed-path routes (/active, etc.)
router.get("/:id", sprintController.getSprint);
router.get("/:id/history", sprintController.getSprintHistory);
router.patch("/:id", validate(updateSprintSchema), sprintController.updateSprint);
router.patch(
  "/:id/blueprint",
  validate(updateSprintBlueprintSchema),
  sprintController.updateSprintBlueprint
);
router.get("/:id/slot-stats", sprintController.getSlotStats);

// Download the full question paper (pdf | docx) in blueprint-slot order.
router.get(
  "/:id/paper",
  validate(paperQuerySchema, "query"),
  sprintController.downloadSprintPaper
);

// Multi-admin per-subject workflow — any admin/super_admin marks a subject done.
router.patch(
  "/:id/subject-progress",
  validate(subjectProgressSchema),
  sprintController.markSubjectProgress
);

// ── Sprint deletion — super-admin approval gate ──────────────────────────────
// Admin raises a request; super_admin approves (→ delete) or rejects.
router.post(
  "/:id/deletion-request",
  validate(deletionRequestSchema),
  sprintController.requestSprintDeletion
);
router.delete("/:id/deletion-request", sprintController.cancelSprintDeletionRequest);
router.patch(
  "/:id/deletion-request",
  authorize(ROLES.SUPER_ADMIN),
  validate(deletionDecisionSchema),
  sprintController.decideSprintDeletion
);

// Direct delete — super_admin only. Regular admins must use the request flow above.
router.delete("/:id", authorize(ROLES.SUPER_ADMIN), sprintController.deleteSprint);

module.exports = router;
