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
} = require("../validators/sprint.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// Students can only see the currently active sprint (stripped of internal fields).
// They cannot enumerate all sprints or view arbitrary sprint details.
router.get("/active", sprintController.getActiveSprint);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.use(authorize(ROLES.ADMIN));

router.get("/", sprintController.listSprints);
router.post("/", validate(createSprintSchema), sprintController.createSprint);

// Per-slot candidate questions for the Sprint Builder (fixed path — must stay
// above "/:id" so Express doesn't treat "slot-questions" as an id).
router.get(
  "/slot-questions",
  validate(slotQuestionsQuerySchema, "query"),
  sprintController.listSlotQuestions
);

// NOTE: /:id param routes must come AFTER fixed-path routes (/active, etc.)
// to avoid Express matching "active" as a dynamic :id segment.
router.get("/:id", sprintController.getSprint);
router.patch("/:id", validate(updateSprintSchema), sprintController.updateSprint);
router.patch(
  "/:id/blueprint",
  validate(updateSprintBlueprintSchema),
  sprintController.updateSprintBlueprint
);
router.get("/:id/slot-stats", sprintController.getSlotStats);

// Admin: delete a DRAFT sprint (blocked if any exams reference it)
router.delete("/:id", sprintController.deleteSprint);

module.exports = router;
