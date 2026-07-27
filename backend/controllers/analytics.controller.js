const AnalyticsResult = require("../models/AnalyticsResult.model");
const AdvancedAnalytics = require("../models/AdvancedAnalytics.model");
const Attempt = require("../models/Attempt.model");
const FormulaConfig = require("../models/FormulaConfig.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { computeAnalytics, computeCompleteAnalytics } = require("../services/analytics.service");
const { computeAdvancedAnalytics } = require("../services/advancedAnalytics.service");
const { ROLES, ATTEMPT_STATUS } = require("../config/constants");

// ─── Get analytics for a specific attempt ────────────────────────────────────

exports.getAttemptAnalytics = asyncHandler(async (req, res, next) => {
  const { attemptId } = req.params;

  // Students scoped to own attempts; admins can view any
  const query =
    req.user.role === ROLES.STUDENT
      ? { attempt: attemptId, student: req.user.id }
      : { attempt: attemptId };

  const [analytics, advancedAnalytics] = await Promise.all([
    AnalyticsResult.findOne(query)
      .populate("exam", "title examNumber totalMarks")
      .populate("sprint", "name")
      .lean(),
    // AdvancedAnalytics also scoped to student — cannot guess another's attemptId
    req.user.role === ROLES.STUDENT
      ? AdvancedAnalytics.findOne({ attempt: attemptId, student: req.user.id }).lean()
      : AdvancedAnalytics.findOne({ attempt: attemptId }).lean(),
  ]);

  if (!analytics) {
    return next(new AppError("Analytics not found for this attempt. It may still be computing.", 404));
  }

  return sendSuccess(res, 200, "Attempt analytics fetched.", {
    analytics,
    advancedAnalytics: advancedAnalytics || null,
  });
});

// ─── Get advanced analytics for a specific attempt ───────────────────────────

exports.getAdvancedAttemptAnalytics = asyncHandler(async (req, res, next) => {
  const { attemptId } = req.params;

  // Scope attempt lookup to prevent object reference leaks
  const attemptFilter =
    req.user.role === ROLES.STUDENT
      ? { _id: attemptId, student: req.user.id }
      : { _id: attemptId };

  const attempt = await Attempt.findOne(attemptFilter).lean();
  if (!attempt) return next(new AppError("Attempt not found.", 404));

  const advancedAnalytics =
    req.user.role === ROLES.STUDENT
      ? await AdvancedAnalytics.findOne({ attempt: attemptId, student: req.user.id }).lean()
      : await AdvancedAnalytics.findOne({ attempt: attemptId }).lean();

  if (!advancedAnalytics) {
    return next(new AppError("Advanced analytics not found. They may still be computing.", 404));
  }

  return sendSuccess(res, 200, "Advanced analytics fetched.", { advancedAnalytics });
});

// ─── Student: Get full sprint analytics summary ───────────────────────────────

exports.getStudentSprintSummary = asyncHandler(async (req, res, next) => {
  // When called on /sprint/:sprintId/me  → req.user.id
  // When called on /sprint/:sprintId/student/:studentId → req.params.studentId (admin only — route guarded)
  const studentId = req.user.role === ROLES.STUDENT ? req.user.id : req.params.studentId;
  const { sprintId } = req.params;

  const allAnalytics = await AnalyticsResult.find({ student: studentId, sprint: sprintId })
    .populate("exam", "title examNumber totalMarks scheduledAt")
    .sort({ createdAt: 1 })
    .lean();

  if (!allAnalytics.length) {
    return sendSuccess(res, 200, "No analytics found for this student in this sprint.", {
      summary: null, timeline: [],
    });
  }

  const totalTests    = allAnalytics.length;
  const scores        = allAnalytics.map((a) => a.score);
  const totalScore    = scores.reduce((s, v) => s + v, 0);
  const highestScore  = Math.max(...scores);
  const averageScore  = parseFloat((totalScore / totalTests).toFixed(2));
  const overallPercentage  = parseFloat((allAnalytics.reduce((s, a) => s + a.percentage,       0) / totalTests).toFixed(2));
  const overallAccuracy    = parseFloat((allAnalytics.reduce((s, a) => s + a.overallAccuracy,  0) / totalTests).toFixed(2));
  const overallAttemptRate = parseFloat((allAnalytics.reduce((s, a) => s + a.overallAttemptRate, 0) / totalTests).toFixed(2));

  // Subject aggregates
  const subjectAgg = {};
  for (const ar of allAnalytics) {
    for (const s of ar.subjectAccuracy) {
      if (!subjectAgg[s.subject]) {
        subjectAgg[s.subject] = { subject: s.subject, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0, negativeMarks: 0 };
      }
      const agg = subjectAgg[s.subject];
      agg.totalQuestions += s.totalQuestions || 0;
      agg.attempted      += s.attempted      || 0;
      agg.correct        += s.correct        || 0;
      agg.incorrect      += s.incorrect      || 0;
      agg.marksObtained  += s.marksObtained  || 0;
      agg.negativeMarks  += s.negativeMarks  || 0;
    }
  }

  const subjectPerformance = Object.values(subjectAgg).map((s) => ({
    ...s,
    accuracy:    parseFloat(((s.correct   / Math.max(s.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((s.attempted / Math.max(s.totalQuestions, 1)) * 100).toFixed(2)),
  }));

  // Chapter aggregates
  const chapterAgg = {};
  for (const ar of allAnalytics) {
    for (const c of ar.chapterAccuracy) {
      const key = `${c.subject}__${c.chapter}`;
      if (!chapterAgg[key]) {
        chapterAgg[key] = { subject: c.subject, chapter: c.chapter, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0 };
      }
      const agg = chapterAgg[key];
      agg.totalQuestions += c.totalQuestions || 0;
      agg.attempted      += c.attempted      || 0;
      agg.correct        += c.correct        || 0;
      agg.incorrect      += c.incorrect      || 0;
      agg.marksObtained  += c.marksObtained  || 0;
    }
  }

  const chapterPerformance = Object.values(chapterAgg).map((c) => ({
    ...c,
    accuracy:    parseFloat(((c.correct   / Math.max(c.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((c.attempted / Math.max(c.totalQuestions, 1)) * 100).toFixed(2)),
  }));

  // Topic aggregates — thresholds from FormulaConfig (falls back to defaults)
  let weakThreshold   = 40;
  let strongThreshold = 80;
  try {
    const configs = await FormulaConfig.find({ sprint: sprintId, isActive: true }).lean();
    for (const cfg of configs) {
      if (cfg.params?.weak_topic_accuracy_threshold)   weakThreshold   = parseFloat(cfg.params.weak_topic_accuracy_threshold);
      if (cfg.params?.strong_topic_accuracy_threshold) strongThreshold = parseFloat(cfg.params.strong_topic_accuracy_threshold);
    }
  } catch (_) { /* use defaults */ }

  const topicAgg = {};
  for (const ar of allAnalytics) {
    for (const t of ar.topicAccuracy) {
      const key = `${t.subject}__${t.chapter}__${t.topic}`;
      if (!topicAgg[key]) {
        topicAgg[key] = { subject: t.subject, chapter: t.chapter, topic: t.topic, totalQuestions: 0, attempted: 0, correct: 0 };
      }
      topicAgg[key].totalQuestions += t.totalQuestions || 0;
      topicAgg[key].attempted      += t.attempted      || 0;
      topicAgg[key].correct        += t.correct        || 0;
    }
  }

  const topicPerformance = Object.values(topicAgg).map((t) => {
    const accuracy = parseFloat(((t.correct / Math.max(t.attempted, 1)) * 100).toFixed(2));
    return {
      ...t,
      accuracy,
      isWeak:   t.attempted > 0 && accuracy <  weakThreshold,
      isStrong: t.attempted > 0 && accuracy >= strongThreshold,
    };
  });

  const timeline = allAnalytics.map((ar, idx) => ({
    examId:              ar.exam?._id,
    examTitle:           ar.exam?.title,
    examNumber:          ar.exam?.examNumber,
    attemptedAt:         ar.computedAt,
    score:               ar.score,
    totalMarks:          ar.totalMarks,
    percentage:          ar.percentage,
    accuracy:            ar.overallAccuracy,
    attemptRate:         ar.overallAttemptRate,
    totalNegativeMarks:  ar.totalNegativeMarks,
    totalRecoverable:    ar.recoverableMarks?.totalRecoverable || 0,
    subjectAccuracy:     ar.subjectAccuracy,
    improvementFromPrev: idx > 0 ? parseFloat((ar.score - allAnalytics[idx - 1].score).toFixed(2)) : 0,
  }));

  return sendSuccess(res, 200, "Student sprint summary fetched.", {
    summary: { totalTests, totalScore, highestScore, averageScore, overallAccuracy, overallAttemptRate, overallPercentage },
    subjectPerformance,
    chapterPerformance,
    topicPerformance: {
      all:    topicPerformance,
      weak:   topicPerformance.filter((t) => t.isWeak),
      strong: topicPerformance.filter((t) => t.isStrong),
    },
    timeline,
  });
});

// ─── Get attempt order quality ────────────────────────────────────────────────

exports.getAttemptOrderQuality = asyncHandler(async (req, res, next) => {
  const { attemptId } = req.params;

  const attemptFilter =
    req.user.role === ROLES.STUDENT
      ? { _id: attemptId, student: req.user.id }
      : { _id: attemptId };

  const attempt = await Attempt.findOne(attemptFilter).lean();
  if (!attempt) return next(new AppError("Attempt not found.", 404));

  const advancedAnalytics = await AdvancedAnalytics.findOne(
    { attempt: attemptId },
    { attemptOrderQuality: 1, computedAt: 1 }
  ).lean();

  if (!advancedAnalytics?.attemptOrderQuality) {
    return next(new AppError("Attempt order quality not yet computed for this attempt.", 404));
  }

  return sendSuccess(res, 200, "Attempt order quality fetched.", {
    attemptId,
    attemptOrderQuality: advancedAnalytics.attemptOrderQuality,
    computedAt: advancedAnalytics.computedAt,
  });
});

// ─── Admin: Recompute analytics for an attempt ────────────────────────────────

exports.recomputeAnalytics = asyncHandler(async (req, res, next) => {
  const attempt = await Attempt.findById(req.params.attemptId).lean();
  if (!attempt) return next(new AppError("Attempt not found.", 404));

  if (attempt.status !== ATTEMPT_STATUS.SUBMITTED) {
    return next(new AppError("Can only recompute for submitted attempts.", 400));
  }

  const basicResult    = await computeAnalytics(attempt);
  const advancedResult = await computeAdvancedAnalytics(attempt, basicResult._id);

  return sendSuccess(res, 200, "Analytics recomputed.", {
    analytics:        basicResult,
    advancedAnalytics: advancedResult,
  });
});

// ─── Admin: Upsert formula config ─────────────────────────────────────────────

exports.upsertFormulaConfig = asyncHandler(async (req, res, next) => {
  const { sprintId, metricKey, label, description, params, isActive } = req.body;

  const config = await FormulaConfig.findOneAndUpdate(
    { sprint: sprintId, metricKey },
    { sprint: sprintId, metricKey, label, description, params, isActive, receivedAt: new Date(), updatedBy: req.user.id },
    { upsert: true, new: true, runValidators: true }
  );

  return sendSuccess(res, 200, "Formula config saved.", { config });
});

// ─── Admin: List formula configs for a sprint ─────────────────────────────────

exports.listFormulaConfigs = asyncHandler(async (req, res, next) => {
  const configs = await FormulaConfig.find({ sprint: req.params.sprintId })
    .populate("updatedBy", "name email")
    .sort({ metricKey: 1 })
    .lean();

  return sendSuccess(res, 200, "Formula configs fetched.", { configs });
});
