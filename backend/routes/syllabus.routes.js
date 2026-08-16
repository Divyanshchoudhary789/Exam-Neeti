const express = require("express");
const router = express.Router();
const Joi = require("joi");

const syllabusController = require("../controllers/syllabus.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { ROLES } = require("../config/constants");

// Joi schema for topic weight update — validates before hitting controller
const updateTopicWeightSchema = Joi.object({
  weight: Joi.number().min(0.1).max(10).required().messages({
    "number.base":    "Weight must be a number.",
    "number.min":     "Weight must be at least 0.1.",
    "number.max":     "Weight cannot exceed 10.",
    "any.required":   "Weight is required.",
  }),
});

router.use(authenticate);

// ── Public to all authenticated users ────────────────────────────────────────

// GET /syllabus              — full syllabus tree (subject/chapter/topic)
router.get("/", syllabusController.getSyllabus);

// GET /syllabus/stats        — chapter and topic counts per subject
router.get("/stats", syllabusController.getSyllabusStats);

// GET /syllabus/blueprint    — full test series blueprint
router.get("/blueprint", syllabusController.getBlueprint);

// GET /syllabus/blueprint/:programType/:testCode  — single blueprint entry
router.get("/blueprint/:programType/:testCode", syllabusController.getBlueprintEntry);

// ── Student: own coverage ─────────────────────────────────────────────────────

// GET /syllabus/coverage/me/:sprintId
router.get("/coverage/me/:sprintId", syllabusController.getMycoverage);

// ── Admin-only ────────────────────────────────────────────────────────────────

// PATCH /syllabus/topics/:id  — update topic weight
router.patch(
  "/topics/:id",
  authorize(ROLES.ADMIN),
  validate(updateTopicWeightSchema),
  syllabusController.updateTopicWeight
);

// GET /syllabus/coverage/student/:studentId/:sprintId
router.get(
  "/coverage/student/:studentId/:sprintId",
  authorize(ROLES.ADMIN),
  syllabusController.getStudentCoverage
);

// GET /syllabus/coverage/batch/:sprintId?batchId=...
router.get(
  "/coverage/batch/:sprintId",
  authorize(ROLES.ADMIN),
  syllabusController.getBatchCoverage
);

module.exports = router;
