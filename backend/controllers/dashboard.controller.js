/**
 * Management Dashboard Controller — Module 4
 * Admin + super_admin only. Returns cohort-level aggregated metrics.
 */

const mongoose = require("mongoose");
const AnalyticsResult = require("../models/AnalyticsResult.model");
const AdvancedAnalytics = require("../models/AdvancedAnalytics.model");
const Attempt = require("../models/Attempt.model");
const Exam = require("../models/Exam.model");
const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
const Sprint = require("../models/Sprint.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { ROLES, ATTEMPT_STATUS } = require("../config/constants");
const { getCoverageMetrics } = require("../services/coverage.service");
const { buildStudentReportPDF } = require("../services/studentReport.service");

/** Safe ObjectId cast — returns null on invalid input instead of throwing */
const toObjectId = (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

// ─── Sprint-wide overview ─────────────────────────────────────────────────────

exports.getSprintOverview = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const sprint = await Sprint.findById(sprintOid).lean();
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  const assignedBatchIds = await Exam.distinct("batch", { sprint: sprintOid });

  const [totalStudents, totalExams, totalAttempts, analyticsResults] = await Promise.all([
    // Count only students in batches that have exams in this sprint, not all platform students
    User.countDocuments({ role: ROLES.STUDENT, isActive: true, batch: { $in: assignedBatchIds } }),
    Exam.countDocuments({ sprint: sprintOid }),
    Attempt.countDocuments({ sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED }),
    AnalyticsResult.find({ sprint: sprintOid }).lean(),
  ]);

  if (!analyticsResults.length) {
    return sendSuccess(res, 200, "Sprint overview fetched (no data yet).", {
      sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
      totalStudents, totalExams, totalAttempts, totalBatches: assignedBatchIds.length,
      averageScore: 0, averageAccuracy: 0, averageAttemptRate: 0, averagePercentage: 0,
    });
  }

  const avg = (key) => {
    const vals = analyticsResults.map((a) => a[key] || 0);
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
  };

  return sendSuccess(res, 200, "Sprint overview fetched.", {
    sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
    totalStudents, totalExams, totalAttempts, totalBatches: assignedBatchIds.length,
    averageScore:       avg("score"),
    averageAccuracy:    avg("overallAccuracy"),
    averageAttemptRate: avg("overallAttemptRate"),
    averagePercentage:  avg("percentage"),
  });
});

// ─── Batch-wise overview ──────────────────────────────────────────────────────

exports.getBatchOverview = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const batches = await Batch.find({ isActive: true }).lean();
  if (!batches.length) {
    return sendSuccess(res, 200, "No batches found.", { batches: [] });
  }

  // Single aggregation instead of N+1 per-batch queries
  const [allAnalytics, allAttemptCounts, allStudentCounts] = await Promise.all([
    AnalyticsResult.aggregate([
      { $match: { sprint: sprintOid } },
      {
        $group: {
          _id:             "$batch",
          averageScore:    { $avg: "$score" },
          averageAccuracy: { $avg: "$overallAccuracy" },
          averagePercentage: { $avg: "$percentage" },
          averageAttemptRate: { $avg: "$overallAttemptRate" },
        },
      },
    ]),
    Attempt.aggregate([
      { $match: { sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED } },
      { $group: { _id: "$batch", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: ROLES.STUDENT, isActive: true } },
      { $group: { _id: "$batch", count: { $sum: 1 } } },
    ]),
  ]);

  const analyticsMap    = Object.fromEntries(allAnalytics.map((a) => [a._id.toString(), a]));
  const attemptMap      = Object.fromEntries(allAttemptCounts.map((a) => [a._id.toString(), a.count]));
  const studentCountMap = Object.fromEntries(allStudentCounts.map((a) => [a._id.toString(), a.count]));

  const batchStats = batches.map((batch) => {
    const id   = batch._id.toString();
    const agg  = analyticsMap[id] || {};
    const round = (v) => (v != null ? parseFloat(v.toFixed(2)) : 0);
    return {
      batchId:            batch._id,
      batchName:          batch.name,
      studentCount:       studentCountMap[id]  || 0,
      attemptCount:       attemptMap[id]        || 0,
      averageScore:       round(agg.averageScore),
      averageAccuracy:    round(agg.averageAccuracy),
      averagePercentage:  round(agg.averagePercentage),
      averageAttemptRate: round(agg.averageAttemptRate),
    };
  });

  return sendSuccess(res, 200, "Batch overview fetched.", { batches: batchStats });
});

// ─── Student rankings within a sprint ────────────────────────────────────────

exports.getStudentRankings = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;
  const { batchId, limit } = req.query;

  const matchStage = {};
  if (sprintId && sprintId !== "all" && sprintId !== "overall") {
    const sprintOid = toObjectId(sprintId);
    if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));
    matchStage.sprint = sprintOid;
  }

  if (batchId) {
    const batchOid = toObjectId(batchId);
    if (!batchOid) return next(new AppError("Invalid batch ID.", 400));
    matchStage.batch = batchOid;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id:          "$student",
        totalScore:   { $sum: "$score" },
        totalAttempts:{ $sum: 1 },
        avgAccuracy:  { $avg: "$overallAccuracy" },
        avgPercentage:{ $avg: "$percentage" },
        batchId:      { $first: "$batch" },
      },
    },
    { $sort: { totalScore: -1 } },
    { $lookup: { from: "users",   localField: "_id",    foreignField: "_id", as: "studentInfo" } },
    { $unwind: "$studentInfo" },
    { $lookup: { from: "batches", localField: "batchId", foreignField: "_id", as: "batchInfo" } },
    { $unwind: { path: "$batchInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        studentId:    "$_id",
        studentName:  "$studentInfo.name",
        studentEmail: "$studentInfo.email",
        batchName:    "$batchInfo.name",
        totalScore:   1,
        totalAttempts:1,
        avgAccuracy:  { $round: ["$avgAccuracy",   2] },
        avgPercentage:{ $round: ["$avgPercentage", 2] },
      },
    },
  ];

  const limitNum = parseInt(limit, 10);
  if (!isNaN(limitNum) && limitNum > 0) {
    pipeline.push({ $limit: limitNum });
  }

  const rankings = await AnalyticsResult.aggregate(pipeline);

  return sendSuccess(res, 200, "Student rankings fetched.", {
    rankings: rankings.map((s, idx) => ({ rank: idx + 1, ...s })),
  });
});

// ─── Exam-wise performance — single aggregation, no N+1 ──────────────────────

exports.getExamPerformance = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const [exams, examAnalytics] = await Promise.all([
    Exam.find({ sprint: sprintOid })
      .select("_id title examNumber totalMarks batch")
      .populate("batch", "name")
      .sort({ examNumber: 1 })
      .lean(),
    AnalyticsResult.aggregate([
      { $match: { sprint: sprintOid } },
      {
        $group: {
          _id:             "$exam",
          totalAttempts:   { $sum: 1 },
          averageScore:    { $avg: "$score" },
          averageAccuracy: { $avg: "$overallAccuracy" },
          averagePercentage: { $avg: "$percentage" },
          highestScore:    { $max: "$score" },
          lowestScore:     { $min: "$score" },
        },
      },
    ]),
  ]);

  const analyticsMap = Object.fromEntries(examAnalytics.map((a) => [a._id.toString(), a]));
  const round = (v) => (v != null ? parseFloat(v.toFixed(2)) : 0);

  const examStats = exams.map((exam) => {
    const agg = analyticsMap[exam._id.toString()] || {};
    return {
      examId:           exam._id,
      examTitle:        exam.title,
      examNumber:       exam.examNumber,
      totalMarks:       exam.totalMarks,
      batchName:        exam.batch?.name,
      totalAttempts:    agg.totalAttempts    || 0,
      averageScore:     round(agg.averageScore),
      averageAccuracy:  round(agg.averageAccuracy),
      averagePercentage:round(agg.averagePercentage),
      highestScore:     agg.highestScore     || 0,
      lowestScore:      agg.lowestScore      || 0,
    };
  });

  return sendSuccess(res, 200, "Exam performance fetched.", { exams: examStats });
});

// ─── Subject performance across the sprint ────────────────────────────────────

exports.getSubjectPerformance = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;
  const { batchId }  = req.query;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const matchFilter = { sprint: sprintOid };
  if (batchId) {
    const batchOid = toObjectId(batchId);
    if (!batchOid) return next(new AppError("Invalid batch ID.", 400));
    matchFilter.batch = batchOid;
  }

  const results = await AnalyticsResult.find(matchFilter).lean();
  if (!results.length) return sendSuccess(res, 200, "No data available.", { subjects: [] });

  const subjectAgg = {};
  for (const ar of results) {
    for (const s of ar.subjectAccuracy) {
      if (!subjectAgg[s.subject]) {
        subjectAgg[s.subject] = { subject: s.subject, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, negativeMarks: 0 };
      }
      const agg = subjectAgg[s.subject];
      agg.totalQuestions += s.totalQuestions || 0;
      agg.attempted      += s.attempted      || 0;
      agg.correct        += s.correct        || 0;
      agg.incorrect      += s.incorrect      || 0;
      agg.negativeMarks  += s.negativeMarks  || 0;
    }
  }

  const subjects = Object.values(subjectAgg).map((s) => ({
    ...s,
    accuracy:    parseFloat(((s.correct   / Math.max(s.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((s.attempted / Math.max(s.totalQuestions, 1)) * 100).toFixed(2)),
  }));

  return sendSuccess(res, 200, "Subject performance fetched.", { subjects });
});

// ─── Analytics summary ───────────────────────────────────────────────────────

exports.getAnalyticsSummary = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const [totalStudents, activeStudents, totalBatches, totalExams, totalAttempts, analyticsCount] =
    await Promise.all([
      User.countDocuments({ role: ROLES.STUDENT }),
      User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
      Batch.countDocuments({ isActive: true }),
      Exam.countDocuments({ sprint: sprintOid }),
      Attempt.countDocuments({ sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED }),
      AnalyticsResult.countDocuments({ sprint: sprintOid }),
    ]);

  return sendSuccess(res, 200, "Analytics summary fetched.", {
    totalStudents, activeStudents, totalBatches, totalExams, totalAttempts,
    analyticsComputed: analyticsCount,
  });
});

// ─── Admin: Chapter & topic cohort breakdown for a sprint ─────────────────────
// Shows which chapters/topics are weak across the entire cohort — helps admin
// identify where students are struggling the most.

exports.getChapterTopicBreakdown = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;
  const { batchId }  = req.query;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const matchFilter = { sprint: sprintOid };
  if (batchId) {
    const batchOid = toObjectId(batchId);
    if (!batchOid) return next(new AppError("Invalid batch ID.", 400));
    matchFilter.batch = batchOid;
  }

  const results = await AnalyticsResult.find(matchFilter)
    .select("chapterAccuracy topicAccuracy")
    .lean();

  if (!results.length) {
    return sendSuccess(res, 200, "No data available yet.", { chapters: [], topics: [] });
  }

  // ── Aggregate chapters ────────────────────────────────────────────────────
  const chapterAgg = {};
  for (const ar of results) {
    for (const c of ar.chapterAccuracy) {
      const key = `${c.subject}__${c.chapter}`;
      if (!chapterAgg[key]) {
        chapterAgg[key] = {
          subject: c.subject, chapter: c.chapter,
          totalQuestions: 0, attempted: 0, correct: 0,
          incorrect: 0, negativeMarks: 0, marksObtained: 0,
          studentCount: 0,
        };
      }
      const agg = chapterAgg[key];
      agg.totalQuestions += c.totalQuestions || 0;
      agg.attempted      += c.attempted      || 0;
      agg.correct        += c.correct        || 0;
      agg.incorrect      += c.incorrect      || 0;
      agg.negativeMarks  += c.negativeMarks  || 0;
      agg.marksObtained  += c.marksObtained  || 0;
      agg.studentCount   += 1;
    }
  }

  const chapters = Object.values(chapterAgg).map((c) => ({
    ...c,
    accuracy:    parseFloat(((c.correct   / Math.max(c.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((c.attempted / Math.max(c.totalQuestions, 1)) * 100).toFixed(2)),
  })).sort((a, b) => a.accuracy - b.accuracy); // weakest first

  // ── Aggregate topics ──────────────────────────────────────────────────────
  const topicAgg = {};
  for (const ar of results) {
    for (const t of ar.topicAccuracy) {
      const key = `${t.subject}__${t.chapter}__${t.topic}`;
      if (!topicAgg[key]) {
        topicAgg[key] = {
          subject: t.subject, chapter: t.chapter, topic: t.topic,
          totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0,
          studentCount: 0,
        };
      }
      const agg = topicAgg[key];
      agg.totalQuestions += t.totalQuestions || 0;
      agg.attempted      += t.attempted      || 0;
      agg.correct        += t.correct        || 0;
      agg.incorrect      += (t.incorrect     || (t.attempted - t.correct) || 0);
      agg.studentCount   += 1;
    }
  }

  const topics = Object.values(topicAgg).map((t) => ({
    ...t,
    accuracy:    parseFloat(((t.correct   / Math.max(t.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((t.attempted / Math.max(t.totalQuestions, 1)) * 100).toFixed(2)),
  })).sort((a, b) => a.accuracy - b.accuracy); // weakest first

  return sendSuccess(res, 200, "Chapter & topic breakdown fetched.", { chapters, topics });
});

// ─── Admin: Student list with attempt status for a sprint ─────────────────────
// Shows every active student in a batch — whether they have attempted, are
// in-progress, or have not started. Useful for attendance/compliance tracking.

exports.getStudentAttemptStatus = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;
  const { batchId, examId } = req.query;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  // Build student filter
  const studentFilter = { role: ROLES.STUDENT, isActive: true };
  if (batchId) {
    const batchOid = toObjectId(batchId);
    if (!batchOid) return next(new AppError("Invalid batch ID.", 400));
    studentFilter.batch = batchOid;
  }

  // Build attempt filter
  const attemptFilter = { sprint: sprintOid };
  if (batchId) attemptFilter.batch = toObjectId(batchId);
  if (examId) {
    const examOid = toObjectId(examId);
    if (!examOid) return next(new AppError("Invalid exam ID.", 400));
    attemptFilter.exam = examOid;
  }

  const [students, attempts] = await Promise.all([
    User.find(studentFilter)
      .select("_id name email batch")
      .populate("batch", "name")
      .sort({ name: 1 })
      .lean(),
    Attempt.find(attemptFilter)
      .select("student exam status score percentage submittedAt startedAt analyticsComputed")
      .lean(),
  ]);

  // Map: studentId → their attempts (could be multiple exams)
  const attemptMap = {};
  for (const a of attempts) {
    const sid = a.student.toString();
    if (!attemptMap[sid]) attemptMap[sid] = [];
    attemptMap[sid].push(a);
  }

  const studentStatuses = students.map((student) => {
    const studentAttempts = attemptMap[student._id.toString()] || [];
    const submitted = studentAttempts.filter((a) => a.status === ATTEMPT_STATUS.SUBMITTED);
    const inProgress = studentAttempts.filter((a) => a.status === ATTEMPT_STATUS.IN_PROGRESS);

    return {
      studentId:        student._id,
      name:             student.name,
      email:            student.email,
      batch:            student.batch,
      totalAttempted:   submitted.length,
      inProgress:       inProgress.length,
      notStarted:       examId ? (studentAttempts.length === 0 ? 1 : 0) : null,
      analyticsReady:   submitted.filter((a) => a.analyticsComputed).length,
      lastSubmittedAt:  submitted.length
        ? submitted.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0].submittedAt
        : null,
      attempts:         submitted.map((a) => ({
        attemptId:    a._id,
        examId:       a.exam,
        score:        a.score,
        percentage:   a.percentage,
        submittedAt:  a.submittedAt,
        analyticsComputed: a.analyticsComputed,
      })),
    };
  });

  // Summary counts
  const summary = {
    totalStudents:  students.length,
    submitted:      studentStatuses.filter((s) => s.totalAttempted > 0).length,
    inProgress:     studentStatuses.filter((s) => s.inProgress > 0).length,
    notStarted:     studentStatuses.filter((s) => s.totalAttempted === 0 && s.inProgress === 0).length,
    analyticsReady: studentStatuses.filter((s) => s.analyticsReady > 0).length,
  };

  return sendSuccess(res, 200, "Student attempt statuses fetched.", {
    summary,
    students: studentStatuses,
  });
});

// ─── Admin: Full attempt history for a single student ─────────────────────────
// Returns all submitted attempts for one student across a sprint — useful for
// tracking individual progress over multiple exams.

exports.getStudentAttemptHistory = asyncHandler(async (req, res, next) => {
  const { sprintId, studentId } = req.params;

  const isAllSprints = !sprintId || sprintId === "all" || sprintId === "overall";
  const sprintOid  = isAllSprints ? null : toObjectId(sprintId);
  const studentOid = toObjectId(studentId);
  if (!isAllSprints && !sprintOid) return next(new AppError("Invalid sprint ID.", 400));
  if (!studentOid) return next(new AppError("Invalid student ID.", 400));

  const student = await User.findOne({ _id: studentOid, role: ROLES.STUDENT })
    .select("name email batch")
    .populate("batch", "name")
    .lean();

  if (!student) return next(new AppError("Student not found.", 404));

  const attemptQuery = { student: studentOid, status: ATTEMPT_STATUS.SUBMITTED };
  const analyticsQuery = { student: studentOid };
  if (sprintOid) {
    attemptQuery.sprint = sprintOid;
    analyticsQuery.sprint = sprintOid;
  }

  const [attempts, analytics] = await Promise.all([
    Attempt.find(attemptQuery)
      .populate("exam", "title examNumber totalMarks durationMinutes")
      .populate("sprint", "name sprintNumber")
      .select("-responses")               // responses too heavy for list view
      .sort({ submittedAt: 1 })
      .lean(),
    AnalyticsResult.find(analyticsQuery)
      .select("attempt score percentage overallAccuracy overallAttemptRate totalNegativeMarks recoverableMarks computedAt")
      .lean(),
  ]);

  // Map analyticsResult by attemptId for quick join
  const analyticsMap = {};
  for (const a of analytics) {
    analyticsMap[a.attempt.toString()] = a;
  }

  const history = attempts.map((attempt, idx) => {
    const ar = analyticsMap[attempt._id.toString()];
    return {
      attemptNumber:    idx + 1,
      attemptId:        attempt._id,
      exam:             attempt.exam,
      sprint:           attempt.sprint,
      score:            attempt.score,
      totalMarks:       attempt.totalMarks,
      percentage:       attempt.percentage,
      submittedAt:      attempt.submittedAt,
      startedAt:        attempt.startedAt,
      totalTimeSeconds: attempt.totalTimeSeconds,
      analyticsComputed: attempt.analyticsComputed,
      analytics: ar
        ? {
            overallAccuracy:    ar.overallAccuracy,
            overallAttemptRate: ar.overallAttemptRate,
            totalNegativeMarks: ar.totalNegativeMarks,
            totalRecoverable:   ar.recoverableMarks?.totalRecoverable || 0,
            computedAt:         ar.computedAt,
          }
        : null,
      // Trend — improvement from previous exam
      improvementFromPrev: idx > 0
        ? parseFloat((attempt.score - attempts[idx - 1].score).toFixed(2))
        : 0,
    };
  });

  // Overall trend summary
  const scores = attempts.map((a) => a.score);
  const summary = attempts.length
    ? {
        totalExams:     attempts.length,
        totalScore:     parseFloat(scores.reduce((s, v) => s + v, 0).toFixed(2)),
        highestScore:   Math.max(...scores),
        lowestScore:    Math.min(...scores),
        averageScore:   parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)),
        averagePercentage: parseFloat(
          (attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length).toFixed(2)
        ),
        trend: scores.length > 1
          ? parseFloat((scores[scores.length - 1] - scores[0]).toFixed(2))
          : 0,
      }
    : null;

  return sendSuccess(res, 200, "Student attempt history fetched.", {
    student,
    summary,
    history,
  });
});

// ─── Full student performance profile (admin inspector) ──────────────────────
// One endpoint that powers the "Student Performance Profile" modal in the
// admin / super-admin Students tab. Unlike getStudentSprintSummary (single
// sprint, student-facing) this defaults to the student's ENTIRE history across
// every sprint and also returns a per-sprint rollup so the modal's scope
// selector can drill into any one sprint. Pass ?sprintId=<id> to scope it.

async function assembleStudentPerformanceProfile(student, studentOid, scopedSprintOid) {
  const round = (v) => parseFloat(Number(v || 0).toFixed(2));
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const stdDev = (arr) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
  };

  const analyticsQuery = { student: studentOid };
  if (scopedSprintOid) analyticsQuery.sprint = scopedSprintOid;

  const allAnalytics = await AnalyticsResult.find(analyticsQuery)
    .populate("exam", "title examNumber totalMarks")
    .populate("sprint", "name sprintNumber")
    .populate("attempt", "attemptNumber status submittedAt")
    .sort({ computedAt: 1 })
    .limit(1000)
    .lean();

  const emptyProfile = {
    student,
    scope: scopedSprintOid ? String(scopedSprintOid) : "all",
    summary: null,
    sprints: [],
    subjectPerformance: [],
    chapterPerformance: [],
    topicPerformance: { weak: [], strong: [] },
    difficultyPerformance: [],
    errorAnalysis: { silly: 0, concept: 0, guess: 0, total: 0 },
    coverage: null,
    timeline: [],
  };

  if (!allAnalytics.length) return emptyProfile;

  // Dedupe to the latest attempt per exam for every aggregate (a weaker first
  // attempt must not drag down a stronger reattempt or be double-counted).
  const latestByExam = new Map();
  for (const ar of allAnalytics) {
    const examId = String(ar.exam?._id || ar.exam || "");
    if (!examId) continue;
    const existing = latestByExam.get(examId);
    if (!existing) { latestByExam.set(examId, ar); continue; }
    const arNum = ar.attempt?.attemptNumber || 1;
    const exNum = existing.attempt?.attemptNumber || 1;
    if (arNum > exNum || (arNum === exNum && new Date(ar.computedAt) > new Date(existing.computedAt))) {
      latestByExam.set(examId, ar);
    }
  }
  const deduped = Array.from(latestByExam.values());

  // ── Overall summary ──────────────────────────────────────────────────────
  const scores      = deduped.map((a) => a.score || 0);
  const percentages = deduped.map((a) => a.percentage || 0);
  const accuracies  = deduped.map((a) => a.overallAccuracy || 0);
  const attemptRates = deduped.map((a) => a.overallAttemptRate || 0);
  const totalNegative    = round(deduped.reduce((s, a) => s + (a.totalNegativeMarks || 0), 0));
  const totalRecoverable = round(deduped.reduce((s, a) => s + (a.recoverableMarks?.totalRecoverable || 0), 0));
  const accStd = round(stdDev(accuracies));

  const attemptDates = allAnalytics
    .map((a) => a.attempt?.submittedAt || a.computedAt)
    .filter(Boolean)
    .map((d) => new Date(d))
    .sort((a, b) => a - b);

  const summary = {
    totalTests:        deduped.length,
    totalAttempts:     allAnalytics.length,
    totalScore:        round(scores.reduce((s, v) => s + v, 0)),
    averageScore:      round(mean(scores)),
    highestScore:      Math.max(...scores),
    lowestScore:       Math.min(...scores),
    averagePercentage: round(mean(percentages)),
    averageAccuracy:   round(mean(accuracies)),
    averageAttemptRate: round(mean(attemptRates)),
    totalNegativeMarks: totalNegative,
    totalRecoverableMarks: totalRecoverable,
    consistency: {
      scoreStdDev: round(stdDev(scores)),
      accuracyStdDev: accStd,
      interpretation:
        deduped.length < 2 ? "insufficient_data" :
        accStd <= 5  ? "very_consistent" :
        accStd <= 12 ? "consistent" :
        accStd <= 20 ? "variable" : "highly_variable",
    },
    firstAttemptAt: attemptDates[0] || null,
    lastAttemptAt:  attemptDates[attemptDates.length - 1] || null,
  };

  // ── Per-sprint rollup (from the deduped set — spans every sprint when
  //    unscoped, or just the one sprint when ?sprintId= is passed) ──────────
  const sprintAgg = {};
  for (const ar of deduped) {
    const sid = String(ar.sprint?._id || ar.sprint || "unknown");
    if (!sprintAgg[sid]) {
      sprintAgg[sid] = {
        sprintId: sid,
        name: ar.sprint?.name || "Sprint",
        sprintNumber: ar.sprint?.sprintNumber || null,
        tests: 0, scoreSum: 0, pctSum: 0, accSum: 0,
        negative: 0, recoverable: 0, lastAttemptAt: null,
      };
    }
    const g = sprintAgg[sid];
    g.tests += 1;
    g.scoreSum += ar.score || 0;
    g.pctSum += ar.percentage || 0;
    g.accSum += ar.overallAccuracy || 0;
    g.negative += ar.totalNegativeMarks || 0;
    g.recoverable += ar.recoverableMarks?.totalRecoverable || 0;
    const at = ar.attempt?.submittedAt || ar.computedAt;
    if (at && (!g.lastAttemptAt || new Date(at) > new Date(g.lastAttemptAt))) g.lastAttemptAt = at;
  }
  const sprints = Object.values(sprintAgg)
    .map((g) => ({
      sprintId: g.sprintId,
      name: g.name,
      sprintNumber: g.sprintNumber,
      tests: g.tests,
      averageScore: round(g.scoreSum / g.tests),
      averagePercentage: round(g.pctSum / g.tests),
      averageAccuracy: round(g.accSum / g.tests),
      totalNegativeMarks: round(g.negative),
      totalRecoverableMarks: round(g.recoverable),
      lastAttemptAt: g.lastAttemptAt,
    }))
    .sort((a, b) => new Date(b.lastAttemptAt || 0) - new Date(a.lastAttemptAt || 0));

  // ── Subject aggregates ───────────────────────────────────────────────────
  const subjectAgg = {};
  for (const ar of deduped) {
    for (const s of ar.subjectAccuracy || []) {
      if (!subjectAgg[s.subject]) {
        subjectAgg[s.subject] = { subject: s.subject, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0, negativeMarks: 0 };
      }
      const g = subjectAgg[s.subject];
      g.totalQuestions += s.totalQuestions || 0;
      g.attempted      += s.attempted      || 0;
      g.correct        += s.correct        || 0;
      g.incorrect      += s.incorrect      || 0;
      g.marksObtained  += s.marksObtained  || 0;
      g.negativeMarks  += s.negativeMarks  || 0;
    }
  }
  const subjectPerformance = Object.values(subjectAgg).map((s) => ({
    ...s,
    marksObtained: round(s.marksObtained),
    negativeMarks: round(s.negativeMarks),
    accuracy:    round((s.correct   / Math.max(s.attempted,      1)) * 100),
    attemptRate: round((s.attempted / Math.max(s.totalQuestions, 1)) * 100),
  })).sort((a, b) => b.totalQuestions - a.totalQuestions);

  // ── Chapter aggregates ───────────────────────────────────────────────────
  const chapterAgg = {};
  for (const ar of deduped) {
    for (const c of ar.chapterAccuracy || []) {
      const key = `${c.subject}__${c.chapter}`;
      if (!chapterAgg[key]) {
        chapterAgg[key] = { subject: c.subject, chapter: c.chapter, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0 };
      }
      const g = chapterAgg[key];
      g.totalQuestions += c.totalQuestions || 0;
      g.attempted      += c.attempted      || 0;
      g.correct        += c.correct        || 0;
      g.incorrect      += c.incorrect      || 0;
    }
  }
  const chapterPerformance = Object.values(chapterAgg).map((c) => ({
    ...c,
    accuracy:    round((c.correct   / Math.max(c.attempted,      1)) * 100),
    attemptRate: round((c.attempted / Math.max(c.totalQuestions, 1)) * 100),
  })).sort((a, b) => a.accuracy - b.accuracy);

  // ── Topic aggregates → weak / strong ─────────────────────────────────────
  const WEAK = 40;
  const STRONG = 80;
  const topicAgg = {};
  for (const ar of deduped) {
    for (const t of ar.topicAccuracy || []) {
      const key = `${t.subject}__${t.chapter}__${t.topic}`;
      if (!topicAgg[key]) {
        topicAgg[key] = { subject: t.subject, chapter: t.chapter, topic: t.topic, totalQuestions: 0, attempted: 0, correct: 0 };
      }
      topicAgg[key].totalQuestions += t.totalQuestions || 0;
      topicAgg[key].attempted      += t.attempted      || 0;
      topicAgg[key].correct        += t.correct        || 0;
    }
  }
  const topics = Object.values(topicAgg).map((t) => ({
    ...t,
    accuracy:    round((t.correct   / Math.max(t.attempted,      1)) * 100),
    attemptRate: round((t.attempted / Math.max(t.totalQuestions, 1)) * 100),
  }));
  const topicPerformance = {
    weak:   topics.filter((t) => t.attempted > 0 && t.accuracy <  WEAK).sort((a, b) => a.accuracy - b.accuracy),
    strong: topics.filter((t) => t.attempted > 0 && t.accuracy >= STRONG).sort((a, b) => b.accuracy - a.accuracy),
  };

  // ── Difficulty aggregates ────────────────────────────────────────────────
  const diffAgg = {};
  for (const ar of deduped) {
    for (const d of ar.difficultySummary || []) {
      if (!diffAgg[d.difficulty]) {
        diffAgg[d.difficulty] = { difficulty: d.difficulty, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, unattempted: 0, totalTimeSeconds: 0 };
      }
      const g = diffAgg[d.difficulty];
      g.totalQuestions   += d.totalQuestions   || 0;
      g.attempted        += d.attempted        || 0;
      g.correct          += d.correct          || 0;
      g.incorrect        += d.incorrect        || 0;
      g.unattempted      += d.unattempted      || 0;
      g.totalTimeSeconds += d.totalTimeSeconds || 0;
    }
  }
  const difficultyPerformance = Object.values(diffAgg).map((d) => ({
    ...d,
    accuracy:       round((d.correct   / Math.max(d.attempted,      1)) * 100),
    attemptRate:    round((d.attempted / Math.max(d.totalQuestions, 1)) * 100),
    avgTimeSeconds: round(d.totalTimeSeconds / Math.max(d.attempted, 1)),
  }));

  // ── Error analysis (silly / concept from AdvancedAnalytics, guess from AR) ─
  const dedupedAttemptIds = deduped.map((ar) => ar.attempt?._id || ar.attempt).filter(Boolean);
  const advancedRows = dedupedAttemptIds.length
    ? await AdvancedAnalytics.find({ attempt: { $in: dedupedAttemptIds } }).select("errorClassification").lean()
    : [];
  const errorAnalysis = advancedRows.reduce(
    (acc, row) => {
      acc.silly   += row.errorClassification?.sillyMistakes || 0;
      acc.concept += row.errorClassification?.conceptErrors || 0;
      return acc;
    },
    { silly: 0, concept: 0, guess: 0, total: 0 }
  );
  errorAnalysis.guess = deduped.reduce((s, ar) => s + (ar.totalGuessAttempts || 0), 0);
  errorAnalysis.total = errorAnalysis.silly + errorAnalysis.concept + errorAnalysis.guess;

  // ── Coverage (per-sprint when scoped, union-of-all otherwise) ────────────
  let coverage = null;
  try {
    coverage = await getCoverageMetrics(studentOid, scopedSprintOid ? String(scopedSprintOid) : "all");
  } catch (_) { /* coverage is best-effort */ }

  // ── Timeline — every attempt, chronological ──────────────────────────────
  const timeline = allAnalytics.map((ar, idx) => ({
    attemptId:        ar.attempt?._id || ar.attempt || null,
    examId:           ar.exam?._id || null,
    examTitle:        ar.exam?.title || `Exam ${ar.exam?.examNumber || idx + 1}`,
    examNumber:       ar.exam?.examNumber || null,
    sprintId:         String(ar.sprint?._id || ar.sprint || ""),
    sprintName:       ar.sprint?.name || "",
    attemptNumber:    ar.attempt?.attemptNumber || 1,
    attemptedAt:      ar.attempt?.submittedAt || ar.computedAt,
    score:            round(ar.score),
    totalMarks:       ar.totalMarks || ar.exam?.totalMarks || 720,
    percentage:       round(ar.percentage),
    accuracy:         round(ar.overallAccuracy),
    attemptRate:      round(ar.overallAttemptRate),
    negativeMarks:    round(ar.totalNegativeMarks),
    recoverableMarks: round(ar.recoverableMarks?.totalRecoverable || 0),
    improvementFromPrev: idx > 0 ? round((ar.score || 0) - (allAnalytics[idx - 1].score || 0)) : 0,
  }));

  return {
    student,
    scope: scopedSprintOid ? String(scopedSprintOid) : "all",
    summary,
    sprints,
    subjectPerformance,
    chapterPerformance,
    topicPerformance,
    difficultyPerformance,
    errorAnalysis,
    coverage,
    timeline,
  };
}

/** Shared prelude for both the JSON and the PDF endpoints. */
async function resolveStudentAndScope(req, next) {
  const { studentId } = req.params;
  const { sprintId } = req.query;

  const studentOid = toObjectId(studentId);
  if (!studentOid) { next(new AppError("Invalid student ID.", 400)); return null; }

  const scoped = sprintId && sprintId !== "all" && sprintId !== "overall";
  const scopedSprintOid = scoped ? toObjectId(sprintId) : null;
  if (scoped && !scopedSprintOid) { next(new AppError("Invalid sprint ID.", 400)); return null; }

  const student = await User.findOne({ _id: studentOid, role: ROLES.STUDENT })
    .select("name email batch createdAt isActive programType")
    .populate("batch", "name")
    .lean();
  if (!student) { next(new AppError("Student not found.", 404)); return null; }

  return { student, studentOid, scopedSprintOid };
}

exports.getStudentPerformanceProfile = asyncHandler(async (req, res, next) => {
  const ctx = await resolveStudentAndScope(req, next);
  if (!ctx) return;

  const profile = await assembleStudentPerformanceProfile(ctx.student, ctx.studentOid, ctx.scopedSprintOid);
  return sendSuccess(
    res, 200,
    profile.summary ? "Student performance profile fetched." : "No analytics for this student yet.",
    profile
  );
});

// ─── Download the same profile as a branded PDF ──────────────────────────────

exports.downloadStudentPerformanceReport = asyncHandler(async (req, res, next) => {
  const ctx = await resolveStudentAndScope(req, next);
  if (!ctx) return;

  const profile = await assembleStudentPerformanceProfile(ctx.student, ctx.studentOid, ctx.scopedSprintOid);

  const scopeLabel = ctx.scopedSprintOid
    ? (profile.sprints[0]?.name || "Selected sprint")
    : "All sprints";

  const { buffer, filename } = await buildStudentReportPDF(profile, scopeLabel);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.end(buffer);
});
