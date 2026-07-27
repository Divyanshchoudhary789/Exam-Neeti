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
    User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
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
