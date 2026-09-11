const AnalyticsResult = require("../models/AnalyticsResult.model");
const AdvancedAnalytics = require("../models/AdvancedAnalytics.model");
const Attempt = require("../models/Attempt.model");
const FormulaConfig = require("../models/FormulaConfig.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { computeAnalytics } = require("../services/analytics.service");
const { computeAdvancedAnalytics } = require("../services/advancedAnalytics.service");
const { getCoverageMetrics, getWeightageCoverage } = require("../services/coverage.service");
const { ROLES, ATTEMPT_STATUS, SPRINT_STATUS } = require("../config/constants");
const Sprint = require("../models/Sprint.model");
const Exam = require("../models/Exam.model");
const mongoose = require("mongoose");

// ─── Shared helper: latest-attempt-per-exam dedupe ───────────────────────────
// Mirrors the rule in getStudentSprintSummary — one row per exam, the LATEST
// attempt (highest attemptNumber, tie broken by computedAt).
function dedupeLatestByExam(rows) {
  const latestByExam = new Map();
  for (const ar of rows) {
    const examId = String(ar.exam?._id || ar.exam || "");
    if (!examId) continue;
    const existing = latestByExam.get(examId);
    if (!existing) {
      latestByExam.set(examId, ar);
      continue;
    }
    const arNum = ar.attempt?.attemptNumber || 1;
    const exNum = existing.attempt?.attemptNumber || 1;
    if (arNum > exNum || (arNum === exNum && new Date(ar.computedAt) > new Date(existing.computedAt))) {
      latestByExam.set(examId, ar);
    }
  }
  return Array.from(latestByExam.values());
}

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

  // "Your avg" context for the Attempt Analysis hero cards — this student's
  // average score/accuracy/attempt-rate across their OTHER submitted attempts
  // in the same sprint (test series), so a single test's numbers read against
  // a personal baseline instead of in isolation.
  const [personalAveragesAgg] = await AnalyticsResult.aggregate([
    {
      $match: {
        student: analytics.student,
        sprint:  analytics.sprint?._id || analytics.sprint,
        attempt: { $ne: new mongoose.Types.ObjectId(attemptId) },
      },
    },
    {
      $group: {
        _id:            null,
        avgScore:       { $avg: "$score" },
        avgAccuracy:    { $avg: "$overallAccuracy" },
        avgAttemptRate: { $avg: "$overallAttemptRate" },
        count:          { $sum: 1 },
      },
    },
  ]);
  const personalAverages = personalAveragesAgg
    ? {
        avgScore:       parseFloat((personalAveragesAgg.avgScore       || 0).toFixed(2)),
        avgAccuracy:    parseFloat((personalAveragesAgg.avgAccuracy    || 0).toFixed(2)),
        avgAttemptRate: parseFloat((personalAveragesAgg.avgAttemptRate || 0).toFixed(2)),
        basedOnTests:   personalAveragesAgg.count,
      }
    : null;

  return sendSuccess(res, 200, "Attempt analytics fetched.", {
    analytics,
    advancedAnalytics: advancedAnalytics || null,
    personalAverages,
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

  // FIX: Add a reasonable hard cap. A NEET sprint realistically has ≤50 exams;
  // with up to MAX_ATTEMPTS_PER_EXAM (2) attempts each, cap the raw attempt
  // fetch generously above that so the timeline can show every attempt.
  const MAX_ATTEMPT_ROWS_PER_SPRINT = 200;

  const allAnalytics = await AnalyticsResult.find({ student: studentId, sprint: sprintId })
    .populate("exam", "title examNumber totalMarks scheduledAt")
    .populate("attempt", "attemptNumber status")
    .sort({ createdAt: 1 })
    .limit(MAX_ATTEMPT_ROWS_PER_SPRINT)
    .lean();

  if (!allAnalytics.length) {
    return sendSuccess(res, 200, "No analytics found for this student in this sprint.", {
      summary: null, timeline: [],
    });
  }

  // Reattempts mean a single exam can have up to MAX_ATTEMPTS_PER_EXAM rows
  // here. Per the product decision: the timeline plots EVERY attempt as its
  // own point, but every aggregate (averages, subject/chapter/topic
  // breakdowns, difficulty, error analysis, consistency) is built from one
  // row per exam — the LATEST attempt (highest attemptNumber, tie broken by
  // computedAt) — so a weaker first attempt doesn't drag down or double-count
  // against a stronger second attempt.
  const latestByExam = new Map();
  for (const ar of allAnalytics) {
    const examId = String(ar.exam?._id || ar.exam || "");
    if (!examId) continue;
    const existing = latestByExam.get(examId);
    if (!existing) {
      latestByExam.set(examId, ar);
      continue;
    }
    const arNum = ar.attempt?.attemptNumber || 1;
    const exNum = existing.attempt?.attemptNumber || 1;
    if (arNum > exNum || (arNum === exNum && new Date(ar.computedAt) > new Date(existing.computedAt))) {
      latestByExam.set(examId, ar);
    }
  }
  const dedupedAnalytics = Array.from(latestByExam.values());

  const totalTests    = dedupedAnalytics.length;
  const scores        = dedupedAnalytics.map((a) => a.score);
  const totalScore    = scores.reduce((s, v) => s + v, 0);
  const highestScore  = Math.max(...scores);
  const averageScore  = parseFloat((totalScore / totalTests).toFixed(2));
  const overallPercentage  = parseFloat((dedupedAnalytics.reduce((s, a) => s + a.percentage,       0) / totalTests).toFixed(2));
  const overallAccuracy    = parseFloat((dedupedAnalytics.reduce((s, a) => s + a.overallAccuracy,  0) / totalTests).toFixed(2));
  const overallAttemptRate = parseFloat((dedupedAnalytics.reduce((s, a) => s + a.overallAttemptRate, 0) / totalTests).toFixed(2));

  // Subject aggregates
  const subjectAgg = {};
  for (const ar of dedupedAnalytics) {
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
  for (const ar of dedupedAnalytics) {
    for (const c of ar.chapterAccuracy) {
      const key = `${c.subject}__${c.chapter}`;
      if (!chapterAgg[key]) {
        chapterAgg[key] = { subject: c.subject, chapter: c.chapter, totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, marksObtained: 0, totalTimeSeconds: 0 };
      }
      const agg = chapterAgg[key];
      agg.totalQuestions   += c.totalQuestions   || 0;
      agg.attempted        += c.attempted        || 0;
      agg.correct          += c.correct          || 0;
      agg.incorrect        += c.incorrect        || 0;
      agg.marksObtained    += c.marksObtained    || 0;
      agg.totalTimeSeconds += c.totalTimeSeconds || 0;
    }
  }

  const chapterPerformance = Object.values(chapterAgg).map((c) => ({
    ...c,
    accuracy:    parseFloat(((c.correct   / Math.max(c.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((c.attempted / Math.max(c.totalQuestions, 1)) * 100).toFixed(2)),
    avgTimeSeconds: parseFloat((c.totalTimeSeconds / Math.max(c.totalQuestions, 1)).toFixed(1)),
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
  for (const ar of dedupedAnalytics) {
    for (const t of ar.topicAccuracy) {
      const key = `${t.subject}__${t.chapter}__${t.topic}`;
      if (!topicAgg[key]) {
        topicAgg[key] = { subject: t.subject, chapter: t.chapter, topic: t.topic, totalQuestions: 0, attempted: 0, correct: 0, totalTimeSeconds: 0 };
      }
      topicAgg[key].totalQuestions   += t.totalQuestions   || 0;
      topicAgg[key].attempted        += t.attempted        || 0;
      topicAgg[key].correct          += t.correct          || 0;
      topicAgg[key].totalTimeSeconds += t.totalTimeSeconds || 0;
    }
  }

  // Per-topic × difficulty — powers the "Attempt Rate by Difficulty" /
  // "Accuracy by Difficulty" bars in the Chapters tab. Older AnalyticsResult
  // documents (computed before this field existed) simply contribute nothing
  // here, so a topic's `byDifficulty` comes back {} — the UI hides the bars.
  const topicDifficultyAgg = {};
  for (const ar of dedupedAnalytics) {
    for (const td of (ar.topicDifficultyAccuracy || [])) {
      const topicKey = `${td.subject}__${td.chapter}__${td.topic}`;
      if (!topicDifficultyAgg[topicKey]) topicDifficultyAgg[topicKey] = {};
      if (!topicDifficultyAgg[topicKey][td.difficulty]) {
        topicDifficultyAgg[topicKey][td.difficulty] = { totalQuestions: 0, attempted: 0, correct: 0 };
      }
      const agg = topicDifficultyAgg[topicKey][td.difficulty];
      agg.totalQuestions += td.totalQuestions || 0;
      agg.attempted      += td.attempted      || 0;
      agg.correct        += td.correct        || 0;
    }
  }

  const topicPerformance = Object.values(topicAgg).map((t) => {
    const accuracy = parseFloat(((t.correct / Math.max(t.attempted, 1)) * 100).toFixed(2));
    const key = `${t.subject}__${t.chapter}__${t.topic}`;
    const byDifficultyRaw = topicDifficultyAgg[key] || {};
    const byDifficulty = Object.fromEntries(
      Object.entries(byDifficultyRaw).map(([difficulty, agg]) => [
        difficulty,
        {
          ...agg,
          accuracy:    parseFloat(((agg.correct   / Math.max(agg.attempted,      1)) * 100).toFixed(2)),
          attemptRate: parseFloat(((agg.attempted / Math.max(agg.totalQuestions, 1)) * 100).toFixed(2)),
        },
      ])
    );
    return {
      ...t,
      accuracy,
      attemptRate: parseFloat(((t.attempted / Math.max(t.totalQuestions, 1)) * 100).toFixed(2)),
      avgTimeSeconds: parseFloat((t.totalTimeSeconds / Math.max(t.totalQuestions, 1)).toFixed(1)),
      isWeak:   t.attempted > 0 && accuracy <  weakThreshold,
      isStrong: t.attempted > 0 && accuracy >= strongThreshold,
      byDifficulty,
    };
  });

  // Difficulty aggregates — sprint-level Easy/Medium/Hard rollup, feeds the
  // "Difficulty Type Performance" bars.
  const difficultyAgg = {};
  for (const ar of dedupedAnalytics) {
    for (const d of (ar.difficultySummary || [])) {
      if (!difficultyAgg[d.difficulty]) {
        difficultyAgg[d.difficulty] = {
          difficulty: d.difficulty, totalQuestions: 0, attempted: 0, correct: 0,
          incorrect: 0, unattempted: 0, totalTimeSeconds: 0,
        };
      }
      const agg = difficultyAgg[d.difficulty];
      agg.totalQuestions   += d.totalQuestions   || 0;
      agg.attempted        += d.attempted        || 0;
      agg.correct          += d.correct          || 0;
      agg.incorrect        += d.incorrect        || 0;
      agg.unattempted      += d.unattempted      || 0;
      agg.totalTimeSeconds += d.totalTimeSeconds || 0;
    }
  }
  const totalQuestionsAllDifficulties = Object.values(difficultyAgg)
    .reduce((s, d) => s + d.totalQuestions, 0);
  const difficultyPerformance = Object.values(difficultyAgg).map((d) => ({
    ...d,
    accuracy:          parseFloat(((d.correct   / Math.max(d.attempted,      1)) * 100).toFixed(2)),
    attemptRate:       parseFloat(((d.attempted / Math.max(d.totalQuestions, 1)) * 100).toFixed(2)),
    avgTimeSeconds:    parseFloat((d.totalTimeSeconds / Math.max(d.totalQuestions, 1)).toFixed(1)),
    percentageOfTotal: parseFloat(((d.totalQuestions / Math.max(totalQuestionsAllDifficulties, 1)) * 100).toFixed(2)),
  }));

  // Subject × Difficulty aggregates — feeds the Subjects tab's "Accuracy by
  // Difficulty" bars for each subject card (image 3). Same rollup shape as
  // difficultyPerformance above, just one level more granular.
  const subjectDifficultyAgg = {};
  for (const ar of dedupedAnalytics) {
    for (const d of (ar.difficultyAccuracy || [])) {
      const key = `${d.subject}__${d.difficulty}`;
      if (!subjectDifficultyAgg[key]) {
        subjectDifficultyAgg[key] = { subject: d.subject, difficulty: d.difficulty, totalQuestions: 0, attempted: 0, correct: 0 };
      }
      const agg = subjectDifficultyAgg[key];
      agg.totalQuestions += d.totalQuestions || 0;
      agg.attempted      += d.attempted      || 0;
      agg.correct         += d.correct        || 0;
    }
  }
  const subjectDifficultyPerformance = Object.values(subjectDifficultyAgg).map((d) => ({
    ...d,
    accuracy:    parseFloat(((d.correct   / Math.max(d.attempted,      1)) * 100).toFixed(2)),
    attemptRate: parseFloat(((d.attempted / Math.max(d.totalQuestions, 1)) * 100).toFixed(2)),
  }));

  // Error Analysis — sprint-level Silly Mistake / Concept Error / Guess split,
  // feeds the Error Analysis donut. All three come from the SAME per-attempt
  // errorClassification so they partition the wrong answers exactly
  // (silly + concept + guess === total wrong across the deduped attempts).
  const dedupedAttemptIds = dedupedAnalytics
    .map((ar) => ar.attempt?._id || ar.attempt)
    .filter(Boolean);
  const advancedRows = dedupedAttemptIds.length
    ? await AdvancedAnalytics.find({ attempt: { $in: dedupedAttemptIds } })
        .select("errorClassification")
        .lean()
    : [];
  const errorAnalysis = advancedRows.reduce(
    (acc, row) => {
      acc.silly   += row.errorClassification?.sillyMistakes || 0;
      acc.concept += row.errorClassification?.conceptErrors || 0;
      acc.guess   += row.errorClassification?.guesses || 0;
      return acc;
    },
    { silly: 0, concept: 0, guess: 0, total: 0 }
  );
  errorAnalysis.total = errorAnalysis.silly + errorAnalysis.concept + errorAnalysis.guess;

  // Topic Progression — a topic's accuracy trend across this student's tests
  // in this sprint over time. Only computable at the sprint level (a single
  // attempt has no "over time" dimension). Only topics tested in 2+ exams
  // show a meaningful trend. Uses the deduped (latest-attempt-per-exam) set,
  // same rationale as every other aggregate above.
  const topicProgressionMap = {};
  for (const ar of dedupedAnalytics) {
    for (const t of ar.topicAccuracy) {
      const key = `${t.subject}__${t.chapter}__${t.topic}`;
      if (!topicProgressionMap[key]) {
        topicProgressionMap[key] = { subject: t.subject, chapter: t.chapter, topic: t.topic, series: [] };
      }
      if (t.attempted > 0) {
        topicProgressionMap[key].series.push({
          examId:      ar.exam?._id,
          examTitle:   ar.exam?.title,
          examNumber:  ar.exam?.examNumber,
          attemptedAt: ar.computedAt,
          accuracy:    t.accuracy,
          attempted:   t.attempted,
        });
      }
    }
  }
  const topicProgression = Object.values(topicProgressionMap)
    .filter((tp) => tp.series.length >= 2)
    .map((tp) => ({
      ...tp,
      // Positive = improving, negative = declining, from earliest to latest test.
      trend: parseFloat((tp.series[tp.series.length - 1].accuracy - tp.series[0].accuracy).toFixed(2)),
    }))
    .sort((a, b) => a.trend - b.trend);

  // Consistency Across Tests — how much score/accuracy varies test-to-test.
  // Lower stdDev = more consistent performance.
  const scoreMean = totalScore / totalTests;
  const scoreStdDev = parseFloat(
    Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - scoreMean, 2), 0) / totalTests).toFixed(2)
  );
  const accuracyValues = dedupedAnalytics.map((a) => a.overallAccuracy);
  const accuracyMean = accuracyValues.reduce((s, v) => s + v, 0) / totalTests;
  const accuracyStdDev = parseFloat(
    Math.sqrt(accuracyValues.reduce((s, v) => s + Math.pow(v - accuracyMean, 2), 0) / totalTests).toFixed(2)
  );
  const consistencyAcrossTests = {
    scoreStdDev,
    accuracyStdDevPercent: accuracyStdDev,
    interpretation:
      totalTests < 2 ? "insufficient_data" :
      accuracyStdDev <= 5  ? "very_consistent" :
      accuracyStdDev <= 12 ? "consistent" :
      accuracyStdDev <= 20 ? "variable" : "highly_variable",
  };

  // Timeline plots EVERY attempt (not deduped) as its own chronological point,
  // so a student can see both attempts of a reattempted exam — labelled with
  // attemptNumber so the UI can render "Test 3 · Attempt 2".
  const timeline = allAnalytics.map((ar, idx) => ({
    examId:              ar.exam?._id,
    examTitle:           ar.exam?.title,
    examNumber:          ar.exam?.examNumber,
    attemptId:           ar.attempt?._id || ar.attempt,
    attemptNumber:       ar.attempt?.attemptNumber || 1,
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

  // Coverage metrics — 4 formulas now implemented
  const [coverageMetrics, weightageCoverage] = await Promise.all([
    getCoverageMetrics(studentId, sprintId),
    getWeightageCoverage(studentId, sprintId),
  ]);

  return sendSuccess(res, 200, "Student sprint summary fetched.", {
    summary: {
      totalTests, totalScore, highestScore, averageScore,
      overallAccuracy, overallAttemptRate, overallPercentage,
      consistencyAcrossTests,
    },
    subjectPerformance,
    chapterPerformance,
    topicPerformance: {
      all:    topicPerformance,
      weak:   topicPerformance.filter((t) => t.isWeak),
      strong: topicPerformance.filter((t) => t.isStrong),
    },
    topicProgression,
    difficultyPerformance,
    subjectDifficultyPerformance,
    errorAnalysis,
    coverageMetrics,
    weightageCoverage,
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

// ─── Student: Sprint-level question-level drill-down ──────────────────────────
// Powers "click a metric → see the exact questions behind it" across the whole
// sprint (or one exam via ?examId). Every metric resolves to a set of
// (attempt, slotPosition) tuples, then joins the student's own response row +
// question-bank content. Student-scoped on every query.

const INSIGHT_METRICS = Object.freeze({
  // Silly / concept / guess all read the same per-attempt errorClassification
  // that the "Error Analysis" donut uses, so the drill-down question sets and
  // the headline counts always agree (classifyErrors partitions every wrong
  // answer into exactly one of the three).
  silly_mistakes:    { source: "advanced", field: "sillyMistakeQuestions", reason: "Silly mistake" },
  concept_errors:    { source: "advanced", field: "conceptErrorQuestions", reason: "Concept gap" },
  guesses:           { source: "advanced", field: "guessQuestions", reason: "Rushed guess" },
  missed_high_roi:   { source: "order",    field: "highROIAttemptedLate",  reason: "High-value question reached too late" },
  low_roi_early:     { source: "order",    field: "lowROIAttemptedEarly",  reason: "Low-value question attempted early" },
  slowest:           { source: "result",   field: "slowestQuestions",      reason: "Among your slowest" },
  fastest:           { source: "result",   field: "fastestQuestions",      reason: "Among your fastest" },
  negative_marking:  { source: "response", predicate: (r) => Number(r.marksAwarded) < 0,               reason: "Negative marking" },
  incorrect:         { source: "response", predicate: (r) => r.isAttempted && r.isCorrect === false,   reason: "Incorrect" },
  unattempted:       { source: "response", predicate: (r) => !r.isAttempted,                            reason: "Left unattempted" },
  correct:           { source: "response", predicate: (r) => r.isCorrect === true,                      reason: "Correct" },
  weak_topic:        { source: "response", predicate: (r) => r.isAttempted,                             reason: "Weak topic" },
  // Every question the student attempted — used by the difficulty / chapter
  // drill-downs where the caller wants the whole set, not just the misses.
  attempted:         { source: "response", predicate: (r) => r.isAttempted,
                       reason: (r) => (r.isCorrect === false ? "Incorrect" : r.isCorrect ? "Correct" : "Attempted") },
  // Every question in the paper (attempted or not) at the current filter.
  all_questions:     { source: "response", predicate: () => true,
                       reason: (r) => (!r.isAttempted ? "Not attempted" : r.isCorrect === false ? "Incorrect" : "Correct") },
});

exports.getSprintQuestionInsights = asyncHandler(async (req, res, next) => {
  const studentId = req.user.role === ROLES.STUDENT ? req.user.id : req.params.studentId;
  const { sprintId } = req.params;
  const { metric, subject, chapter, topic, difficulty, examId } = req.query;

  const config = INSIGHT_METRICS[metric];
  if (!config) {
    return next(new AppError(
      `Unknown metric "${metric}". Valid: ${Object.keys(INSIGHT_METRICS).join(", ")}.`, 400,
    ));
  }

  const emptyPayload = {
    metric, totalCount: 0, byExam: [], bySubject: [], questions: [],
  };

  // 1. Latest AnalyticsResult per exam for this student in this sprint.
  const analyticsQuery = { student: studentId, sprint: sprintId };
  if (examId) analyticsQuery.exam = examId;
  const allAnalytics = await AnalyticsResult.find(analyticsQuery)
    .populate("exam", "title examNumber")
    .populate("attempt", "attemptNumber status")
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();
  if (!allAnalytics.length) return sendSuccess(res, 200, "No analytics found.", emptyPayload);

  const deduped = dedupeLatestByExam(allAnalytics);
  const resultByAttempt = new Map();
  const examTitleByAttempt = new Map();
  for (const ar of deduped) {
    const aId = String(ar.attempt?._id || ar.attempt || "");
    if (!aId) continue;
    resultByAttempt.set(aId, ar);
    examTitleByAttempt.set(aId, {
      examId: String(ar.exam?._id || ar.exam || ""),
      examTitle: ar.exam?.title || "Test",
      examNumber: ar.exam?.examNumber ?? null,
    });
  }
  const attemptIds = [...resultByAttempt.keys()].map((id) => new mongoose.Types.ObjectId(id));

  const ctx = {};

  // 2. Advanced analytics (only when the metric needs it).
  let advancedByAttempt = new Map();
  if (config.source === "advanced" || config.source === "order") {
    const advRows = await AdvancedAnalytics.find({ attempt: { $in: attemptIds }, student: studentId })
      .select("attempt errorClassification attemptOrderQuality")
      .lean();
    advancedByAttempt = new Map(advRows.map((r) => [String(r.attempt), r]));
  }

  // 3. Full attempts with responses.
  const attempts = await Attempt.find({ _id: { $in: attemptIds }, student: studentId })
    .select("exam responses")
    .lean();
  const responsesByAttempt = new Map(
    attempts.map((a) => [String(a._id), new Map((a.responses || []).map((r) => [r.slotPosition, r]))]),
  );

  // 4. Resolve the target (attempt, slotPosition) tuples for the requested metric.
  const targets = []; // { attemptId, slotPosition, reason }
  for (const aId of resultByAttempt.keys()) {
    const respMap = responsesByAttempt.get(aId);
    if (!respMap) continue;

    if (config.source === "response") {
      for (const r of respMap.values()) {
        if (config.predicate(r, ctx)) {
          const reason = typeof config.reason === "function" ? config.reason(r) : config.reason;
          targets.push({ attemptId: aId, slotPosition: r.slotPosition, reason });
        }
      }
    } else if (config.source === "result") {
      const list = resultByAttempt.get(aId)?.[config.field] || [];
      for (const q of list) targets.push({ attemptId: aId, slotPosition: q.slotPosition, reason: config.reason });
    } else if (config.source === "advanced") {
      const list = advancedByAttempt.get(aId)?.errorClassification?.[config.field] || [];
      for (const q of list) targets.push({ attemptId: aId, slotPosition: q.slotPosition, reason: config.reason });
    } else if (config.source === "order") {
      const list = advancedByAttempt.get(aId)?.attemptOrderQuality?.[config.field] || [];
      for (const q of list) targets.push({ attemptId: aId, slotPosition: q.slotPosition, reason: config.reason });
    }
  }
  if (!targets.length) return sendSuccess(res, 200, "No questions match this metric.", emptyPayload);

  // 5. Join each target with the student's own response row + optional filters.
  const norm = (v) => String(v || "").toLowerCase();
  let rows = targets.map((t) => {
    const r = responsesByAttempt.get(t.attemptId)?.get(t.slotPosition);
    if (!r) return null;
    const meta = examTitleByAttempt.get(t.attemptId) || {};
    return {
      attemptId: t.attemptId,
      examId: meta.examId,
      examTitle: meta.examTitle,
      examNumber: meta.examNumber,
      slotPosition: t.slotPosition,
      questionId: String(r.questionId || ""),
      subject: r.subject || "",
      chapter: r.chapter || "",
      topic: r.topic || "",
      difficulty: r.difficulty || "",
      yourAnswer: r.selectedAnswer || null,
      correctAnswer: r.correctAnswer || null,
      isCorrect: r.isCorrect,
      isAttempted: r.isAttempted,
      marksAwarded: Number(r.marksAwarded || 0),
      timeSpentSeconds: Number(r.timeSpentSeconds || 0),
      confidence: r.confidence ?? null,
      wasReattempted: !!r.wasReattempted,
      reason: t.reason,
    };
  }).filter(Boolean);

  if (subject)    rows = rows.filter((q) => norm(q.subject)    === norm(subject));
  if (chapter)    rows = rows.filter((q) => norm(q.chapter)    === norm(chapter));
  if (topic)      rows = rows.filter((q) => norm(q.topic)      === norm(topic));
  if (difficulty) rows = rows.filter((q) => norm(q.difficulty) === norm(difficulty));
  if (!rows.length) return sendSuccess(res, 200, "No questions match this metric.", emptyPayload);

  // De-dup (a question can appear once per attempt only, but guard anyway) and
  // order newest-exam-first then by slot.
  const seen = new Set();
  rows = rows.filter((q) => {
    const k = `${q.attemptId}:${q.slotPosition}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => (b.examNumber ?? 0) - (a.examNumber ?? 0) || a.slotPosition - b.slotPosition);

  // 6. Enrich with question-bank content (text / options / solution).
  const QuestionModel = req.app.get("QuestionModel");
  if (QuestionModel) {
    const qIds = [...new Set(rows.map((q) => q.questionId).filter(Boolean))];
    const qDocs = await QuestionModel.find({ _id: { $in: qIds } })
      .select("text hasLatex questionImage options solution subject chapter topic difficulty idealTimeSeconds")
      .lean()
      .catch(() => []);
    const qMap = new Map(qDocs.map((q) => [String(q._id), q]));
    rows = rows.map((q) => {
      const doc = qMap.get(q.questionId);
      if (!doc) return q;
      return {
        ...q,
        subject: q.subject || doc.subject || "",
        chapter: q.chapter || doc.chapter || "",
        topic: q.topic || doc.topic || "",
        difficulty: q.difficulty || doc.difficulty || "",
        questionText: doc.text || "",
        hasLatex: !!doc.hasLatex,
        questionImage: doc.questionImage || null,
        options: doc.options || [],
        solution: doc.solution || null,
        idealTimeSeconds: doc.idealTimeSeconds ?? null,
      };
    });
  }

  // 7. Aggregates for the drill-down's summary charts.
  const byExamMap = new Map();
  const bySubjectMap = new Map();
  for (const q of rows) {
    const e = byExamMap.get(q.examId) || { examId: q.examId, examTitle: q.examTitle, examNumber: q.examNumber, count: 0, marks: 0 };
    e.count += 1; e.marks += q.marksAwarded;
    byExamMap.set(q.examId, e);
    const s = bySubjectMap.get(q.subject) || { subject: q.subject || "unknown", count: 0, marks: 0 };
    s.count += 1; s.marks += q.marksAwarded;
    bySubjectMap.set(q.subject, s);
  }

  return sendSuccess(res, 200, "Question insights fetched.", {
    metric,
    totalCount: rows.length,
    byExam: [...byExamMap.values()].sort((a, b) => (b.examNumber ?? 0) - (a.examNumber ?? 0)),
    bySubject: [...bySubjectMap.values()].sort((a, b) => b.count - a.count),
    questions: rows,
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

// ─── Get all sprints attempted by student (plus active sprint) ────────────────

exports.getStudentAttemptedSprints = asyncHandler(async (req, res, next) => {
  const studentId = req.user.id;

  // 1. Group attempts by sprint for this student to get test counts & latest
  // attempt timestamp. Counts DISTINCT EXAMS, not attempt documents — with
  // reattempts a single test can hold up to MAX_ATTEMPTS_PER_EXAM SUBMITTED
  // attempts, which would otherwise double-count as if it were 2 tests.
  const attemptStats = await Attempt.aggregate([
    {
      $match: {
        student: new mongoose.Types.ObjectId(studentId),
        status: ATTEMPT_STATUS.SUBMITTED,
      },
    },
    {
      $group: {
        _id: { sprint: "$sprint", exam: "$exam" },
        lastAttemptedAt: { $max: "$submittedAt" },
      },
    },
    {
      $group: {
        _id: "$_id.sprint",
        attemptCount: { $sum: 1 },
        lastAttemptedAt: { $max: "$lastAttemptedAt" },
      },
    },
  ]);

  const sprintStatMap = new Map();
  const attemptedSprintIds = [];

  attemptStats.forEach((stat) => {
    if (stat._id) {
      const idStr = stat._id.toString();
      sprintStatMap.set(idStr, {
        attemptCount: stat.attemptCount,
        lastAttemptedAt: stat.lastAttemptedAt,
      });
      attemptedSprintIds.push(stat._id);
    }
  });

  // 2. Fetch Sprint docs for the sprints this student has ACTUALLY attempted.
  // A student's analytics workspace is scoped strictly to sprints they've sat
  // an exam in — not every platform-wide active sprint. (`isActive` is still
  // flagged per sprint so the UI can label an ongoing one.)
  const sprints = attemptedSprintIds.length
    ? await Sprint.find({ _id: { $in: attemptedSprintIds } })
        .select("-patternSlots -createdBy")
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const activeSprintIds = new Set(
    sprints.filter((sp) => sp.status === SPRINT_STATUS.ACTIVE).map((sp) => sp._id.toString())
  );

  // 3. Format response with attempt metadata and active status flag
  const formattedSprints = sprints.map((sp) => {
    const spIdStr = sp._id.toString();
    const stat = sprintStatMap.get(spIdStr);
    const isActive = activeSprintIds.has(spIdStr);

    return {
      _id: sp._id,
      id: sp._id,
      name: sp.name,
      description: sp.description,
      status: sp.status,
      totalQuestions: sp.totalQuestions,
      startDate: sp.startDate,
      endDate: sp.endDate,
      attemptCount: stat ? stat.attemptCount : 0,
      lastAttemptedAt: stat ? stat.lastAttemptedAt : null,
      isActive,
    };
  });

  // Sort: Active first, then by lastAttemptedAt descending, then createdAt descending
  formattedSprints.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    const timeA = a.lastAttemptedAt ? new Date(a.lastAttemptedAt).getTime() : 0;
    const timeB = b.lastAttemptedAt ? new Date(b.lastAttemptedAt).getTime() : 0;
    return timeB - timeA;
  });

  // The default sprint to open: the most recently active one the student has
  // attempted, else their most recent attempt overall.
  const defaultSprint =
    formattedSprints.find((sp) => sp.isActive) || formattedSprints[0] || null;

  return sendSuccess(res, 200, "Student attempted sprints fetched.", {
    sprints: formattedSprints,
    activeSprintId: defaultSprint ? defaultSprint._id : null,
  });
});

