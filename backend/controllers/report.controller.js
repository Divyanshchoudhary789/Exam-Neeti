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
const { generateReport, buildReportFilename } = require("../services/report.service");
const {
  REPORT_TYPE,
  ROLES,
  ATTEMPT_STATUS,
  REPORT_STATUS,
} = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");

// ─── Shared aggregation helpers ───────────────────────────────────────────────

/** Sum a per-subject or per-chapter breakdown across many AnalyticsResults so
 *  an "overall" report reflects every test, not just the most recent one. */
const aggregateBreakdown = (analyticsList, key) => {
  const bucket = {};
  for (const ar of analyticsList) {
    for (const row of ar[key] || []) {
      const id = key === "chapterAccuracy" ? `${row.subject}||${row.chapter}` : row.subject;
      if (!id) continue;
      if (!bucket[id]) {
        bucket[id] = {
          subject: row.subject,
          ...(key === "chapterAccuracy" ? { chapter: row.chapter } : {}),
          totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0,
          unattempted: 0, marksObtained: 0, negativeMarks: 0,
        };
      }
      const b = bucket[id];
      b.totalQuestions += row.totalQuestions || 0;
      b.attempted      += row.attempted      || 0;
      b.correct        += row.correct        || 0;
      b.incorrect      += row.incorrect      || 0;
      b.unattempted    += row.unattempted    || 0;
      b.marksObtained  += row.marksObtained  || 0;
      b.negativeMarks  += row.negativeMarks  || 0;
    }
  }
  return Object.values(bucket).map((b) => ({
    ...b,
    accuracy:    parseFloat(((b.correct   / Math.max(b.attempted,      1)) * 100).toFixed(1)),
    attemptRate: parseFloat(((b.attempted / Math.max(b.totalQuestions, 1)) * 100).toFixed(1)),
  }));
};

const round2 = (n) => parseFloat(Number(n || 0).toFixed(2));
const avg = (arr, pick) => (arr.length ? round2(arr.reduce((s, a) => s + (pick(a) || 0), 0) / arr.length) : 0);

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

      const user = await User.findById(requestingUserId).populate("batch", "name").lean();
      const scores = analytics.map((a) => a.score);
      const avgScore = avg(analytics, (a) => a.score);

      return {
        reportTitle: "Overall Performance Report",
        meta: {
          "Student Name":  user?.name,
          "Student Email": user?.email,
          "Batch":         user?.batch?.name || "—",
          "Tests Analysed": analytics.length,
          "Report Scope":  sprintId ? "Selected sprint" : "All sprints",
        },
        summary: {
          "Total Tests":          analytics.length,
          "Total Score":          scores.reduce((s, v) => s + v, 0),
          "Highest Score":        scores.length ? Math.max(...scores) : 0,
          "Lowest Score":         scores.length ? Math.min(...scores) : 0,
          "Average Score":        avgScore,
          "Overall Accuracy (%)":     avg(analytics, (a) => a.overallAccuracy),
          "Overall Attempt Rate (%)": avg(analytics, (a) => a.overallAttemptRate),
        },
        // Aggregated across every test in scope — not just the latest one.
        subjectBreakdown: aggregateBreakdown(analytics, "subjectAccuracy"),
        chapterBreakdown: aggregateBreakdown(analytics, "chapterAccuracy"),
        recoverableMarks: analytics.length ? analytics[analytics.length - 1].recoverableMarks : null,
        sections: [
          {
            title: "Performance Timeline",
            headers: ["Exam", "Score", "Total Marks", "Percentage", "Accuracy %", "Attempt Rate %"],
            rows: analytics.map((a) => [
              a.exam?.title || `Exam ${a.exam?.examNumber}`,
              a.score, a.totalMarks, `${a.percentage}%`, `${a.overallAccuracy}%`, `${a.overallAttemptRate}%`,
            ]),
          },
        ],
      };
    }

    // ── Student: Subject-wise breakdown ──────────────────────────────────────
    case REPORT_TYPE.STUDENT_SUBJECT: {
      const [user, all] = await Promise.all([
        User.findById(requestingUserId).populate("batch", "name").lean(),
        AnalyticsResult.find({
          ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
          ...(sprintId ? { sprint: sprintId } : {}),
        }).sort({ createdAt: 1 }).lean(),
      ]);
      const subjects = aggregateBreakdown(all, "subjectAccuracy");

      return {
        reportTitle: "Subject Performance Report",
        meta: {
          "Student Name": user?.name,
          "Batch":        user?.batch?.name || "—",
          "Tests Analysed": all.length,
          "Report Scope": scopeRefId ? "Single test" : sprintId ? "Selected sprint" : "All sprints",
        },
        summary: {
          "Subjects Covered":   subjects.length,
          "Best Subject":       subjects.length ? [...subjects].sort((a, b) => b.accuracy - a.accuracy)[0].subject : "—",
          "Weakest Subject":    subjects.length ? [...subjects].sort((a, b) => a.accuracy - b.accuracy)[0].subject : "—",
          "Avg Subject Accuracy (%)": subjects.length ? round2(subjects.reduce((s, x) => s + x.accuracy, 0) / subjects.length) : 0,
        },
        subjectBreakdown: subjects,
      };
    }

    // ── Student: Chapter breakdown ────────────────────────────────────────────
    case REPORT_TYPE.STUDENT_CHAPTER: {
      const [user, all] = await Promise.all([
        User.findById(requestingUserId).populate("batch", "name").lean(),
        AnalyticsResult.find({
          student: requestingUserId,
          ...(sprintId ? { sprint: sprintId } : {}),
        }).sort({ createdAt: 1 }).lean(),
      ]);
      const chapters = aggregateBreakdown(all, "chapterAccuracy");
      const weak = chapters.filter((c) => c.accuracy < 50).length;

      return {
        reportTitle: "Chapter Performance Report",
        meta: {
          "Student Name": user?.name,
          "Batch":        user?.batch?.name || "—",
          "Tests Analysed": all.length,
          "Report Scope": sprintId ? "Selected sprint" : "All sprints",
        },
        summary: {
          "Chapters Attempted":       chapters.length,
          "Chapters Below 50%":       weak,
          "Chapters At/Above 70%":    chapters.filter((c) => c.accuracy >= 70).length,
          "Avg Chapter Accuracy (%)": chapters.length ? round2(chapters.reduce((s, x) => s + x.accuracy, 0) / chapters.length) : 0,
        },
        chapterBreakdown: chapters.sort((a, b) => a.accuracy - b.accuracy),
        topicAccuracy:    all.length ? all[all.length - 1].topicAccuracy || [] : [],
      };
    }

    // ── Student: Time utilization ─────────────────────────────────────────────
    case REPORT_TYPE.STUDENT_TIME: {
      const [user, analytics] = await Promise.all([
        User.findById(requestingUserId).lean(),
        AnalyticsResult.findOne({
          ...(scopeRefId ? { attempt: scopeRefId } : { student: requestingUserId }),
          ...(sprintId ? { sprint: sprintId } : {}),
        }).sort({ createdAt: -1 }).lean(),
      ]);

      return {
        reportTitle: "Time Utilization Report",
        meta: {
          "Student Name": user?.name,
          "Based On":     scopeRefId ? "The selected test" : "Your most recent test in scope",
        },
        summary: {
          "Total Time (s)":            analytics?.totalTimeSeconds   || 0,
          "Avg Time Per Question (s)": analytics?.avgTimePerQuestion || 0,
          "Avg Time on Correct (s)":   analytics?.avgTimeOnCorrect   || 0,
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
      const [user, analytics] = await Promise.all([
        User.findById(requestingUserId).lean(),
        AnalyticsResult.find({
          student: requestingUserId,
          ...(sprintId ? { sprint: sprintId } : {}),
        })
          .populate("exam", "title examNumber")
          .sort({ createdAt: 1 })
          .lean(),
      ]);

      return {
        reportTitle: "Accuracy Analysis Report",
        meta: {
          "Student Name": user?.name,
          "Tests Analysed": analytics.length,
          "Report Scope": sprintId ? "Selected sprint" : "All sprints",
        },
        summary: {
          "Total Tests":           analytics.length,
          "Avg Accuracy (%)":      avg(analytics, (a) => a.overallAccuracy),
          "Avg Attempt Rate (%)":  avg(analytics, (a) => a.overallAttemptRate),
          "Total Guess Attempts":  analytics.reduce((s, a) => s + (a.totalGuessAttempts || 0), 0),
          "Total Negative Marks":  analytics.reduce((s, a) => s + (a.totalNegativeMarks || 0), 0),
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
      const [user, analytics] = await Promise.all([
        User.findById(requestingUserId).lean(),
        AnalyticsResult.findOne({
          student: requestingUserId,
          ...(scopeRefId ? { attempt: scopeRefId } : {}),
          ...(sprintId ? { sprint: sprintId } : {}),
        }).sort({ createdAt: -1 }).lean(),
      ]);
      const rm = analytics?.recoverableMarks || null;

      return {
        reportTitle: "Recoverable Marks Report",
        meta: {
          "Student Name": user?.name,
          "Based On":     scopeRefId ? "The selected test" : "Your most recent test in scope",
        },
        summary: rm
          ? { "Total Recoverable Marks": rm.totalRecoverable ?? 0 }
          : {},
        recoverableMarks: rm,
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

// ─── Internal: build + persist the report bytes ──────────────────────────────
// Uses the report's OWNER for analytics scoping — an admin generating/downloading
// a student-owned report must see that student's data, not their own.
const buildAndPersistReport = async (report) => {
  const data = await buildReportData(
    report.type,
    report.scope,
    report.scopeRefId?.toString(),
    report.sprint?.toString(),
    report.owner.toString(),
  );

  const { buffer } = await generateReport(report, data); // sets status/fileSize/generatedAt on the doc
  report.fileBuffer = buffer;
  report.fileName = buildReportFilename(report, data);
  await report.save();

  return { buffer, fileName: report.fileName };
};

const CONTENT_TYPE = {
  pdf: "application/pdf",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ─── Generate Report ──────────────────────────────────────────────────────────
// Generates the file synchronously so the report's status is accurate the
// moment this returns (READY or FAILED) — no more permanent "pending".

exports.generateReport = asyncHandler(async (req, res, next) => {
  const { type, format, scope, scopeRefId, sprintId } = req.body;

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

  const report = await Report.create({
    owner:      req.user.id,
    type,
    format,
    scope,
    scopeRefId: scopeRefId || null,
    sprint:     sprintId   || null,
    status:     REPORT_STATUS.PENDING,
  });

  try {
    await buildAndPersistReport(report);
  } catch (err) {
    await Report.findByIdAndUpdate(report._id, { status: REPORT_STATUS.FAILED }).catch(() => {});
    console.error("[Report] Generation failed:", err.message);
    return next(new AppError("Could not build this report from your data yet. Take a scored test and try again.", 422));
  }

  return sendSuccess(res, 201, "Report generated.", {
    reportId:    report._id,
    status:      report.status,
    fileName:    report.fileName,
    fileSize:    report.fileSize,
    downloadUrl: `/api/v1/reports/${report._id}/download`,
  });
});

// ─── Download Report ──────────────────────────────────────────────────────────

exports.downloadReport = asyncHandler(async (req, res, next) => {
  const isAdmin =
    req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;

  const report = await Report.findOne({
    _id: req.params.reportId,
    ...(isAdmin ? {} : { owner: req.user.id }),
  }).select("+fileBuffer");
  if (!report) return next(new AppError("Report not found.", 404));

  let buffer = report.fileBuffer;
  let fileName = report.fileName;

  // Regenerate on demand if the stored bytes are missing (older report, or a
  // prior generation failed) or the caller wants a fresh copy.
  if (!buffer || !buffer.length || req.query.fresh === "true") {
    try {
      ({ buffer, fileName } = await buildAndPersistReport(report));
    } catch (err) {
      await Report.findByIdAndUpdate(report._id, { status: REPORT_STATUS.FAILED }).catch(() => {});
      console.error("[Report] Download regeneration failed:", err.message);
      return next(new AppError("Failed to generate report. Please try again.", 500));
    }
  }

  const ext = report.format === "pdf" ? "pdf" : "xlsx";
  const filename = fileName || `Exam-Neeti_Report_${report._id}.${ext}`;

  res.setHeader("Content-Type", CONTENT_TYPE[report.format] || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.send(buffer);
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
    fileName:    report.fileName,
    generatedAt: report.generatedAt,
    fileSize:    report.fileSize,
  });
});
