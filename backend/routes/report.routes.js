const express = require("express");
const router = express.Router();

const reportController = require("../controllers/report.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { generateReportSchema } = require("../validators/report.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// Students see only their own reports (scoped inside controller by req.user.id).
// Admins/super_admin see all reports (controller uses filter: {} for admin roles).

router.get("/", reportController.listReports);

// Student: generate own report types (STUDENT_*).
// Admin-type reports (ADMIN_SPRINT, ADMIN_BATCH, etc.) are blocked for students
// inside the generateReport controller via explicit role check — belt-and-suspenders.
router.post("/", validate(generateReportSchema), reportController.generateReport);

// Status check: students see own, admins see any (scoped in controller)
router.get("/:reportId/status", reportController.getReportStatus);

// Download: students see own, admins can download any report (scoped in controller)
router.get("/:reportId/download", reportController.downloadReport);

module.exports = router;
