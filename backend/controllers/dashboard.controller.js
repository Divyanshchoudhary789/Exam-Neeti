/**
 * Management Dashboard Controller — Module 4
 * Admin + super_admin only. Returns cohort-level aggregated metrics.
 */

const mongoose = require("mongoose");
const AnalyticsResult = require("../models/AnalyticsResult.model");
const Attempt = require("../models/Attempt.model");
const Exam = require("../models/Exam.model");
const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
const Sprint = require("../models/Sprint.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { ROLES, ATTEMPT_STATUS } = require("../config/constants");

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

  const [totalStudents, totalExams, totalAttempts, analyticsResults] = await Promise.all([
    // FIX: Count only students in batches that have exams in this sprint, not all platform students
    Exam.distinct("batch", { sprint: sprintOid }).then((batchIds) =>
      User.countDocuments({ role: ROLES.STUDENT, isActive: true, batch: { $in: batchIds } })
    ),
    Exam.countDocuments({ sprint: sprintOid }),
    Attempt.countDocuments({ sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED }),
    AnalyticsResult.find({ sprint: sprintOid }).lean(),
  ]);

  if (!analyticsResults.length) {
    return sendSuccess(res, 200, "Sprint overview fetched (no data yet).", {
      sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
      totalStudents, totalExams, totalAttempts,
      averageScore: 0, averageAccuracy: 0, averageAttemptRate: 0, averagePercentage: 0,
    });
  }

  const avg = (key) => {
    const vals = analyticsResults.map((a) => a[key] || 0);
    return parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
  };

  return sendSuccess(res, 200, "Sprint overview fetched.", {
    sprint: { _id: sprint._id, name: sprint.name, status: sprint.status },
    totalStudents, totalExams, totalAttempts,
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
  const { batchId } = req.query;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const matchStage = { sprint: sprintOid };
  if (batchId) {
    const batchOid = toObjectId(batchId);
    if (!batchOid) return next(new AppError("Invalid batch ID.", 400));
    matchStage.batch = batchOid;
  }

  const rankings = await AnalyticsResult.aggregate([
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
  ]);

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

  const sprintOid  = toObjectId(sprintId);
  const studentOid = toObjectId(studentId);
  if (!sprintOid)  return next(new AppError("Invalid sprint ID.", 400));
  if (!studentOid) return next(new AppError("Invalid student ID.", 400));

  const student = await User.findOne({ _id: studentOid, role: ROLES.STUDENT })
    .select("name email batch")
    .populate("batch", "name")
    .lean();

  if (!student) return next(new AppError("Student not found.", 404));

  const [attempts, analytics] = await Promise.all([
    Attempt.find({ student: studentOid, sprint: sprintOid, status: ATTEMPT_STATUS.SUBMITTED })
      .populate("exam", "title examNumber totalMarks durationMinutes")
      .select("-responses")               // responses too heavy for list view
      .sort({ submittedAt: 1 })
      .lean(),
    AnalyticsResult.find({ student: studentOid, sprint: sprintOid })
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
