/**
 * Analytics Engine — Module 3 (A–F)
 *
 * All formulas are driven by FormulaConfig documents stored in DB.
 * The engine reads config params at runtime so thresholds can be updated
 * without a code deploy.
 *
 * Default fallback values are used when a config key is not yet received
 * from the client — this ensures the engine never blocks on missing configs.
 */

const AnalyticsResult = require("../models/AnalyticsResult.model");
const FormulaConfig = require("../models/FormulaConfig.model");

// ─── Defaults (used when client-supplied config is not yet available) ────────
const DEFAULTS = {
  // NEET scoring
  correct_marks: 4,
  incorrect_marks: -1,
  // Accuracy thresholds
  weak_topic_accuracy_threshold: 40,
  strong_topic_accuracy_threshold: 80,
  // Guess detection
  guess_attempt_time_threshold_seconds: 5,
  // Recoverable marks weights
  recoverable_incorrect_easy_weight: 1.0,
  recoverable_negative_weight: 1.0,
  high_roi_min_marks: 4,
  // Timing
  top_fastest_count: 5,
  top_slowest_count: 5,
};

/**
 * Loads all active FormulaConfig params for a sprint into a flat key→value map.
 */
const loadFormulaParams = async (sprintId) => {
  const configs = await FormulaConfig.find({
    sprint: sprintId,
    isActive: true,
  }).lean();

  const params = { ...DEFAULTS };
  for (const config of configs) {
    if (config.params) {
      for (const [key, value] of Object.entries(config.params)) {
        params[key] = value;
      }
    }
  }
  return params;
};

const safeDiv = (numerator, denominator) => {
  if (!denominator) return 0;
  return parseFloat((numerator / denominator).toFixed(4));
};

const roundTo = (val, decimals = 2) => {
  return parseFloat(Number(val || 0).toFixed(decimals));
};

/**
 * Main entry point. Computes all analytics for a submitted Attempt.
 * Saves (upserts) the result into AnalyticsResult collection.
 *
 * @param {Object} attempt — fully populated Attempt document
 * @returns {Object} saved AnalyticsResult document
 */
const computeAnalytics = async (attempt) => {
  const params = await loadFormulaParams(attempt.sprint);
  const responses = attempt.responses;

  // ─── Section B: Attempt Analysis ────────────────────────────────────────
  const totalQuestions = responses.length;
  const totalAttempted = responses.filter((r) => r.isAttempted).length;
  const totalUnattempted = totalQuestions - totalAttempted;
  const totalCorrect = responses.filter((r) => r.isCorrect === true).length;
  const totalIncorrect = responses.filter(
    (r) => r.isAttempted && r.isCorrect === false
  ).length;
  const overallAttemptRate = roundTo(
    safeDiv(totalAttempted, totalQuestions) * 100
  );

  // Guess detection: attempted, incorrect, and time below threshold
  const guessThreshold =
    parseFloat(params.guess_attempt_time_threshold_seconds) || 5;
  const totalGuessAttempts = responses.filter(
    (r) =>
      r.isAttempted &&
      r.isCorrect === false &&
      r.timeSpentSeconds <= guessThreshold
  ).length;

  // ─── Section A: Accuracy Analysis ────────────────────────────────────────
  const overallAccuracy = roundTo(
    safeDiv(totalCorrect, totalAttempted) * 100
  );

  // Group by subject
  const subjectMap = {};
  for (const r of responses) {
    if (!subjectMap[r.subject]) {
      subjectMap[r.subject] = {
        subject: r.subject,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        marksObtained: 0,
        negativeMarks: 0,
        totalTimeSeconds: 0,
      };
    }
    const s = subjectMap[r.subject];
    s.totalQuestions++;
    if (r.isAttempted) {
      s.attempted++;
      if (r.isCorrect) {
        s.correct++;
        s.marksObtained += r.marks;
      } else {
        s.incorrect++;
        s.negativeMarks += r.negativeMarks;
        s.marksObtained -= r.negativeMarks;
      }
    } else {
      s.unattempted++;
    }
    s.totalTimeSeconds += r.timeSpentSeconds || 0;
  }

  const subjectAccuracy = Object.values(subjectMap).map((s) => ({
    ...s,
    accuracy: roundTo(safeDiv(s.correct, s.attempted) * 100),
    attemptRate: roundTo(safeDiv(s.attempted, s.totalQuestions) * 100),
    avgTimePerQuestion: roundTo(safeDiv(s.totalTimeSeconds, s.totalQuestions)),
  }));

  // Group by chapter
  const chapterMap = {};
  for (const r of responses) {
    const key = `${r.subject}__${r.chapter}`;
    if (!chapterMap[key]) {
      chapterMap[key] = {
        subject: r.subject,
        chapter: r.chapter,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        marksObtained: 0,
        negativeMarks: 0,
      };
    }
    const c = chapterMap[key];
    c.totalQuestions++;
    if (r.isAttempted) {
      c.attempted++;
      if (r.isCorrect) {
        c.correct++;
        c.marksObtained += r.marks;
      } else {
        c.incorrect++;
        c.negativeMarks += r.negativeMarks;
        c.marksObtained -= r.negativeMarks;
      }
    } else {
      c.unattempted++;
    }
  }

  const chapterAccuracy = Object.values(chapterMap).map((c) => ({
    ...c,
    accuracy: roundTo(safeDiv(c.correct, c.attempted) * 100),
    attemptRate: roundTo(safeDiv(c.attempted, c.totalQuestions) * 100),
  }));

  // Group by topic
  const topicMap = {};
  for (const r of responses) {
    const key = `${r.subject}__${r.chapter}__${r.topic}`;
    if (!topicMap[key]) {
      topicMap[key] = {
        subject: r.subject,
        chapter: r.chapter,
        topic: r.topic,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
      };
    }
    const t = topicMap[key];
    t.totalQuestions++;
    if (r.isAttempted) {
      t.attempted++;
      if (r.isCorrect) t.correct++;
      else t.incorrect++;
    }
  }

  const weakThreshold = parseFloat(params.weak_topic_accuracy_threshold) || 40;
  const strongThreshold =
    parseFloat(params.strong_topic_accuracy_threshold) || 80;

  const topicAccuracy = Object.values(topicMap).map((t) => {
    const accuracy = roundTo(safeDiv(t.correct, t.attempted) * 100);
    return {
      ...t,
      accuracy,
      attemptRate: roundTo(safeDiv(t.attempted, t.totalQuestions) * 100),
      isWeak: t.attempted > 0 && accuracy < weakThreshold,
      isStrong: t.attempted > 0 && accuracy >= strongThreshold,
    };
  });

  // Group by difficulty × subject — matches difficultyBreakdownSchema's
  // documented "subject dimension" (previously grouped by difficulty alone,
  // leaving `subject`/`attemptRate`/`percentageOfTotal` permanently unset).
  const difficultyMap = {};
  for (const r of responses) {
    const key = `${r.difficulty}_${r.subject}`;
    if (!difficultyMap[key]) {
      difficultyMap[key] = {
        difficulty: r.difficulty,
        subject: r.subject,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        totalTimeSeconds: 0,
      };
    }
    const d = difficultyMap[key];
    d.totalQuestions++;
    if (r.isAttempted) {
      d.attempted++;
      if (r.isCorrect) d.correct++;
      else d.incorrect++;
    } else {
      d.unattempted++;
    }
    d.totalTimeSeconds += r.timeSpentSeconds || 0;
  }

  const totalTimeAllResponses = responses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0);

  const difficultyAccuracy = Object.values(difficultyMap).map((d) => ({
    ...d,
    accuracy: roundTo(safeDiv(d.correct, d.attempted) * 100),
    attemptRate: roundTo(safeDiv(d.attempted, d.totalQuestions) * 100),
    avgTimeSeconds: roundTo(safeDiv(d.totalTimeSeconds, d.totalQuestions)),
    percentageOfTotal: roundTo(safeDiv(d.totalTimeSeconds, totalTimeAllResponses) * 100),
  }));

  // Pure per-difficulty rollup, collapsed across subject — covers
  // Accuracy(Easy/Medium/Hard), Attempt Rate(Easy/Medium/Hard),
  // Time per Difficulty, and time-distribution % across difficulty.
  const difficultySummaryMap = {};
  for (const r of responses) {
    if (!difficultySummaryMap[r.difficulty]) {
      difficultySummaryMap[r.difficulty] = {
        difficulty: r.difficulty,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        totalTimeSeconds: 0,
      };
    }
    const d = difficultySummaryMap[r.difficulty];
    d.totalQuestions++;
    if (r.isAttempted) {
      d.attempted++;
      if (r.isCorrect) d.correct++;
      else d.incorrect++;
    } else {
      d.unattempted++;
    }
    d.totalTimeSeconds += r.timeSpentSeconds || 0;
  }

  const difficultySummary = Object.values(difficultySummaryMap).map((d) => ({
    ...d,
    totalTimeSeconds: roundTo(d.totalTimeSeconds),
    accuracy: roundTo(safeDiv(d.correct, d.attempted) * 100),
    attemptRate: roundTo(safeDiv(d.attempted, d.totalQuestions) * 100),
    avgTimeSeconds: roundTo(safeDiv(d.totalTimeSeconds, d.totalQuestions)),
    percentageOfTotal: roundTo(safeDiv(d.totalTimeSeconds, totalTimeAllResponses) * 100),
  }));

  // ─── Section C: Negative Marking Analysis ────────────────────────────────
  const totalNegativeMarks = responses.reduce(
    (sum, r) => (r.isAttempted && !r.isCorrect ? sum + r.negativeMarks : sum),
    0
  );

  const totalMarks = attempt.totalMarks || 0;
  const negativeMarkingPercentageLoss = roundTo(
    safeDiv(totalNegativeMarks, totalMarks) * 100
  );

  // Recoverable negative marks: marks lost on incorrect easy questions
  const recoverableNegativeMarks = responses.reduce((sum, r) => {
    if (r.isAttempted && !r.isCorrect && r.difficulty === "easy") {
      return sum + r.negativeMarks;
    }
    return sum;
  }, 0);

  const negativeMarksBySubject = subjectAccuracy.map((s) => ({
    subject: s.subject,
    totalQuestions: s.totalQuestions,
    attempted: s.attempted,
    correct: s.correct,
    incorrect: s.incorrect,
    unattempted: s.unattempted,
    marksObtained: s.marksObtained,
    negativeMarks: s.negativeMarks,
    accuracy: s.accuracy,
    attemptRate: s.attemptRate,
    totalTimeSeconds: s.totalTimeSeconds,
    avgTimePerQuestion: s.avgTimePerQuestion,
  }));

  // ─── Section D: Time Utilization Analysis ────────────────────────────────
  const totalTimeSeconds = attempt.totalTimeSeconds || 0;
  const avgTimePerQuestion = roundTo(
    safeDiv(totalTimeSeconds, totalQuestions)
  );

  // Avg time on correct vs incorrect
  const correctResponses = responses.filter((r) => r.isCorrect);
  const incorrectResponses = responses.filter(
    (r) => r.isAttempted && !r.isCorrect
  );

  const avgTimeOnCorrect = roundTo(
    safeDiv(
      correctResponses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0),
      correctResponses.length
    )
  );

  const avgTimeOnIncorrect = roundTo(
    safeDiv(
      incorrectResponses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0),
      incorrectResponses.length
    )
  );

  // Time Variance & Standard Deviation
  const attemptedResponses = responses.filter((r) => r.isAttempted);
  const attemptedTimes = attemptedResponses.map((r) => r.timeSpentSeconds || 0);
  const mean = safeDiv(
    attemptedTimes.reduce((s, t) => s + t, 0),
    attemptedTimes.length
  );
  const squaredDiffs = attemptedTimes.map((t) => Math.pow(t - mean, 2));
  const timeVariance = roundTo(
    safeDiv(squaredDiffs.reduce((s, d) => s + d, 0), attemptedTimes.length)
  );
  const timeStdDeviation = roundTo(Math.sqrt(timeVariance));

  // Subject time distribution
  const subjectTimeMap = {};
  responses.forEach((r) => {
    if (!subjectTimeMap[r.subject]) {
      subjectTimeMap[r.subject] = { totalTime: 0, count: 0 };
    }
    subjectTimeMap[r.subject].totalTime += r.timeSpentSeconds || 0;
    subjectTimeMap[r.subject].count++;
  });

  // Normalize against the sum of the SAME responses' timeSpentSeconds (totalTimeAllResponses),
  // not attempt.totalTimeSeconds (the attempt's stored wall-clock duration) — the two can
  // differ (idle/pause time not attributed to any question), which would make these subject
  // percentages not sum to 100% and be non-comparable with difficultyAccuracy/difficultySummary's
  // percentageOfTotal below, which is already normalized against totalTimeAllResponses.
  const subjectTimeDistribution = Object.entries(subjectTimeMap).map(
    ([subject, data]) => ({
      subject,
      totalTimeSeconds: roundTo(data.totalTime),
      avgTimePerQuestion: roundTo(safeDiv(data.totalTime, data.count)),
      percentageOfTotal: roundTo(safeDiv(data.totalTime, totalTimeAllResponses) * 100),
    })
  );

  const questionTimings = responses.map((r) => ({
    slotPosition: r.slotPosition,
    questionId: r.questionId,
    subject: r.subject,
    difficulty: r.difficulty,
    timeSpentSeconds: r.timeSpentSeconds || 0,
    isCorrect: r.isCorrect,
    isAttempted: r.isAttempted,
  }));

  const sortedByTime = questionTimings.filter((q) => q.isAttempted).sort(
    (a, b) => a.timeSpentSeconds - b.timeSpentSeconds
  );
  const topFastest = parseInt(params.top_fastest_count, 10) || 5;
  const topSlowest = parseInt(params.top_slowest_count, 10) || 5;
  const fastestQuestions = sortedByTime.slice(0, topFastest);
  const slowestQuestions = sortedByTime.slice(-topSlowest).reverse();

  // ─── Section E: Recoverable Marks Analysis ───────────────────────────────
  const incorrectEasyWeight =
    parseFloat(params.recoverable_incorrect_easy_weight) || 1.0;
  const negativeWeight =
    parseFloat(params.recoverable_negative_weight) || 1.0;
  const highROIMinMarks = parseFloat(params.high_roi_min_marks) || 4;

  // Marks recoverable from incorrect easy questions
  const incorrectEasyRecoverable = responses.reduce((sum, r) => {
    if (r.isAttempted && !r.isCorrect && r.difficulty === "easy") {
      return sum + r.marks * incorrectEasyWeight;
    }
    return sum;
  }, 0);

  // Marks lost to negative marking
  const negativeLoss = totalNegativeMarks * negativeWeight;

  // Time misallocation: time spent on incorrect questions that could have been
  // reallocated to unattempted ones. Expressed as marks-equivalent potential.
  const timeOnIncorrect = responses.reduce((sum, r) => {
    return r.isAttempted && !r.isCorrect ? sum + (r.timeSpentSeconds || 0) : sum;
  }, 0);

  // Simplified time misallocation: if avg time per correct question was used instead
  const timeMisallocation = roundTo(
    safeDiv(timeOnIncorrect, Math.max(avgTimePerQuestion, 1)) *
      (totalMarks / Math.max(totalQuestions, 1))
  );

  // Low accuracy areas: marks left on table from weak topics
  const lowAccuracyAreas = topicAccuracy.reduce((sum, t) => {
    if (t.isWeak) {
      const topicResponses = responses.filter(
        (r) => r.subject === t.subject && r.chapter === t.chapter && r.topic === t.topic
      );
      const unattemptedMarks = topicResponses
        .filter((r) => !r.isAttempted)
        .reduce((s, r) => s + r.marks, 0);
      return sum + unattemptedMarks;
    }
    return sum;
  }, 0);

  // Missed high-ROI: unattempted questions above mark threshold
  const missedHighROI = responses.reduce((sum, r) => {
    if (!r.isAttempted && r.marks >= highROIMinMarks) {
      return sum + r.marks;
    }
    return sum;
  }, 0);

  const totalRecoverable = roundTo(
    incorrectEasyRecoverable + negativeLoss + timeMisallocation + lowAccuracyAreas + missedHighROI
  );

  const recoverableBySubject = subjectAccuracy.map((s) => {
    const subjectResponses = responses.filter((r) => r.subject === s.subject);
    const subjectRecoverable = subjectResponses.reduce((sum, r) => {
      if (r.isAttempted && !r.isCorrect && r.difficulty === "easy")
        return sum + r.marks * incorrectEasyWeight;
      if (!r.isAttempted && r.marks >= highROIMinMarks) return sum + r.marks;
      return sum;
    }, 0);
    return { subject: s.subject, recoverableMarks: roundTo(subjectRecoverable) };
  });

  const recoverableMarks = {
    totalRecoverable,
    incorrectEasyQuestions: roundTo(incorrectEasyRecoverable),
    negativeLoss: roundTo(negativeLoss),
    timeMisallocation: roundTo(timeMisallocation),
    lowAccuracyAreas: roundTo(lowAccuracyAreas),
    missedHighROI: roundTo(missedHighROI),
    breakdownBySubject: recoverableBySubject,
  };

  // ─── Upsert AnalyticsResult ───────────────────────────────────────────────
  const result = await AnalyticsResult.findOneAndUpdate(
    { attempt: attempt._id },
    {
      attempt: attempt._id,
      student: attempt.student,
      exam: attempt.exam,
      sprint: attempt.sprint,
      batch: attempt.batch,
      // Section A
      overallAccuracy,
      subjectAccuracy,
      chapterAccuracy,
      topicAccuracy,
      difficultyAccuracy,
      difficultySummary,
      // Section B
      totalQuestions,
      totalAttempted,
      totalUnattempted,
      totalCorrect,
      totalIncorrect,
      totalGuessAttempts,
      overallAttemptRate,
      // Section C
      totalNegativeMarks,
      negativeMarkingPercentageLoss,
      recoverableNegativeMarks,
      negativeMarksBySubject,
      // Section D
      totalTimeSeconds,
      avgTimePerQuestion,
      avgTimeOnCorrect,
      avgTimeOnIncorrect,
      timeVariance,
      timeStdDeviation,
      subjectTimeDistribution,
      questionTimings,
      fastestQuestions,
      slowestQuestions,
      // Section E
      recoverableMarks,
      // Denormalized summary
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      computedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );

  return result;
};

/**
 * Wrapper that computes both basic + advanced analytics
 */
const computeCompleteAnalytics = async (attempt) => {
  // First compute basic analytics
  const basicResult = await computeAnalytics(attempt);
  
  // Then compute advanced analytics
  const { computeAdvancedAnalytics } = require("./advancedAnalytics.service");
  await computeAdvancedAnalytics(attempt, basicResult._id);
  
  return basicResult;
};

module.exports = { computeAnalytics, computeCompleteAnalytics };
