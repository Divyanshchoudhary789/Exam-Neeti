const Report = require("../models/Report.model");
const AnalyticsResult = require("../models/AnalyticsResult.model");
const Attempt = require("../models/Attempt.model");
const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
const Exam = require("../models/Exam.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { generateReport } = require("../services/report.service");
const { sendEmail, templates } = require("../services/email.service");
const { NOTIFICATION_TRIGGER, REPORT_TYPE, REPORT_SCOPE, ROLES, ATTEMPT_STATUS, REPORT_STATUS } = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");

// ─── Build report data by type ────────────────────────────────────────────────

const buildReportData = async (type, scope, scopeRefId, sprintId, requestingUserId) => {
  switch (type) {
    case REPORT_TYPE.STUDENT_OVERALL: {
      const studentId = requestingUserId;
      const analytics = await AnalyticsResult.find({
        student: studentId,
        ...(sprintId ? { sprint: sprintId } : {}),
      })
        .populate("exam", "title examNumber")
        .sort({ createdAt: 1 })
        .lean();

      const user = await User.findById(studentId).lean();
      const scores = analytics.map((a) => a.score);
      const avgScore = scores.length
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2))
        : 0;

      return {
        reportTitle: "Overall Performance Report",
        meta: {
          "Student Name": user?.name,
          "Student Email": user?.email,
          "Total Tests": analytics.length,
          "Average Score": avgScore,
          "Highest Score": scores.length ? Math.max(...scores) : 0,
        },
        summary: {
          "Total Tests": analytics.length,
          "Total Score": scores.reduce((s, v) => s + v, 0),
          "Highest Score": scores.length ? Math.max(...scores) : 0,
          "Average Score": avgScore,
          "Overall Accuracy (%)": analytics.length
            ? parseFloat(
                (
                  analytics.reduce((s, a) => s + a.overallAccuracy, 0) /
                  analytics.length
                ).toFixed(2)
              )
            : 0,
        },
        subjectBreakdown: analytics.length ? analytics[analytics.length - 1].subjectAccuracy : [],
        chapterBreakdown: analytics.length ? analytics[analytics.length - 1].chapterAccuracy : [],
        recoverableMarks: analytics.length ? analytics[analytics.length - 1].recoverableMarks : null,
        sections: [
          {
            title: "Performance Timeline",
            headers: ["Exam", "Score", "Total Marks", "Percentage", "Accuracy %"],
            rows: analytics.map((a) => [
              a.exam?.title || `Exam ${a.exam?.examNumber}`,
              a.score,
              a.totalMarks,
              `${a.percentage}%`,
              `${a.overallAccuracy}%`,
            ]),
          },
        ],
      };
    }

    case REPORT_TYPE.STUDENT_SUBJECT: {
      const analytics = await AnalyticsResult.findOne({
        ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle: "Subject Performance Report",
        summary: {},
        subjectBreakdown: analytics?.subjectAccuracy || [],
      };
    }

    case REPORT_TYPE.STUDENT_CHAPTER: {
      const analytics = await AnalyticsResult.findOne({
        student: requestingUserId,
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle: "Chapter Performance Report",
        summary: {},
        chapterBreakdown: analytics?.chapterAccuracy || [],
        topicAccuracy: analytics?.topicAccuracy || [],
      };
    }

    case REPORT_TYPE.STUDENT_TIME: {
      const analytics = await AnalyticsResult.findOne({
        ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle: "Time Utilization Report",
        summary: {
          "Total Time (s)": analytics?.totalTimeSeconds || 0,
          "Avg Time Per Question (s)": analytics?.avgTimePerQuestion || 0,
        },
        questionTimings: analytics?.questionTimings || [],
        sections: [
          {
            title: "Fastest Questions",
            headers: ["Slot", "Subject", "Difficulty", "Time (s)", "Correct"],
            rows: (analytics?.fastestQuestions || []).map((q) => [
              q.slotPosition, q.subject, q.difficulty, q.timeSpentSeconds,
              q.isCorrect ? "Yes" : "No",
            ]),
          },
          {
            title: "Slowest Questions",
            headers: ["Slot", "Subject", "Difficulty", "Time (s)", "Correct"],
            rows: (analytics?.slowestQuestions || []).map((q) => [
              q.slotPosition, q.subject, q.difficulty, q.timeSpentSeconds,
              q.isCorrect ? "Yes" : "No",
            ]),
          },
        ],
      };
    }

    case REPORT_TYPE.STUDENT_RECOVERABLE: {
      const analytics = await AnalyticsResult.findOne({
        student: requestingUserId,
        ...(scopeRefId ? { attempt: scopeRefId } : {}),
      }).lean();

      return {
        reportTitle: "Recoverable Marks Report",
        summary: {},
        recoverableMarks: analytics?.recoverableMarks || null,
      };
    }

    case REPORT_TYPE.ADMIN_SPRINT: {
      const [exams, totalStudents, totalAttempts] = await Promise.all([
        Exam.find({ sprint: sprintId }).select("title examNumber totalMarks").lean(),
        User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
        Attempt.countDocuments({ sprint: sprintId, status: ATTEMPT_STATUS.SUBMITTED }),
      ]);

      const analytics = await AnalyticsResult.find({ sprint: sprintId }).lean();
      const avgScore = analytics.length
        ? parseFloat(
            (analytics.reduce((s, a) => s + a.score, 0) / analytics.length).toFixed(2)
          )
        : 0;

      return {
        reportTitle: "Sprint Performance Report",
        summary: {
          "Total Exams": exams.length,
          "Total Students": totalStudents,
          "Total Submissions": totalAttempts,
          "Average Score": avgScore,
        },
        sections: [
          {
            title: "Exam-wise Stats",
            headers: ["Exam", "Total Marks", "Submissions"],
            rows: exams.map((e) => [e.title, e.totalMarks, 0]),
          },
        ],
      };
    }

    case REPORT_TYPE.ADMIN_BATCH: {
      const batch = await Batch.findById(scopeRefId).lean();
      const analytics = await AnalyticsResult.find({
        batch: scopeRefId,
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle: `Batch Report — ${batch?.name || "Batch"}`,
        summary: {
          "Total Submissions": analytics.length,
          "Average Score": analytics.length
            ? parseFloat(
                (analytics.reduce((s, a) => s + a.score, 0) / analytics.length).toFixed(2)
              )
            : 0,
          "Average Accuracy (%)": analytics.length
            ? parseFloat(
                (
                  analytics.reduce((s, a) => s + a.overallAccuracy, 0) /
                  analytics.length
                ).toFixed(2)
              )
            : 0,
        },
        subjectBreakdown: [],
      };
    }

    default:
      return { reportTitle: "Report", summary: {} };
  }
};

// ─── Generate Report ──────────────────────────────────────────────────────────

exports.generateReport = asyncHandler(async (req, res, next) => {
  const { type, format, scope, scopeRefId, sprintId } = req.body;

  // Students cannot generate admin-type reports
  const adminReportTypes = [
    REPORT_TYPE.ADMIN_SPRINT,
    REPORT_TYPE.ADMIN_BATCH,
    REPORT_TYPE.ADMIN_STUDENT,
    REPORT_TYPE.ADMIN_COMPARATIVE,
  ];
  if (
    adminReportTypes.includes(type) &&
    req.user.role !== ROLES.ADMIN &&
    req.user.role !== ROLES.SUPER_ADMIN
  ) {
    return next(new AppError("You do not have permission to generate this report type.", 403));
  }

  const reportDoc = await Report.create({
    owner:      req.user.id,
    type,
    format,
    scope,
    scopeRefId: scopeRefId || null,
    sprint:     sprintId   || null,
    status:     REPORT_STATUS.PENDING,
  });

  return sendSuccess(res, 202, "Report created. Use download endpoint to get it.", {
    reportId:    reportDoc._id,
    status:      reportDoc.status,
    downloadUrl: `/api/v1/reports/${reportDoc._id}/download`,
  });
});

// ─── Download Report ──────────────────────────────────────────────────────────

exports.downloadReport = asyncHandler(async (req, res, next) => {
  const isAdmin =
    req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;

  // Admins can download any report; students can only download their own
  const filter = {
    _id: req.params.reportId,
    ...(isAdmin ? {} : { owner: req.user.id }),
  };

  const report = await Report.findOne(filter);

  if (!report) return next(new AppError("Report not found.", 404));

  // Regenerate the report on-the-fly and stream it
  try {
    const data = await buildReportData(
      report.type,
      report.scope,
      report.scopeRefId,
      report.sprint,
      req.user.id
    );

    const { buffer } = await generateReport(report, data);

    const contentType =
      report.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const ext = report.format === "pdf" ? "pdf" : "xlsx";
    const filename = `report_${report._id}.${ext}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (err) {
    console.error("[Report] Download failed:", err.message);
    return next(new AppError("Failed to generate report.", 500));
  }
});

// ─── List Reports ─────────────────────────────────────────────────────────────

exports.listReports = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter =
    req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN
      ? {}
      : { owner: req.user.id };

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Reports fetched.",
    data: { reports },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Get Report Status ────────────────────────────────────────────────────────

exports.getReportStatus = asyncHandler(async (req, res, next) => {
  const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;
  const filter = {
    _id: req.params.reportId,
    ...(isAdmin ? {} : { owner: req.user.id }),
  };

  const report = await Report.findOne(filter).lean();
  if (!report) return next(new AppError("Report not found.", 404));

  return sendSuccess(res, 200, "Report status fetched.", {
    reportId: report._id,
    status: report.status,
    format: report.format,
    type: report.type,
    generatedAt: report.generatedAt,
    fileSize: report.fileSize,
  });
});
