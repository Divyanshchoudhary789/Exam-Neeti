const mongoose = require("mongoose");
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
const {
  REPORT_TYPE,
  ROLES,
  ATTEMPT_STATUS,
  REPORT_STATUS,
} = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");

// ─── Build report data by type ────────────────────────────────────────────────

const buildReportData = async (type, scope, scopeRefId, sprintId, requestingUserId) => {
  switch (type) {

    // ── Student: Overall performance across all tests in a sprint ─────────────
    case REPORT_TYPE.STUDENT_OVERALL: {
      const analytics = await AnalyticsResult.find({
        student: requestingUserId,
        ...(sprintId ? { sprint: sprintId } : {}),
      })
        .populate("exam", "title examNumber")
        .sort({ createdAt: 1 })
        .lean();

      const user = await User.findById(requestingUserId).lean();
      const scores = analytics.map((a) => a.score);
      const avgScore = scores.length
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2))
        : 0;

      return {
        reportTitle: "Overall Performance Report",
        meta: {
          "Student Name":  user?.name,
          "Student Email": user?.email,
          "Total Tests":   analytics.length,
          "Average Score": avgScore,
          "Highest Score": scores.length ? Math.max(...scores) : 0,
        },
        summary: {
          "Total Tests":          analytics.length,
          "Total Score":          scores.reduce((s, v) => s + v, 0),
          "Highest Score":        scores.length ? Math.max(...scores) : 0,
          "Average Score":        avgScore,
          "Overall Accuracy (%)": analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.overallAccuracy, 0) / analytics.length).toFixed(2))
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
              a.score, a.totalMarks, `${a.percentage}%`, `${a.overallAccuracy}%`,
            ]),
          },
        ],
      };
    }

    // ── Student: Subject-wise breakdown ──────────────────────────────────────
    case REPORT_TYPE.STUDENT_SUBJECT: {
      const analytics = await AnalyticsResult.findOne({
        ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle:     "Subject Performance Report",
        summary:         {},
        subjectBreakdown: analytics?.subjectAccuracy || [],
      };
    }

    // ── Student: Chapter breakdown ────────────────────────────────────────────
    case REPORT_TYPE.STUDENT_CHAPTER: {
      const analytics = await AnalyticsResult.findOne({
        student: requestingUserId,
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle:     "Chapter Performance Report",
        summary:         {},
        chapterBreakdown: analytics?.chapterAccuracy || [],
        topicAccuracy:   analytics?.topicAccuracy   || [],
      };
    }

    // ── Student: Time utilization ─────────────────────────────────────────────
    case REPORT_TYPE.STUDENT_TIME: {
      const analytics = await AnalyticsResult.findOne({
        ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle: "Time Utilization Report",
        summary: {
          "Total Time (s)":          analytics?.totalTimeSeconds   || 0,
          "Avg Time Per Question (s)": analytics?.avgTimePerQuestion || 0,
          "Avg Time on Correct (s)": analytics?.avgTimeOnCorrect   || 0,
          "Avg Time on Incorrect (s)": analytics?.avgTimeOnIncorrect || 0,
        },
        questionTimings: analytics?.questionTimings || [],
        sections: [
          {
            title:   "Fastest Questions",
            headers: ["Slot", "Subject", "Difficulty", "Time (s)", "Correct"],
            rows: (analytics?.fastestQuestions || []).map((q) => [
              q.slotPosition, q.subject, q.difficulty, q.timeSpentSeconds,
              q.isCorrect ? "Yes" : "No",
            ]),
          },
          {
            title:   "Slowest Questions",
            headers: ["Slot", "Subject", "Difficulty", "Time (s)", "Correct"],
            rows: (analytics?.slowestQuestions || []).map((q) => [
              q.slotPosition, q.subject, q.difficulty, q.timeSpentSeconds,
              q.isCorrect ? "Yes" : "No",
            ]),
          },
        ],
      };
    }

    // ── Student: Accuracy breakdown ───────────────────────────────────────────
    case REPORT_TYPE.STUDENT_ACCURACY: {
      const analytics = await AnalyticsResult.find({
        student: requestingUserId,
        ...(sprintId ? { sprint: sprintId } : {}),
      })
        .populate("exam", "title examNumber")
        .sort({ createdAt: 1 })
        .lean();

      return {
        reportTitle: "Accuracy Analysis Report",
        summary: {
          "Total Tests":          analytics.length,
          "Avg Accuracy (%)":     analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.overallAccuracy, 0) / analytics.length).toFixed(2))
            : 0,
          "Avg Attempt Rate (%)": analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.overallAttemptRate, 0) / analytics.length).toFixed(2))
            : 0,
        },
        sections: [
          {
            title:   "Accuracy per Test",
            headers: ["Exam", "Accuracy %", "Attempt Rate %", "Correct", "Incorrect", "Unattempted", "Guesses", "Negative Marks"],
            rows: analytics.map((a) => [
              a.exam?.title || `Exam ${a.exam?.examNumber}`,
              `${a.overallAccuracy}%`, `${a.overallAttemptRate}%`,
              a.totalCorrect, a.totalIncorrect, a.totalUnattempted,
              a.totalGuessAttempts, a.totalNegativeMarks,
            ]),
          },
        ],
      };
    }

    // ── Student: Recoverable marks ────────────────────────────────────────────
    case REPORT_TYPE.STUDENT_RECOVERABLE: {
      const analytics = await AnalyticsResult.findOne({
        student: requestingUserId,
        ...(scopeRefId ? { attempt: scopeRefId } : {}),
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      return {
        reportTitle:     "Recoverable Marks Report",
        summary:         {},
        recoverableMarks: analytics?.recoverableMarks || null,
      };
    }

    // ── Admin: Sprint-level report ────────────────────────────────────────────
    case REPORT_TYPE.ADMIN_SPRINT: {
      // FIX: Use consistent ObjectId for all queries (was mixing sprintId string and sprintOid)
      const sprintOid = mongoose.Types.ObjectId.isValid(sprintId)
        ? new mongoose.Types.ObjectId(sprintId)
        : null;

      if (!sprintOid) return { reportTitle: "Sprint Report", summary: { Error: "Invalid sprint ID" } };

      const [exams, totalStudents, totalAttempts, analytics] = await Promise.all([
        Exam.find({ sprint: sprintOid }).select("title examNumber totalMarks").lean(),
        // Count students in batches associated with this sprint
        Exam.distinct("batch", { sprint: sprintOid }).then((batchIds) =>
          User.countDocuments({ role: ROLES.STUDENT, isActive: true, batch: { $in: batchIds } })
        ),
        Attempt.countDocuments({ sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED }),
        AnalyticsResult.find({ sprint: sprintOid }).lean(),
      ]);

      const avgScore = analytics.length
        ? parseFloat((analytics.reduce((s, a) => s + a.score, 0) / analytics.length).toFixed(2))
        : 0;

      // Per-exam submission counts via single aggregation
      const examSubmissions = sprintOid
        ? await Attempt.aggregate([
            { $match: { sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED } },
            { $group: { _id: "$exam", count: { $sum: 1 } } },
          ])
        : [];
      const submissionMap = Object.fromEntries(
        examSubmissions.map((e) => [e._id.toString(), e.count])
      );

      return {
        reportTitle: "Sprint Performance Report",
        summary: {
          "Total Exams":       exams.length,
          "Total Students":    totalStudents,
          "Total Submissions": totalAttempts,
          "Average Score":     avgScore,
        },
        sections: [
          {
            title:   "Exam-wise Stats",
            headers: ["Exam", "Total Marks", "Submissions", "Avg Score"],
            rows: exams.map((e) => {
              const eId  = e._id.toString();
              const eAna = analytics.filter((a) => a.exam?.toString() === eId);
              const eAvg = eAna.length
                ? parseFloat((eAna.reduce((s, a) => s + a.score, 0) / eAna.length).toFixed(2))
                : 0;
              return [e.title, e.totalMarks, submissionMap[eId] || 0, eAvg];
            }),
          },
        ],
      };
    }

    // ── Admin: Batch-level report ─────────────────────────────────────────────
    case REPORT_TYPE.ADMIN_BATCH: {
      const batch    = await Batch.findById(scopeRefId).lean();
      const analytics = await AnalyticsResult.find({
        batch: scopeRefId,
        ...(sprintId ? { sprint: sprintId } : {}),
      }).lean();

      // Build subject aggregation across all students in batch
      const subjectAgg = {};
      for (const ar of analytics) {
        for (const s of ar.subjectAccuracy || []) {
          if (!subjectAgg[s.subject]) {
            subjectAgg[s.subject] = { subject: s.subject, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0, negativeMarks: 0 };
          }
          subjectAgg[s.subject].totalQuestions += s.totalQuestions || 0;
          subjectAgg[s.subject].attempted      += s.attempted      || 0;
          subjectAgg[s.subject].correct        += s.correct        || 0;
          subjectAgg[s.subject].incorrect      += s.incorrect      || 0;
          subjectAgg[s.subject].marksObtained  += s.marksObtained  || 0;
          subjectAgg[s.subject].negativeMarks  += s.negativeMarks  || 0;
        }
      }
      const subjectBreakdown = Object.values(subjectAgg).map((s) => ({
        ...s,
        accuracy:    parseFloat(((s.correct   / Math.max(s.attempted,      1)) * 100).toFixed(2)),
        attemptRate: parseFloat(((s.attempted / Math.max(s.totalQuestions, 1)) * 100).toFixed(2)),
      }));

      return {
        reportTitle: `Batch Report — ${batch?.name || "Batch"}`,
        summary: {
          "Batch":             batch?.name  || "—",
          "Total Submissions": analytics.length,
          "Average Score":     analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.score, 0) / analytics.length).toFixed(2))
            : 0,
          "Average Accuracy (%)": analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.overallAccuracy, 0) / analytics.length).toFixed(2))
            : 0,
          "Average Attempt Rate (%)": analytics.length
            ? parseFloat((analytics.reduce((s, a) => s + a.overallAttemptRate, 0) / analytics.length).toFixed(2))
            : 0,
        },
        subjectBreakdown,
      };
    }

    // ── Admin: Single student full report ─────────────────────────────────────
    case REPORT_TYPE.ADMIN_STUDENT: {
      const targetId = scopeRefId || requestingUserId;
      const [student, allAnalytics] = await Promise.all([
        User.findById(targetId).populate("batch", "name").lean(),
        AnalyticsResult.find({ student: targetId, ...(sprintId ? { sprint: sprintId } : {}) })
          .populate("exam", "title examNumber totalMarks")
          .sort({ createdAt: 1 })
          .lean(),
      ]);

      if (!student) return { reportTitle: "Student Report", summary: { Error: "Student not found" } };

      const scores   = allAnalytics.map((a) => a.score);
      const avgScore = scores.length
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2))
        : 0;

      const subjectAgg = {};
      for (const ar of allAnalytics) {
        for (const s of ar.subjectAccuracy || []) {
          if (!subjectAgg[s.subject]) {
            subjectAgg[s.subject] = { subject: s.subject, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0, negativeMarks: 0 };
          }
          subjectAgg[s.subject].totalQuestions += s.totalQuestions || 0;
          subjectAgg[s.subject].attempted      += s.attempted      || 0;
          subjectAgg[s.subject].correct        += s.correct        || 0;
          subjectAgg[s.subject].incorrect      += s.incorrect      || 0;
          subjectAgg[s.subject].marksObtained  += s.marksObtained  || 0;
          subjectAgg[s.subject].negativeMarks  += s.negativeMarks  || 0;
        }
      }
      const subjectBreakdown = Object.values(subjectAgg).map((s) => ({
        ...s,
        accuracy:    parseFloat(((s.correct   / Math.max(s.attempted,      1)) * 100).toFixed(2)),
        attemptRate: parseFloat(((s.attempted / Math.max(s.totalQuestions, 1)) * 100).toFixed(2)),
      }));

      return {
        reportTitle: `Student Report — ${student.name}`,
        meta: {
          "Student Name":  student.name,
          "Student Email": student.email,
          "Batch":         student.batch?.name || "—",
          "Total Tests":   allAnalytics.length,
          "Average Score": avgScore,
          "Highest Score": scores.length ? Math.max(...scores) : 0,
        },
        summary: {
          "Total Tests":      allAnalytics.length,
          "Average Score":    avgScore,
          "Highest Score":    scores.length ? Math.max(...scores) : 0,
          "Lowest Score":     scores.length ? Math.min(...scores) : 0,
          "Average Accuracy": allAnalytics.length
            ? parseFloat((allAnalytics.reduce((s, a) => s + a.overallAccuracy, 0) / allAnalytics.length).toFixed(2))
            : 0,
        },
        subjectBreakdown,
        chapterBreakdown: allAnalytics.length ? allAnalytics[allAnalytics.length - 1].chapterAccuracy || [] : [],
        recoverableMarks: allAnalytics.length ? allAnalytics[allAnalytics.length - 1].recoverableMarks : null,
        sections: [
          {
            title:   "Test-wise Performance",
            headers: ["Exam", "Score", "Total Marks", "Percentage", "Accuracy %", "Attempt Rate %"],
            rows: allAnalytics.map((a) => [
              a.exam?.title || `Exam ${a.exam?.examNumber}`,
              a.score, a.totalMarks,
              `${a.percentage}%`, `${a.overallAccuracy}%`, `${a.overallAttemptRate}%`,
            ]),
          },
        ],
      };
    }

    // ── Admin: Comparative — all students side by side ────────────────────────
    case REPORT_TYPE.ADMIN_COMPARATIVE: {
      const matchFilter = {
        ...(sprintId  ? { sprint: sprintId  } : {}),
        ...(scopeRefId ? { batch:  scopeRefId } : {}),
      };
      const allAnalytics = await AnalyticsResult.find(matchFilter)
        .populate("student", "name email")
        .populate("batch", "name")
        .lean();

      // Keep latest result per student
      const studentMap = {};
      for (const ar of allAnalytics) {
        const sid = ar.student?._id?.toString();
        if (!sid) continue;
        if (!studentMap[sid] || ar.createdAt > studentMap[sid].createdAt) {
          studentMap[sid] = ar;
        }
      }

      const rows = Object.values(studentMap)
        .sort((a, b) => b.score - a.score)
        .map((ar, idx) => [
          idx + 1,
          ar.student?.name, ar.student?.email,
          ar.score, ar.totalMarks,
          `${ar.percentage}%`, `${ar.overallAccuracy}%`, `${ar.overallAttemptRate}%`,
          ar.totalNegativeMarks,
        ]);

      return {
        reportTitle: "Comparative Student Report",
        summary: {
          "Total Students": rows.length,
          "Sprint / Batch": scopeRefId || sprintId || "All",
        },
        sections: [
          {
            title:   "Student Comparison",
            headers: ["Rank", "Name", "Email", "Score", "Total Marks", "Percentage", "Accuracy %", "Attempt Rate %", "Negative Marks"],
            rows,
          },
        ],
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

  const filter = {
    _id: req.params.reportId,
    ...(isAdmin ? {} : { owner: req.user.id }),
  };

  const report = await Report.findOne(filter);
  if (!report) return next(new AppError("Report not found.", 404));

  try {
    // FIX: use the report's owner, not the requesting admin — an admin
    // downloading a student-owned report must get that student's analytics,
    // not their own (which for STUDENT_* report types would be empty/wrong).
    const data = await buildReportData(
      report.type,
      report.scope,
      report.scopeRefId?.toString(),
      report.sprint?.toString(),
      report.owner.toString()
    );

    const { buffer } = await generateReport(report, data);

    // FIX: Update report status to READY after successful generation
    // Status was permanently stuck at PENDING — GET /status always returned "pending"
    await Report.findByIdAndUpdate(report._id, {
      status:      REPORT_STATUS.READY,
      generatedAt: new Date(),
      fileSize:    buffer.length,
    });

    const contentType =
      report.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const ext      = report.format === "pdf" ? "pdf" : "xlsx";
    const filename = `report_${report._id}.${ext}`;

    res.setHeader("Content-Type",        contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length",      buffer.length);

    return res.send(buffer);
  } catch (err) {
    // FIX: Mark report as FAILED so the status endpoint reflects the real state
    await Report.findByIdAndUpdate(report._id, {
      status: REPORT_STATUS.FAILED,
    }).catch(() => {}); // non-throwing — don't mask original error

    console.error("[Report] Download failed:", err.message);
    return next(new AppError("Failed to generate report. Please try again.", 500));
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
    success:    true,
    message:    "Reports fetched.",
    data:       { reports },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Get Report Status ────────────────────────────────────────────────────────

exports.getReportStatus = asyncHandler(async (req, res, next) => {
  const isAdmin = req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;
  const filter  = {
    _id: req.params.reportId,
    ...(isAdmin ? {} : { owner: req.user.id }),
  };

  const report = await Report.findOne(filter).lean();
  if (!report) return next(new AppError("Report not found.", 404));

  return sendSuccess(res, 200, "Report status fetched.", {
    reportId:    report._id,
    status:      report.status,
    format:      report.format,
    type:        report.type,
    generatedAt: report.generatedAt,
    fileSize:    report.fileSize,
  });
});
