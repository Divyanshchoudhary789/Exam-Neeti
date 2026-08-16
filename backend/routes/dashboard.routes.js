const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboard.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

// Dashboard is strictly admin/super_admin territory.
// All routes expose cohort-level aggregated data that students must not see
// (other students' scores, rankings, batch-wide analytics, etc.).
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get("/sprint/:sprintId/overview", dashboardController.getSprintOverview);
router.get("/sprint/:sprintId/batches", dashboardController.getBatchOverview);
router.get("/sprint/:sprintId/rankings", dashboardController.getStudentRankings);
router.get("/sprint/:sprintId/exam-performance", dashboardController.getExamPerformance);
router.get("/sprint/:sprintId/subject-performance", dashboardController.getSubjectPerformance);
router.get("/sprint/:sprintId/summary", dashboardController.getAnalyticsSummary);

// Admin: chapter & topic cohort breakdown — shows where students struggle most
router.get("/sprint/:sprintId/chapter-topic-breakdown", dashboardController.getChapterTopicBreakdown);

// Admin: student attempt status list — who submitted, who is pending, who hasn't started
router.get("/sprint/:sprintId/student-status", dashboardController.getStudentAttemptStatus);

// Admin: full attempt history for a single student across a sprint
router.get("/sprint/:sprintId/student/:studentId/history", dashboardController.getStudentAttemptHistory);

module.exports = router;
