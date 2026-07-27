const express = require("express");
const router = express.Router();

const probabilityController = require("../controllers/probability.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { questionnaireSchema } = require("../validators/probability.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────

// Student: submit initial self-assessment questionnaire for a sprint
router.post(
  "/questionnaire",
  validate(questionnaireSchema),
  probabilityController.submitQuestionnaire
);

// Student: view own exam probability data for a sprint
router.get("/sprint/:sprintId", probabilityController.getMyProbability);

// ── Admin-only routes ─────────────────────────────────────────────────────────

// Admin: view any specific student's probability for a sprint.
// Route-level authorize required — students must not access other students' data
// by guessing studentId in /sprint/:sprintId/student/:studentId.
router.get(
  "/sprint/:sprintId/student/:studentId",
  authorize(ROLES.ADMIN),
  probabilityController.getStudentProbability
);

module.exports = router;
