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

const createTopicSchema = Joi.object({
  subject: Joi.string().valid("physics", "chemistry", "biology", "Physics", "Chemistry", "Biology").required().messages({
    "any.required": "Subject is required.",
    "any.only":     "Subject must be Physics, Chemistry, or Biology.",
  }),
  classLevel: Joi.string().valid("XI", "XII", "dropper").required().messages({
    "any.required": "Class level is required.",
    "any.only":     "Class level must be XI, XII, or dropper.",
  }),
  unitCode: Joi.string().allow("").optional(),
  chapter: Joi.string().trim().required().messages({
    "any.required": "Chapter name is required.",
    "string.empty":  "Chapter name cannot be empty.",
  }),
  topic: Joi.string().trim().required().messages({
    "any.required": "Topic name is required.",
    "string.empty":  "Topic name cannot be empty.",
  }),
  topicOrder: Joi.number().min(1).default(1),
  chapterOrder: Joi.number().min(1).default(1),
  weight: Joi.number().min(0.1).max(10).default(1.0),
  isActive: Joi.boolean().default(true),
});

const updateTopicSchema = Joi.object({
  subject: Joi.string().valid("physics", "chemistry", "biology", "Physics", "Chemistry", "Biology").optional(),
  classLevel: Joi.string().valid("XI", "XII", "dropper").optional(),
  unitCode: Joi.string().allow("").optional(),
  chapter: Joi.string().trim().optional(),
  topic: Joi.string().trim().optional(),
  topicOrder: Joi.number().min(1).optional(),
  chapterOrder: Joi.number().min(1).optional(),
  weight: Joi.number().min(0.1).max(10).optional(),
  isActive: Joi.boolean().optional(),
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

// POST /syllabus/topics       — create new syllabus topic
router.post(
  "/topics",
  authorize(ROLES.ADMIN),
  validate(createTopicSchema),
  syllabusController.createTopic
);

// PUT /syllabus/topics/:id    — update entire syllabus topic
router.put(
  "/topics/:id",
  authorize(ROLES.ADMIN),
  validate(updateTopicSchema),
  syllabusController.updateTopic
);

// DELETE /syllabus/topics/:id — delete syllabus topic
router.delete(
  "/topics/:id",
  authorize(ROLES.ADMIN),
  syllabusController.deleteTopic
);

// PATCH /syllabus/topics/:id/toggle — toggle active status
router.patch(
  "/topics/:id/toggle",
  authorize(ROLES.ADMIN),
  syllabusController.toggleTopicActive
);

// POST /syllabus/topics/bulk  — bulk create/upsert topics
router.post(
  "/topics/bulk",
  authorize(ROLES.ADMIN),
  syllabusController.bulkCreateTopics
);

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
