/**
 * Advanced Analytics Service — Client Formula Implementation
 * 
 * Implements ALL formulas provided by client:
 * - Foundation Metrics (Score, Accuracy, Attempt Rate)
 * - Time & Speed Metrics
 * - Difficulty-wise Performance
 * - Error Classification (Silly Mistakes, Concept Errors, Guesses)
 * - ROI Metrics (Expected ROI, Coverage, Score Opportunity Index)
 * - Fatigue Curve (Rolling Accuracy, Drops, Spikes, Recovery)
 * - Streak Analysis (Good/Bad streaks)
 * - Reattempt Metrics (Productive/Harmful reattempts)
 * - Time Variance & Statistical Analysis
 */

const AdvancedAnalytics = require("../models/AdvancedAnalytics.model");
const AnalyticsResult = require("../models/AnalyticsResult.model");
const FormulaConfig = require("../models/FormulaConfig.model");
const {
  FALLBACK_P_CORRECT,
  ROI_CLASSIFICATION,
  expectedTimeMinutes,
  classifyRoiByPercentile,
} = require("../config/analyticsFormulas");

// Constants from client formulas
const DEFAULTS = {
  correct_marks: 4,
  incorrect_marks: -1,
  silly_mistake_confidence_threshold: 80,
  concept_error_confidence_min: 50,
  concept_error_confidence_max: 80,
  guess_confidence_threshold: 50,
  guess_time_factor: 0.6,
  // ROI Classification Framework — questions are ranked RELATIVE to the rest of
  // the test, not against a fixed cutoff. "percentile": top 25% = HIGH, middle
  // 50% = MEDIUM, bottom 25% = LOW. "absolute" falls back to the fixed
  // marks/minute cutoffs below (legacy).
  roi_classification_method: ROI_CLASSIFICATION.method,
  roi_high_percentile: ROI_CLASSIFICATION.highPercentile,
  roi_low_percentile: ROI_CLASSIFICATION.lowPercentile,
  high_roi_threshold: ROI_CLASSIFICATION.absoluteHigh,
  low_roi_threshold: ROI_CLASSIFICATION.absoluteLow,
  rolling_window_size: 5,
  critical_accuracy_threshold: 40,
  recovery_accuracy_threshold: 60,
  silly_mistake_reward: 5,
  high_roi_skip_penalty: 4,
  low_roi_wrong_penalty: 1,
  guess_penalty: 1,
  // Attempt Order Quality weights
  order_weight_roi: 0.5,
  order_weight_easy: 0.3,
  order_weight_marks: 0.2,
  order_min_sequenced: 5,
};

const safeDiv = (num, denom) => (!denom ? 0 : parseFloat((num / denom).toFixed(4)));
const roundTo = (val, decimals = 2) => parseFloat(Number(val || 0).toFixed(decimals));
const pct = (num, denom) => roundTo(safeDiv(num, denom) * 100);
const median = (values) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : roundTo((sorted[mid - 1] + sorted[mid]) / 2);
};
const stdDev = (values) => {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  const mean = safeDiv(clean.reduce((s, v) => s + v, 0), clean.length);
  return roundTo(Math.sqrt(safeDiv(clean.reduce((s, v) => s + Math.pow(v - mean, 2), 0), clean.length)));
};
const accuracyFor = (items) => pct(items.filter((r) => r.isCorrect).length, items.filter((r) => r.isAttempted).length);
const attemptedRateFor = (items) => pct(items.filter((r) => r.isAttempted).length, items.length);

// P(correct) for one response given the difficulty and the student's chapter
// probability map (falls back to the difficulty-scaled prior when there's no
// estimate for that chapter yet). Shared so ROI and Attempt-Order-Quality never
// disagree on a question's probability.
const pCorrectForResponse = (r, probabilityMap = {}) => {
  const diff = String(r.difficulty || "medium").toLowerCase();
  const probMap = probabilityMap[`${r.subject}_${r.chapter}`];
  if (probMap && probMap.pEasy !== undefined) {
    return diff === "easy" ? probMap.pEasy : diff === "medium" ? probMap.pMedium : probMap.pHard;
  }
  return FALLBACK_P_CORRECT[diff] ?? FALLBACK_P_CORRECT.medium;
};

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

/**
 * 1. FOUNDATION METRICS
 */
const computeFoundationMetrics = (responses, params) => {
  // Sum each response's own recorded marks (marksAwarded, or marks/negativeMarks as a
  // fallback) rather than a flat correct_marks/incorrect_marks default — questions can
  // carry non-default marks (bonus/partial-credit), and other sections of this same
  // document (difficulty.scoreContribution, subjectTopic.subjectWiseScore) already use
  // the per-question values, so a flat-default score here would silently disagree with them.
  const totalScore = responses.reduce((sum, r) => {
    if (!r.isAttempted) return sum;
    if (Number.isFinite(r.marksAwarded)) return sum + r.marksAwarded;
    if (r.isCorrect) return sum + (Number.isFinite(r.marks) ? r.marks : params.correct_marks);
    const negative = Number.isFinite(r.negativeMarks) ? r.negativeMarks : Math.abs(params.incorrect_marks);
    return sum - negative;
  }, 0);

  const attempted = responses.filter((r) => r.isAttempted).length;
  const correct = responses.filter((r) => r.isCorrect).length;
  const incorrect = responses.filter((r) => r.isAttempted && !r.isCorrect).length;
  const unattempted = responses.length - attempted;

  const accuracy = roundTo(safeDiv(correct, attempted) * 100);
  const attemptRate = roundTo(safeDiv(attempted, responses.length) * 100);

  return { totalScore, accuracy, attemptRate, correct, incorrect, attempted, unattempted };
};

/**
 * 2. TIME & SPEED METRICS
 */
const computeTimeMetrics = (responses) => {
  const totalTime = responses.reduce((sum, r) => sum + (r.timeSpentSeconds || 0), 0);
  const attempted = responses.filter((r) => r.isAttempted);
  const avgTimePerQuestion = roundTo(safeDiv(totalTime, responses.length));

  // Subject-wise time
  const timeBySubject = {};
  responses.forEach((r) => {
    if (!timeBySubject[r.subject]) {
      timeBySubject[r.subject] = { totalTime: 0, count: 0 };
    }
    timeBySubject[r.subject].totalTime += r.timeSpentSeconds || 0;
    timeBySubject[r.subject].count++;
  });

  // Subject time distribution %
  const subjectTimeDistribution = Object.entries(timeBySubject).map(([subject, data]) => ({
    subject,
    totalTimeSeconds: roundTo(data.totalTime),
    avgTimePerQuestion: roundTo(safeDiv(data.totalTime, data.count)),
    percentageOfTotal: roundTo(safeDiv(data.totalTime, totalTime) * 100),
  }));

  // Time on correct vs incorrect
  const correctResponses = responses.filter((r) => r.isCorrect);
  const incorrectResponses = responses.filter((r) => r.isAttempted && !r.isCorrect);

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
  const attemptedTimes = attempted.map((r) => r.timeSpentSeconds || 0);
  const mean = safeDiv(attemptedTimes.reduce((s, t) => s + t, 0), attemptedTimes.length);
  const squaredDiffs = attemptedTimes.map((t) => Math.pow(t - mean, 2));
  const variance = roundTo(safeDiv(squaredDiffs.reduce((s, d) => s + d, 0), attemptedTimes.length));
  const standardDeviation = roundTo(Math.sqrt(variance));

  return {
    totalTime,
    avgTimePerQuestion,
    subjectTimeDistribution,
    avgTimeOnCorrect,
    avgTimeOnIncorrect,
    variance,
    standardDeviation,
  };
};

/**
 * 3. DIFFICULTY-WISE PERFORMANCE
 */
const computeDifficultyMetrics = (responses) => {
  const difficultyMap = {};

  responses.forEach((r) => {
    const key = `${r.difficulty}_${r.subject}`;
    if (!difficultyMap[key]) {
      difficultyMap[key] = {
        difficulty: r.difficulty,
        subject: r.subject,
        total: 0,
        attempted: 0,
        correct: 0,
        totalTime: 0,
        incorrect: 0,
        unattempted: 0,
      };
    }
    const d = difficultyMap[key];
    d.total++;
    if (r.isAttempted) {
      d.attempted++;
      if (r.isCorrect) d.correct++;
      else d.incorrect++;
    } else {
      d.unattempted++;
    }
    d.totalTime += r.timeSpentSeconds || 0;
  });

  const difficultyBreakdown = Object.values(difficultyMap).map((d) => ({
    difficulty: d.difficulty,
    subject: d.subject,
    totalQuestions: d.total,
    attempted: d.attempted,
    correct: d.correct,
    incorrect: d.incorrect,
    unattempted: d.unattempted,
    totalTimeSeconds: roundTo(d.totalTime),
    accuracy: roundTo(safeDiv(d.correct, d.attempted) * 100),
    attemptRate: roundTo(safeDiv(d.attempted, d.total) * 100),
    avgTimeSeconds: roundTo(safeDiv(d.totalTime, d.total)),
    avgTimePerQuestion: roundTo(safeDiv(d.totalTime, d.total)),
    attemptedQuestions: d.attempted,
    percentageOfTotal: 0,
  }));

  // Calculate time distribution %
  const totalTime = responses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0);
  difficultyBreakdown.forEach((d) => {
    const diffTime = responses
      .filter((r) => r.difficulty === d.difficulty && r.subject === d.subject)
      .reduce((s, r) => s + (r.timeSpentSeconds || 0), 0);
    d.percentageOfTotal = roundTo(safeDiv(diffTime, totalTime) * 100);
  });

  return difficultyBreakdown;
};

/**
 * 4. ERROR CLASSIFICATION
 * - Silly Mistakes: High confidence, good history, normal time, but wrong
 * - Concept Errors: Medium confidence, slow time, weak history, wrong
 * - Guesses: Low confidence, fast time, wrong (or lucky correct)
 */
const classifyErrors = (responses, params, historicalAccuracy = {}) => {
  const sillyMistakes = [];
  const conceptErrors = [];
  const guesses = [];

  const attemptedForAvg = responses.filter((r) => r.isAttempted);
  const avgTime = safeDiv(
    attemptedForAvg.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0),
    attemptedForAvg.length
  );

  responses.forEach((r) => {
    if (!r.isAttempted) return;

    const confidence = r.confidence || 50;
    const timeSpent = r.timeSpentSeconds || 0;
    const topicKey = `${r.subject}_${r.chapter}_${r.topic}`;
    const topicAccuracy = historicalAccuracy[topicKey] || 50;

    // Guess: Low confidence + fast time
    if (confidence < params.guess_confidence_threshold && timeSpent < avgTime * params.guess_time_factor) {
      guesses.push({ questionId: r.questionId, slotPosition: r.slotPosition });
    }
    // Silly Mistake: High confidence + normal/good time + wrong
    else if (
      !r.isCorrect &&
      confidence >= params.silly_mistake_confidence_threshold &&
      topicAccuracy >= 60 &&
      timeSpent >= avgTime * 0.5
    ) {
      sillyMistakes.push({ questionId: r.questionId, slotPosition: r.slotPosition });
    }
    // Concept Error: mid confidence (50–80%) + slower-than-normal time + wrong +
    // weak topic history (the complement of the "good history" a silly mistake
    // needs — per the formula guide's concept-error criteria).
    else if (
      !r.isCorrect &&
      confidence >= params.concept_error_confidence_min &&
      confidence < params.concept_error_confidence_max &&
      timeSpent > avgTime * 1.2 &&
      topicAccuracy < 60
    ) {
      conceptErrors.push({ questionId: r.questionId, slotPosition: r.slotPosition });
    }
  });

  const attempted = responses.filter((r) => r.isAttempted).length;
  const wrongCount = responses.filter((r) => r.isAttempted && !r.isCorrect).length;

  return {
    sillyMistakes: sillyMistakes.length,
    // Spec formula: Silly Mistake Rate = silly mistakes / wrong (category 3)
    sillyMistakeRate: roundTo(safeDiv(sillyMistakes.length, wrongCount) * 100),
    // Spec formula: Careless Error Rate = careless mistakes / total attempted (category 1) —
    // same underlying classification, different denominator per the framework.
    carelessErrorRate: roundTo(safeDiv(sillyMistakes.length, attempted) * 100),
    conceptErrors: conceptErrors.length,
    // Spec formula: Conceptual Error Rate = conceptual errors / wrong (category 3)
    conceptErrorRate: roundTo(safeDiv(conceptErrors.length, wrongCount) * 100),
    guesses: guesses.length,
    guessRate: roundTo(safeDiv(guesses.length, attempted) * 100),
    sillyMistakeQuestions: sillyMistakes,
    conceptErrorQuestions: conceptErrors,
    guessQuestions: guesses,
  };
};

/**
 * 5. ROI METRICS  (ROI Classification Framework)
 *
 * Expected Marks   = 4 × P(C) − 1 × P(W)   (= 5·P(C) − 1)
 * Expected ROI     = Expected Marks / Expected solving time (minutes)
 * Classification   = RELATIVE to the rest of THIS test's questions:
 *                      top 25% ROI  → HIGH
 *                      25–75%       → MEDIUM
 *                      bottom 25%   → LOW
 *                    (fixed absolute cutoffs are the legacy "absolute" method)
 * High ROI Coverage   = Attempted High ROI  / Total High ROI
 * Medium ROI Attempts = Attempted Medium ROI / Total Medium ROI
 * Low ROI Attempts    = Attempted Low ROI   / Total Low ROI
 * Score Opportunity Index = Sum of all avoidable losses
 */
const computeROIMetrics = (responses, params, historicalProbability = {}, sillyMistakeQuestionIds = new Set()) => {
  const roiMap = responses.map((r) => {
    const pCorrect = pCorrectForResponse(r, historicalProbability);
    const pWrong = 1 - pCorrect;
    const expectedMarks = params.correct_marks * pCorrect + params.incorrect_marks * pWrong;
    // "Expected solving time" — stored ideal time / difficulty default / actual.
    const timeMinutes = expectedTimeMinutes(r);
    const roi = safeDiv(expectedMarks, timeMinutes);
    return { ...r, roi, pCorrect, expectedMarks };
  });

  const method = params.roi_classification_method || ROI_CLASSIFICATION.method;

  let highROI, mediumROI, lowROI, cutoffs;
  if (method === "absolute") {
    const hi = parseFloat(params.high_roi_threshold) || ROI_CLASSIFICATION.absoluteHigh;
    const lo = parseFloat(params.low_roi_threshold) || ROI_CLASSIFICATION.absoluteLow;
    highROI = roiMap.filter((r) => r.roi >= hi);
    lowROI = roiMap.filter((r) => r.roi < lo);
    mediumROI = roiMap.filter((r) => r.roi >= lo && r.roi < hi);
    cutoffs = { high: hi, low: lo };
  } else {
    const cls = classifyRoiByPercentile(roiMap, (r) => r.roi, {
      highPercentile: parseFloat(params.roi_high_percentile) || ROI_CLASSIFICATION.highPercentile,
      lowPercentile: parseFloat(params.roi_low_percentile) || ROI_CLASSIFICATION.lowPercentile,
    });
    highROI = roiMap.filter((_, i) => cls.high.has(i));
    mediumROI = roiMap.filter((_, i) => cls.medium.has(i));
    lowROI = roiMap.filter((_, i) => cls.low.has(i));
    cutoffs = cls.cutoffs;
  }

  const highROICoverage = roundTo(safeDiv(highROI.filter((r) => r.isAttempted).length, highROI.length) * 100);
  const mediumROIAttempts = roundTo(safeDiv(mediumROI.filter((r) => r.isAttempted).length, mediumROI.length) * 100);
  const lowROIAttempts = roundTo(safeDiv(lowROI.filter((r) => r.isAttempted).length, lowROI.length) * 100);
  // Genuine accuracy among high-ROI questions (distinct from highROICoverage, which is
  // attempt-coverage, not correctness) — used by computeMetricsFramework below.
  const highROIAttempted = highROI.filter((r) => r.isAttempted);
  const highROIAccuracy = roundTo(safeDiv(highROIAttempted.filter((r) => r.isCorrect).length, highROIAttempted.length) * 100);

  // Score Opportunity Index
  // Reuses the SAME silly-mistake classification as errorClassification.sillyMistakes
  // (confidence/history/time-based, see classifyErrors) rather than an independent
  // wrong-and-easy proxy — otherwise this document would report two different counts
  // both labelled "silly mistakes".
  const sillyMistakesLoss = responses.filter((r) => r.isAttempted && !r.isCorrect && sillyMistakeQuestionIds.has(String(r.questionId))).length * params.silly_mistake_reward;
  const highROISkippedLoss = highROI.filter((r) => !r.isAttempted).length * params.high_roi_skip_penalty;
  const lowROIAttemptedLoss = lowROI.filter((r) => r.isAttempted && !r.isCorrect).length * params.low_roi_wrong_penalty;
  const guessingLoss = roiMap.filter((r) => r.isAttempted && !r.isCorrect && (r.timeSpentSeconds || 0) < 20).length * params.guess_penalty;

  const scoreOpportunityIndex = roundTo(sillyMistakesLoss + highROISkippedLoss + lowROIAttemptedLoss + guessingLoss);

  return {
    highROICoverage,
    mediumROIAttempts,
    lowROIAttempts,
    highROIAccuracy,
    highROICount: highROI.length,
    mediumROICount: mediumROI.length,
    lowROICount: lowROI.length,
    roiClassificationMethod: method,
    roiPercentileCutoffs: { high: roundTo(cutoffs.high, 4), low: roundTo(cutoffs.low, 4) },
    scoreOpportunityIndex,
    soiBreakdown: {
      sillyMistakesLoss: roundTo(sillyMistakesLoss),
      highROISkippedLoss: roundTo(highROISkippedLoss),
      lowROIAttemptedLoss: roundTo(lowROIAttemptedLoss),
      guessingLoss: roundTo(guessingLoss),
    },
    // Not persisted to the strict roiMetrics schema field (only the fields above
    // are declared there) — kept in-memory so computeMetricsFramework (Mixed
    // schema) can derive confidenceCollapse and other per-question ROI insights.
    highROIQuestions: highROI,
    mediumROIQuestions: mediumROI,
    lowROIQuestions: lowROI,
  };
};

/**
 * 6. FATIGUE CURVE & ROLLING ACCURACY
 */
const computeFatigueCurve = (responses, params) => {
  const windowSize = params.rolling_window_size || 5;
  const rollingWindows = [];

  // Sort responses by sequence position
  const sorted = [...responses].filter((r) => r.isAttempted).sort((a, b) => (a.sequencePosition ?? a.slotPosition) - (b.sequencePosition ?? b.slotPosition));

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const correct = window.filter((r) => r.isCorrect).length;
    const accuracy = roundTo(safeDiv(correct, windowSize) * 100);

    rollingWindows.push({
      windowIndex: i,
      windowSize,
      startPosition: window[0].sequencePosition ?? window[0].slotPosition,
      endPosition: window[windowSize - 1].sequencePosition ?? window[windowSize - 1].slotPosition,
      accuracy,
      correct,
      total: windowSize,
    });
  }

  // First Drop
  let firstDrop = null;
  let highestSoFar = 0;
  for (const window of rollingWindows) {
    if (window.accuracy > highestSoFar) {
      highestSoFar = window.accuracy;
    }
    if (!firstDrop && window.accuracy < params.critical_accuracy_threshold && window.accuracy < highestSoFar - 10) {
      firstDrop = { windowIndex: window.windowIndex, dropAmount: roundTo(highestSoFar - window.accuracy) };
    }
  }

  // Max Drop
  const accuracies = rollingWindows.map((w) => w.accuracy);
  const maxDrop = accuracies.length > 1 ? roundTo(Math.max(...accuracies) - Math.min(...accuracies)) : 0;

  // Highest & Lowest Spike
  const highestSpike = accuracies.length ? roundTo(Math.max(...accuracies)) : 0;
  const lowestSpike = accuracies.length ? roundTo(Math.min(...accuracies)) : 0;

  // Critical Windows (accuracy < threshold)
  const criticalWindowsCount = rollingWindows.filter((w) => w.accuracy < params.critical_accuracy_threshold).length;

  // Recovery Window
  let recoveryWindow = null;
  let inCritical = false;
  for (const window of rollingWindows) {
    if (window.accuracy < params.critical_accuracy_threshold) {
      inCritical = true;
    }
    if (inCritical && window.accuracy >= params.recovery_accuracy_threshold) {
      recoveryWindow = window.windowIndex;
      break;
    }
  }

  return {
    rollingWindows,
    firstDrop,
    maxDrop,
    highestSpike,
    lowestSpike,
    criticalWindowsCount,
    recoveryWindow,
  };
};

/**
 * 7. STREAK ANALYSIS
 */
const computeStreaks = (responses) => {
  const sorted = [...responses].filter((r) => r.isAttempted).sort((a, b) => (a.sequencePosition ?? a.slotPosition) - (b.sequencePosition ?? b.slotPosition));

  let goodStreaks = [];
  let badStreaks = [];
  let currentGoodStart = null;
  let currentBadStart = null;

  sorted.forEach((r, idx) => {
    if (r.isCorrect) {
      if (currentBadStart !== null) {
        badStreaks.push({ start: currentBadStart, end: idx - 1, length: idx - currentBadStart });
        currentBadStart = null;
      }
      if (currentGoodStart === null) {
        currentGoodStart = idx;
      }
    } else {
      if (currentGoodStart !== null) {
        goodStreaks.push({ start: currentGoodStart, end: idx - 1, length: idx - currentGoodStart });
        currentGoodStart = null;
      }
      if (currentBadStart === null) {
        currentBadStart = idx;
      }
    }
  });

  // Close open streaks
  if (currentGoodStart !== null) {
    goodStreaks.push({ start: currentGoodStart, end: sorted.length - 1, length: sorted.length - currentGoodStart });
  }
  if (currentBadStart !== null) {
    badStreaks.push({ start: currentBadStart, end: sorted.length - 1, length: sorted.length - currentBadStart });
  }

  const goodStreakLength = goodStreaks.length ? Math.max(...goodStreaks.map((s) => s.length)) : 0;
  const badStreakLength = badStreaks.length ? Math.max(...badStreaks.map((s) => s.length)) : 0;

  return {
    goodStreakLength,
    badStreakLength,
    goodStreaks: goodStreaks.slice(0, 10),
    badStreaks: badStreaks.slice(0, 10),
  };
};

/**
 * 8. REATTEMPT ANALYSIS
 */
const computeReattemptMetrics = (responses) => {
  const reattempted = responses.filter((r) => r.wasReattempted);
  const totalReattempts = reattempted.length;
  const answerSwitchCount = responses.reduce((sum, r) => sum + (r.answerChanges || 0), 0);

  const wrongToCorrect = reattempted.filter((r) => r.initialAnswer !== r.correctAnswer && r.finalAnswer === r.correctAnswer).length;
  const correctToWrong = reattempted.filter((r) => r.initialAnswer === r.correctAnswer && r.finalAnswer !== r.correctAnswer).length;
  const wrongToWrong = reattempted.filter((r) => r.initialAnswer !== r.correctAnswer && r.finalAnswer !== r.correctAnswer && r.initialAnswer !== null).length;

  const reattemptRate = roundTo(safeDiv(totalReattempts, responses.filter((r) => r.isAttempted).length) * 100);
  const productiveReattemptRate = roundTo(safeDiv(wrongToCorrect, totalReattempts) * 100);
  const harmfulReattemptRate = roundTo(safeDiv(correctToWrong, totalReattempts) * 100);
  const reattemptAccuracy = roundTo(safeDiv(reattempted.filter((r) => r.isCorrect).length, totalReattempts) * 100);

  return {
    reattemptRate,
    answerSwitchCount,
    productiveReattemptRate,
    harmfulReattemptRate,
    reattemptAccuracy,
    totalReattempts,
    wrongToCorrect,
    correctToWrong,
    wrongToWrong,
  };
};

/**
 * 9. ATTEMPT ORDER QUALITY — Spearman Rank Correlation
 *
 * Measures how well the student's actual attempt sequence aligns with
 * the ideal sequence (highest Priority Score attempted first).
 *
 * Priority Score = (w_roi × normalizedROI) + (w_easy × easyBonus) + (w_marks × normalizedMarks)
 * Ideal Rank     = questions sorted descending by Priority Score
 * Actual Rank    = student's sequencePosition
 *
 * Spearman ρ = 1 - (6 × Σd²) / (n × (n²−1))
 * where d = (idealRank_i − actualRank_i)
 *
 * Unattempted questions get the worst ideal rank (end of sequence)
 * since they were skipped by the student.
 */
const computeAttemptOrderQuality = (responses, params, probabilityMap = {}) => {
  const W_ROI   = parseFloat(params.order_weight_roi)   || 0.5;
  const W_EASY  = parseFloat(params.order_weight_easy)  || 0.3;
  const W_MARKS = parseFloat(params.order_weight_marks) || 0.2;

  const CORRECT_MARKS   = parseFloat(params.correct_marks)   || 4;
  const INCORRECT_MARKS = parseFloat(params.incorrect_marks) || -1;

  // Build priority score for every question
  const withPriority = responses.map((r) => {
    const pCorrect     = pCorrectForResponse(r, probabilityMap);
    const pWrong       = 1 - pCorrect;
    const expectedMark = CORRECT_MARKS * pCorrect + INCORRECT_MARKS * pWrong;
    const timeEstimateMinutes = expectedTimeMinutes(r);
    const roi          = expectedMark > 0 ? expectedMark / timeEstimateMinutes : 0;

    // Easy bonus: extra weight for easy questions (quick wins)
    const easyBonus = r.difficulty === "easy" ? 1 : r.difficulty === "medium" ? 0.5 : 0;

    return {
      slotPosition:  r.slotPosition,
      questionId:    r.questionId,
      subject:       r.subject,
      difficulty:    r.difficulty,
      marks:         r.marks,
      isAttempted:   r.isAttempted,
      sequencePosition: r.sequencePosition,
      roi,
      easyBonus,
      normalizedMarks: r.marks,
      pCorrect,
      expectedMark,
    };
  });

  // Normalize ROI and Marks to [0,1] range so weights are meaningful
  const roiValues   = withPriority.map((q) => q.roi);
  const marksValues = withPriority.map((q) => q.marks);

  const maxROI   = Math.max(...roiValues)   || 1;
  const maxMarks = Math.max(...marksValues) || 1;

  withPriority.forEach((q) => {
    const normROI   = q.roi    / maxROI;
    const normMarks = q.marks  / maxMarks;
    q.priorityScore = roundTo(
      W_ROI * normROI + W_EASY * q.easyBonus + W_MARKS * normMarks,
      4
    );
  });

  // Actual rank from sequencePosition — only sequenced (attempted) questions
  const sequenced = withPriority.filter(
    (q) => q.isAttempted && q.sequencePosition !== null && q.sequencePosition !== undefined
  );

  // If fewer than 5 questions have sequencePosition, we can't compute meaningfully
  if (sequenced.length < 5) {
    return {
      spearmanRho:                       null,
      totalAttempted:                    withPriority.filter((q) => q.isAttempted).length,
      totalSequenced:                    sequenced.length,
      sequenceCoverage:                  roundTo(safeDiv(sequenced.length, withPriority.filter((q) => q.isAttempted).length) * 100),
      interpretation:                    "insufficient_data",
      estimatedExtraMarksFromBetterOrder: 0,
      highROIAttemptedLate:              [],
      lowROIAttemptedEarly:              [],
      questionOrderDetails:              [],
      priorityWeights:                   { roi: W_ROI, easyBonus: W_EASY, marks: W_MARKS },
    };
  }

  // Ideal rank: descending by priorityScore, scoped to the SEQUENCED subset only
  // (rank 1 = highest priority). Spearman's simplified d² formula requires both
  // rankings to be permutations of the same 1..n — ranking idealRank against the
  // full question set while actualRank only covers the sequenced subset would mix
  // two differently-sized rank sets and can push ρ outside the valid [-1, 1] range.
  const idealSorted = [...sequenced].sort(
    (a, b) => b.priorityScore - a.priorityScore
  );
  idealSorted.forEach((q, idx) => {
    q.idealRank = idx + 1;
  });

  // Re-rank actual sequence: rank within sequenced questions by sequencePosition ascending
  const actualSorted = [...sequenced].sort(
    (a, b) => a.sequencePosition - b.sequencePosition
  );
  actualSorted.forEach((q, idx) => {
    q.actualRank = idx + 1;
  });

  // Non-sequenced attempted questions get worst actual rank
  withPriority.forEach((q) => {
    if (q.actualRank === undefined) {
      q.actualRank = sequenced.length + 1; // worst rank bucket
    }
  });

  // Compute Spearman ρ only over sequenced questions
  // Build a map: slotPosition → idealRank (within the sequenced subset)
  const idealRankMap = {};
  sequenced.forEach((q) => {
    idealRankMap[q.slotPosition] = q.idealRank;
  });

  // Compute d² for each sequenced question
  let sumD2 = 0;
  const n   = sequenced.length;

  sequenced.forEach((q) => {
    const d  = idealRankMap[q.slotPosition] - q.actualRank;
    q.rankDifference = d;
    sumD2 += d * d;
  });

  const spearmanRho = n > 1
    ? roundTo(1 - (6 * sumD2) / (n * (n * n - 1)), 4)
    : null;

  // Interpretation bands
  let interpretation;
  if (spearmanRho === null)    interpretation = "insufficient_data";
  else if (spearmanRho >= 0.7) interpretation = "excellent";
  else if (spearmanRho >= 0.4) interpretation = "good";
  else if (spearmanRho >= 0.1) interpretation = "average";
  else if (spearmanRho >= -0.3) interpretation = "needs_improvement";
  else                          interpretation = "poor";

  // Actionable insights — "high/low ROI" here uses the same RELATIVE
  // classification as computeROIMetrics (top 25% / bottom 25% of THIS test's
  // questions by ROI), not a fixed cutoff, unless the sprint opted into the
  // legacy "absolute" method.
  const method = params.roi_classification_method || ROI_CLASSIFICATION.method;
  const roiClassOf = new Map();
  if (method === "absolute") {
    const hi = parseFloat(params.high_roi_threshold) || ROI_CLASSIFICATION.absoluteHigh;
    const lo = parseFloat(params.low_roi_threshold) || ROI_CLASSIFICATION.absoluteLow;
    withPriority.forEach((q, i) => roiClassOf.set(i, q.roi >= hi ? "high" : q.roi < lo ? "low" : "medium"));
  } else {
    const cls = classifyRoiByPercentile(withPriority, (q) => q.roi, {
      highPercentile: parseFloat(params.roi_high_percentile) || ROI_CLASSIFICATION.highPercentile,
      lowPercentile: parseFloat(params.roi_low_percentile) || ROI_CLASSIFICATION.lowPercentile,
    });
    withPriority.forEach((_, i) => roiClassOf.set(i, cls.classOf.get(i)));
  }
  const idxOf = new Map(withPriority.map((q, i) => [q, i]));
  const roiClass = (q) => roiClassOf.get(idxOf.get(q));

  // High-ROI questions that were attempted late (idealRank much better than actualRank)
  const highROIAttemptedLate = sequenced
    .filter((q) => roiClass(q) === "high" && q.rankDifference > 10)
    .sort((a, b) => b.rankDifference - a.rankDifference)
    .slice(0, 5)
    .map((q) => ({
      slotPosition:         q.slotPosition,
      questionId:           q.questionId,
      subject:              q.subject,
      difficulty:           q.difficulty,
      priorityScore:        q.priorityScore,
      idealRank:            idealRankMap[q.slotPosition],
      actualRank:           q.actualRank,
      rankDifference:       q.rankDifference,
      estimatedExtraMarks:  roundTo(q.expectedMark * 0.1), // 10% fatigue-adjusted estimate
    }));

  // Low-ROI questions that were attempted early (actualRank much better than idealRank)
  const lowROIAttemptedEarly = sequenced
    .filter((q) => roiClass(q) === "low" && q.rankDifference < -10)
    .sort((a, b) => a.rankDifference - b.rankDifference)
    .slice(0, 5)
    .map((q) => ({
      slotPosition:   q.slotPosition,
      questionId:     q.questionId,
      subject:        q.subject,
      difficulty:     q.difficulty,
      priorityScore:  q.priorityScore,
      idealRank:      idealRankMap[q.slotPosition],
      actualRank:     q.actualRank,
      rankDifference: q.rankDifference,
    }));

  // Estimated extra marks from better ordering
  const estimatedExtraMarksFromBetterOrder = roundTo(
    highROIAttemptedLate.reduce((s, q) => s + q.estimatedExtraMarks, 0)
  );

  // Full question order detail (for frontend chart)
  const questionOrderDetails = sequenced.map((q) => ({
    slotPosition:   q.slotPosition,
    questionId:     q.questionId,
    subject:        q.subject,
    difficulty:     q.difficulty,
    priorityScore:  q.priorityScore,
    idealRank:      idealRankMap[q.slotPosition],
    actualRank:     q.actualRank,
    rankDifference: q.rankDifference,
    roi:            roundTo(q.roi, 4),
    marks:          q.marks,
    isAttempted:    q.isAttempted,
  }));

  return {
    spearmanRho,
    totalAttempted:                    withPriority.filter((q) => q.isAttempted).length,
    totalSequenced:                    n,
    sequenceCoverage:                  roundTo(safeDiv(n, withPriority.filter((q) => q.isAttempted).length) * 100),
    interpretation,
    estimatedExtraMarksFromBetterOrder,
    highROIAttemptedLate,
    lowROIAttemptedEarly,
    questionOrderDetails,
    priorityWeights:                   { roi: W_ROI, easyBonus: W_EASY, marks: W_MARKS },
  };
};

const computeMetricsFramework = (
  responses,
  params,
  foundation,
  timeMetrics,
  difficultyMetrics,
  errorClassification,
  roiMetrics,
  fatigueCurve,
  streakMetrics,
  reattemptMetrics,
  attemptOrderQuality,
  seenQuestionIds = new Set(),
  priorWrongQuestionIds = new Set()
) => {
  const totalQuestions = responses.length;
  const attempted = responses.filter((r) => r.isAttempted);
  const wrong = responses.filter((r) => r.isAttempted && !r.isCorrect);
  const unattempted = responses.filter((r) => !r.isAttempted);
  const correct = responses.filter((r) => r.isCorrect);
  const attemptedTimes = attempted.map((r) => r.timeSpentSeconds || 0);
  const totalTime = responses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0);
  const totalMinutes = Math.max(totalTime / 60, 0.01);
  const sortedBySlot = [...responses].sort((a, b) => (a.slotPosition || 0) - (b.slotPosition || 0));
  const sortedByAttempt = [...attempted].sort(
    (a, b) => (a.sequencePosition ?? a.slotPosition ?? 0) - (b.sequencePosition ?? b.slotPosition ?? 0)
  );

  const firstN = sortedByAttempt.slice(0, Math.min(10, sortedByAttempt.length));

  // Spec formula: First Attempt Accuracy % = Correct on 1st attempt / Total 1st
  // attempts — i.e. was the FIRST answer given (before any reattempt/answer-change)
  // correct, across every attempted question. `initialAnswer` is captured by the
  // frontend the moment a question is first answered, whether or not it was
  // later changed. This is distinct from "First-N Accuracy" (category 10), which
  // is scoped to the first N questions by exam sequence, not first-click accuracy.
  const firstAttemptCorrectCount = attempted.filter((r) => {
    const firstAns = r.initialAnswer ?? r.selectedAnswer;
    return firstAns != null && r.correctAnswer != null && firstAns === r.correctAnswer;
  }).length;
  const firstAttemptAccuracyPercent = pct(firstAttemptCorrectCount, attempted.length);

  const firstAnswerTimes = attempted
    .map((r) => r.firstAnswerTimeSeconds)
    .filter((v) => Number.isFinite(v));
  const firstAttemptTime = firstAnswerTimes.length
    ? Math.min(...firstAnswerTimes)
    : (sortedByAttempt[0]?.timeSpentSeconds || 0);

  const subjectMap = {};
  const topicMap = {};
  const typeMap = {};
  const difficultyMap = {};
  for (const r of responses) {
    const subject = r.subject || "unknown";
    const topicKey = `${subject}__${r.chapter || ""}__${r.topic || ""}`;
    const type = String(r.questionType || "mcq").toLowerCase();
    const difficulty = String(r.difficulty || "unknown").toLowerCase();
    subjectMap[subject] = subjectMap[subject] || [];
    topicMap[topicKey] = topicMap[topicKey] || [];
    typeMap[type] = typeMap[type] || [];
    difficultyMap[difficulty] = difficultyMap[difficulty] || [];
    subjectMap[subject].push(r);
    topicMap[topicKey].push(r);
    typeMap[type].push(r);
    difficultyMap[difficulty].push(r);
  }

  const topicDetails = Object.entries(topicMap).map(([key, items]) => {
    const [subject, chapter, topic] = key.split("__");
    return {
      subject,
      chapter,
      topic,
      totalQuestions: items.length,
      attempted: items.filter((r) => r.isAttempted).length,
      correct: items.filter((r) => r.isCorrect).length,
      accuracy: accuracyFor(items),
      attemptRate: attemptedRateFor(items),
    };
  });

  const weakTopics = topicDetails.filter((t) => t.attempted > 0 && t.accuracy < (params.weak_topic_accuracy_threshold || 40));
  const strongTopics = topicDetails.filter((t) => t.attempted > 0 && t.accuracy >= (params.strong_topic_accuracy_threshold || 80));
  const topicROI = topicDetails
    .map((t) => ({ ...t, roiScore: roundTo((t.accuracy / 100) * t.totalQuestions * (t.attemptRate / 100), 4) }))
    .sort((a, b) => b.roiScore - a.roiScore);

  const questionTypeCoverage = Object.entries(typeMap).map(([questionType, items]) => ({
    questionType,
    totalQuestions: items.length,
    attempted: items.filter((r) => r.isAttempted).length,
    correct: items.filter((r) => r.isCorrect).length,
    accuracy: accuracyFor(items),
    coverage: attemptedRateFor(items),
  }));

  const typeAccuracy = (matcher) => {
    const items = responses.filter(matcher);
    return {
      totalQuestions: items.length,
      attempted: items.filter((r) => r.isAttempted).length,
      correct: items.filter((r) => r.isCorrect).length,
      accuracy: accuracyFor(items),
    };
  };

  const half = Math.ceil(sortedBySlot.length / 2);
  const firstHalf = sortedBySlot.slice(0, half);
  const secondHalf = sortedBySlot.slice(half);
  const firstHalfAccuracy = accuracyFor(firstHalf);
  const secondHalfAccuracy = accuracyFor(secondHalf);
  const rollingAccuracies = fatigueCurve.rollingWindows?.map((w) => w.accuracy) || [];

  let slowdownPoint = null;
  const windowSize = Math.min(5, attemptedTimes.length);
  if (windowSize >= 3) {
    const sequencedTimes = sortedByAttempt.map((r) => r.timeSpentSeconds || 0);
    for (let i = windowSize; i <= sequencedTimes.length - windowSize; i++) {
      const before = safeDiv(sequencedTimes.slice(i - windowSize, i).reduce((s, v) => s + v, 0), windowSize);
      const after = safeDiv(sequencedTimes.slice(i, i + windowSize).reduce((s, v) => s + v, 0), windowSize);
      if (after > before * 1.35) {
        slowdownPoint = { attemptIndex: i + 1, beforeAvgSeconds: roundTo(before), afterAvgSeconds: roundTo(after) };
        break;
      }
    }
  }

  const reattempted = responses.filter((r) => r.wasReattempted);
  const reattemptDelays = reattempted
    .map((r) => r.reattemptDelaySeconds)
    .filter((v) => Number.isFinite(v));
  const immediateReattempts = reattempted.filter((r) => (r.reattemptDelaySeconds || 0) <= 15).length;
  const consideredReattempts = reattempted.length - immediateReattempts;
  const overthinkingItems = responses.filter((r) => {
    const baseline = timeMetrics.avgTimePerQuestion || 1;
    return r.isAttempted && !r.isCorrect && (r.timeSpentSeconds || 0) > baseline * 1.5;
  });

  const alternations = sortedByAttempt.reduce((count, r, idx, arr) => {
    if (idx === 0) return count;
    return count + (arr[idx - 1].isCorrect !== r.isCorrect ? 1 : 0);
  }, 0);

  return {
    foundation: {
      totalAttempts: totalQuestions,
      accuracyPercent: foundation.accuracy,
      attemptRatePercent: foundation.attemptRate,
      score: foundation.totalScore,
      correctQuestions: foundation.correct,
      wrongQuestions: foundation.incorrect,
      unattemptedQuestions: foundation.unattempted,
      guessRatePercent: errorClassification.guessRate,
      carelessErrorRatePercent: errorClassification.carelessErrorRate,
      sillyMistakeCount: errorClassification.sillyMistakes,
      firstAttemptAccuracyPercent,
      reattemptAccuracyPercent: reattemptMetrics.reattemptAccuracy,
    },
    timeSpeed: {
      totalTimeSeconds: totalTime,
      avgTimePerQuestionSeconds: timeMetrics.avgTimePerQuestion,
      medianTimePerQuestionSeconds: median(attemptedTimes),
      timePerCorrectAnswerSeconds: roundTo(safeDiv(correct.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), correct.length)),
      timePerWrongAnswerSeconds: roundTo(safeDiv(wrong.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), wrong.length)),
      timePerUnattemptedSeconds: roundTo(safeDiv(unattempted.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), unattempted.length)),
      firstAttemptTimeSeconds: firstAttemptTime,
      speedIndex: roundTo(foundation.attempted / totalMinutes),
      speedConsistencySeconds: timeMetrics.standardDeviation,
      slowdownPoint,
      timeMisallocationSeconds: wrong.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0),
    },
    accuracyErrors: {
      overallAccuracyPercent: foundation.accuracy,
      subjectAccuracy: Object.entries(subjectMap).map(([subject, items]) => ({
        subject,
        accuracy: accuracyFor(items),
        attempted: items.filter((r) => r.isAttempted).length,
        correct: items.filter((r) => r.isCorrect).length,
      })),
      topicAccuracy: topicDetails,
      errorRatePercent: pct(wrong.length, attempted.length),
      sillyMistakeRatePercent: errorClassification.sillyMistakeRate,
      conceptualErrorRatePercent: errorClassification.conceptErrorRate,
      // Heuristic proxy: a true conceptual-vs-calculation split needs question-level
      // error-type tagging, which doesn't exist in the content model. Instead of the
      // old subject-stereotype proxy (any wrong Physics/Chemistry answer counted as
      // "calculation"), this uses real per-response signals already captured: wrong
      // answers on numeric/integer-type questions where the student spent at least
      // half the average wrong-answer time (i.e. they worked the problem rather than
      // guessed) are classified as likely calculation slips.
      calculationErrorRatePercent: (() => {
        const avgWrongTime = safeDiv(wrong.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), wrong.length);
        const calcErrors = wrong.filter((r) => {
          const qType = String(r.questionType || "").toLowerCase();
          const isNumericType = qType.includes("numeric") || qType.includes("integer");
          return isNumericType && (r.timeSpentSeconds || 0) >= avgWrongTime * 0.5;
        });
        return pct(calcErrors.length, wrong.length);
      })(),
      confidenceAccuracyGapPercent: roundTo(
        Math.abs(safeDiv(attempted.reduce((s, r) => s + (r.confidence || 50), 0), attempted.length) - foundation.accuracy)
      ),
      // Spec: wrong despite high confidence, specifically in high-ROI (high-weightage) subjects.
      confidenceCollapseCount: (roiMetrics.highROIQuestions || []).filter(
        (r) => r.isAttempted && !r.isCorrect && (r.confidence || 0) >= params.silly_mistake_confidence_threshold
      ).length,
      // Genuine accuracy among high-ROI questions — distinct from highROICoverage
      // (content.highROIQuestions.coveragePercent below), which is attempt-coverage.
      highROIAccuracyPercent: roiMetrics.highROIAccuracy,
      // "Known" = a question this student has answered in any prior submitted attempt
      // (tracked via seenQuestionIds, built from attempt history — see computeAdvancedAnalytics).
      knownQuestionAccuracyPercent: accuracyFor(responses.filter((r) => seenQuestionIds.has(String(r.questionId)))),
    },
    content: {
      questionsAttempted: foundation.attempted,
      questionsCorrect: foundation.correct,
      questionsWrong: foundation.incorrect,
      questionsUnattempted: foundation.unattempted,
      questionTypeCoverage,
      topicCoveragePercent: pct(topicDetails.filter((t) => t.attempted > 0).length, topicDetails.length),
      highROIQuestions: {
        coveragePercent: roiMetrics.highROICoverage,
        scoreOpportunityIndex: roiMetrics.scoreOpportunityIndex,
      },
      // ROI Classification Framework — relative (top 25% / mid 50% / bottom 25%).
      roiClassification: {
        method: roiMetrics.roiClassificationMethod,
        highCount: roiMetrics.highROICount,
        mediumCount: roiMetrics.mediumROICount,
        lowCount: roiMetrics.lowROICount,
        highCoveragePercent: roiMetrics.highROICoverage,
        mediumAttemptsPercent: roiMetrics.mediumROIAttempts,
        lowAttemptsPercent: roiMetrics.lowROIAttempts,
        cutoffs: roiMetrics.roiPercentileCutoffs,
      },
      // "Repeated" = a question the student has seen in a prior submitted attempt
      // (cross-exam), not a within-this-attempt reattempt (that's a different
      // concept, covered under reattemptBehavior below).
      newVsRepeated: {
        repeatedAttempted: attempted.filter((r) => seenQuestionIds.has(String(r.questionId))).length,
        repeatedAccuracyPercent: accuracyFor(attempted.filter((r) => seenQuestionIds.has(String(r.questionId)))),
        newAttempted: attempted.filter((r) => !seenQuestionIds.has(String(r.questionId))).length,
        newAccuracyPercent: accuracyFor(attempted.filter((r) => !seenQuestionIds.has(String(r.questionId)))),
      },
      assertionAccuracy: typeAccuracy((r) => String(r.questionType || "").toLowerCase().includes("assertion")),
      numericAccuracy: typeAccuracy((r) => String(r.questionType || "").toLowerCase().includes("numeric") || String(r.questionType || "").toLowerCase().includes("integer")),
      imageBasedAccuracy: typeAccuracy((r) => r.hasImage),
    },
    difficulty: {
      breakdown: difficultyMetrics,
      scoreContribution: Object.entries(difficultyMap).map(([difficulty, items]) => ({
        difficulty,
        score: items.reduce((s, r) => s + (r.isAttempted ? (r.isCorrect ? (r.marks || params.correct_marks) : -(r.negativeMarks || Math.abs(params.incorrect_marks))) : 0), 0),
        accuracy: accuracyFor(items),
      })),
      performanceConsistencyPercent: stdDev(difficultyMetrics.map((d) => d.accuracy || 0)),
      fallRatePercent: Math.max(0, roundTo(firstHalfAccuracy - secondHalfAccuracy)),
      spikePoint: {
        high: fatigueCurve.highestSpike,
        low: fatigueCurve.lowestSpike,
      },
      recoveryPoint: fatigueCurve.recoveryWindow,
    },
    reattemptBehavior: {
      ...reattemptMetrics,
      // Distinct from reattemptDelaySeconds below: this is how much MORE time was
      // spent finalizing the answer after the first click (lastAnswerTime minus
      // firstAnswerTime), not the gap before reattempting.
      timeChangeOnReattemptSeconds: (() => {
        const changes = reattempted
          .map((r) => (Number.isFinite(r.lastAnswerTimeSeconds) && Number.isFinite(r.firstAnswerTimeSeconds))
            ? r.lastAnswerTimeSeconds - r.firstAnswerTimeSeconds
            : null)
          .filter((v) => v !== null);
        return roundTo(safeDiv(changes.reduce((s, v) => s + v, 0), changes.length));
      })(),
      reattemptDelaySeconds: roundTo(safeDiv(reattemptDelays.reduce((s, v) => s + v, 0), reattemptDelays.length)),
      smartVsBlind: {
        consideredReattempts,
        immediateReattempts,
        smartRatePercent: pct(consideredReattempts, reattempted.length),
      },
      reattemptEfficiencyPercent: reattemptMetrics.productiveReattemptRate,
      // Within this single attempt: wrong on first try, still wrong after reattempting.
      repeatedWrongQuestions: reattemptMetrics.wrongToWrong,
      // Across exams: wrong this time on a question also gotten wrong in a prior
      // submitted attempt (needs cross-attempt history — see priorWrongQuestionIds).
      repeatedWrongQuestionsCrossTest: wrong.filter((r) => priorWrongQuestionIds.has(String(r.questionId))).length,
      overthinkingIndex: overthinkingItems.length,
    },
    subjectTopic: {
      subjectWiseScore: Object.entries(subjectMap).map(([subject, items]) => ({
        subject,
        score: items.reduce((s, r) => s + (r.marksAwarded || 0), 0),
        accuracy: accuracyFor(items),
        attemptRate: attemptedRateFor(items),
      })),
      topicWiseAccuracy: topicDetails,
      weakTopics: weakTopics.slice(0, 20),
      strongTopics: strongTopics.slice(0, 20),
      topicROI: topicROI.slice(0, 20),
      // NOTE: true cross-test Topic Progression (a topic's accuracy trend across
      // multiple exams over time) cannot be computed from a single attempt — it's
      // implemented at the sprint level instead, see getStudentSprintSummary's
      // `topicProgression` field in analytics.controller.js.
    },
    streakPattern: {
      ...streakMetrics,
      rightWrongAlternationCount: alternations,
      patternOfErrors: {
        consecutiveWrongMax: streakMetrics.badStreakLength,
        alternationRatePercent: pct(alternations, Math.max(sortedByAttempt.length - 1, 0)),
      },
      // Most common exam-position quartile where a correct-answer streak breaks.
      streakBreakPoint: (() => {
        if (!sortedByAttempt.length || !streakMetrics.goodStreaks?.length) return null;
        const total = sortedByAttempt.length;
        const quartileCounts = [0, 0, 0, 0];
        streakMetrics.goodStreaks.forEach((s) => {
          const breakIdx = s.end + 1;
          const q = Math.min(3, Math.floor((breakIdx / total) * 4));
          quartileCounts[q]++;
        });
        const maxCount = Math.max(...quartileCounts);
        if (maxCount === 0) return null;
        const modalQuartile = quartileCounts.indexOf(maxCount);
        const labels = ["Q1 (early)", "Q2 (early-mid)", "Q3 (mid-late)", "Q4 (late)"];
        return { quartile: modalQuartile + 1, label: labels[modalQuartile], breakCount: maxCount, distributionByQuartile: quartileCounts };
      })(),
    },
    fatigueRecovery: {
      ...fatigueCurve,
      fatigueCurve: fatigueCurve.rollingWindows || [],
      accuracyRecovery: fatigueCurve.recoveryWindow,
      peakPerformanceWindow: fatigueCurve.rollingWindows?.reduce((best, w) => (!best || w.accuracy > best.accuracy ? w : best), null) || null,
      subjectFatigue: Object.entries(subjectMap).map(([subject, items]) => {
        const ordered = [...items].sort((a, b) => (a.slotPosition || 0) - (b.slotPosition || 0));
        const split = Math.ceil(ordered.length / 2);
        return {
          subject,
          firstHalfAccuracy: accuracyFor(ordered.slice(0, split)),
          secondHalfAccuracy: accuracyFor(ordered.slice(split)),
          dropPercent: Math.max(0, roundTo(accuracyFor(ordered.slice(0, split)) - accuracyFor(ordered.slice(split)))),
        };
      }),
      // Genuine within-exam fatigue signal: accuracy decline from the first half
      // to the second half of a topic's questions (needs >=2 attempted questions
      // to be meaningful) — distinct from "weak topics" (a flat accuracy<threshold
      // classification with no time dimension).
      topicFatigue: topicDetails
        .filter((t) => t.attempted >= 2)
        .map((t) => {
          const items = topicMap[`${t.subject}__${t.chapter}__${t.topic}`] || [];
          const ordered = [...items].sort((a, b) => (a.slotPosition || 0) - (b.slotPosition || 0));
          const split = Math.ceil(ordered.length / 2);
          const firstHalfAccuracy = accuracyFor(ordered.slice(0, split));
          const secondHalfAccuracy = accuracyFor(ordered.slice(split));
          return {
            subject: t.subject,
            chapter: t.chapter,
            topic: t.topic,
            firstHalfAccuracy,
            secondHalfAccuracy,
            dropPercent: Math.max(0, roundTo(firstHalfAccuracy - secondHalfAccuracy)),
          };
        })
        .filter((t) => t.dropPercent > 0)
        .sort((a, b) => b.dropPercent - a.dropPercent)
        .slice(0, 20),
    },
    foundationTimeSpeedDetail: {
      foundationTimeSeconds: firstAttemptTime,
      firstNAccuracyPercent: accuracyFor(firstN),
      earlySpeedSeconds: roundTo(safeDiv(firstN.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), firstN.length)),
      // Real "Early Accuracy Stability" per spec: how much accuracy fluctuates
      // within the first N questions, via small rolling-window accuracy stdDev
      // (lower = more stable). Previously this field held a TIME-spread stdDev
      // under an "accuracy stability" name — kept below as earlyTimeSpreadSeconds
      // (honestly named) instead of silently dropped, since it's still a useful figure.
      earlyAccuracyStabilityPercent: (() => {
        const windowSize = Math.min(3, firstN.length);
        if (windowSize < 2) return 0;
        const rollingAcc = [];
        for (let i = 0; i <= firstN.length - windowSize; i++) {
          rollingAcc.push(accuracyFor(firstN.slice(i, i + windowSize)));
        }
        return stdDev(rollingAcc);
      })(),
      earlyTimeSpreadSeconds: stdDev(firstN.map((r) => r.timeSpentSeconds || 0)),
      momentumScore: roundTo((accuracyFor(firstN) * Math.max(firstN.length, 1)) / Math.max(safeDiv(firstN.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0), 60), 1)),
    },
    attemptOrderQuality,
  };
};
const computeAdvancedAnalytics = async (attempt, analyticsResultId) => {
  const params    = await loadFormulaParams(attempt.sprint);
  const responses = attempt.responses;

  // Load student probability map for ROI & order quality computations
  const { getProbabilityMap } = require("./probability.service");
  const probabilityMap = await getProbabilityMap(attempt.student, attempt.sprint);

  // Cross-attempt history — needed for "known question" / "repeated question"
  // metrics, which require knowing what this student has seen/gotten wrong in
  // PRIOR submitted attempts (any sprint, since the question bank can reuse
  // questions across exams). Bounded to the most recent 50 attempts and a
  // narrow projection to keep this cheap — it only runs once per submission,
  // in the async post-submit pipeline, not on the request/response path.
  const Attempt = require("../models/Attempt.model");
  const { ATTEMPT_STATUS } = require("../config/constants");
  const priorAttempts = await Attempt.find({
    student: attempt.student,
    status: ATTEMPT_STATUS.SUBMITTED,
    _id: { $ne: attempt._id },
  })
    .select("responses.questionId responses.isAttempted responses.isCorrect")
    .sort({ submittedAt: -1 })
    .limit(50)
    .lean();

  const seenQuestionIds = new Set();
  const priorWrongQuestionIds = new Set();
  for (const pa of priorAttempts) {
    for (const r of pa.responses || []) {
      if (!r.questionId) continue;
      const idStr = String(r.questionId);
      seenQuestionIds.add(idStr);
      if (r.isAttempted && !r.isCorrect) priorWrongQuestionIds.add(idStr);
    }
  }

  // Historical per-topic accuracy for silly-mistake classification — chapter-level
  // P(correct) from the probability engine is the best available "how good is
  // this student normally at this area" signal (topic-level history isn't
  // tracked separately anywhere in the data model).
  const historicalAccuracy = {};
  for (const r of responses) {
    const topicKey = `${r.subject}_${r.chapter}_${r.topic}`;
    if (historicalAccuracy[topicKey] !== undefined) continue;
    const chapterProb = probabilityMap[`${r.subject}_${r.chapter}`];
    historicalAccuracy[topicKey] = chapterProb ? roundTo(chapterProb.pEasy * 100) : 50;
  }

  // 1. Foundation
  const foundation = computeFoundationMetrics(responses, params);

  // 2. Time Metrics
  const timeMetrics = computeTimeMetrics(responses);

  // 3. Difficulty Metrics
  const difficultyMetrics = computeDifficultyMetrics(responses);

  // 4. Error Classification
  const errorClassification = classifyErrors(responses, params, historicalAccuracy);

  // 5. ROI Metrics
  const sillyMistakeQuestionIds = new Set(
    (errorClassification.sillyMistakeQuestions || []).map((q) => String(q.questionId))
  );
  const roiMetrics = computeROIMetrics(responses, params, probabilityMap, sillyMistakeQuestionIds);

  // 6. Fatigue Curve
  const fatigueCurve = computeFatigueCurve(responses, params);

  // 7. Streaks
  const streakMetrics = computeStreaks(responses);

  // 8. Reattempts
  const reattemptMetrics = computeReattemptMetrics(responses);

  // 9. Attempt Order Quality — Spearman Rank Correlation
  const attemptOrderQuality = computeAttemptOrderQuality(responses, params, probabilityMap);

  const metricsFramework = computeMetricsFramework(
    responses,
    params,
    foundation,
    timeMetrics,
    difficultyMetrics,
    errorClassification,
    roiMetrics,
    fatigueCurve,
    streakMetrics,
    reattemptMetrics,
    attemptOrderQuality,
    seenQuestionIds,
    priorWrongQuestionIds
  );

  const result = await AdvancedAnalytics.findOneAndUpdate(
    { attempt: attempt._id },
    {
      analyticsResult:    analyticsResultId,
      attempt:            attempt._id,
      student:            attempt.student,
      sprint:             attempt.sprint,
      errorClassification,
      roiMetrics,
      fatigueCurve,
      streakMetrics,
      reattemptMetrics,
      timeDistribution:   difficultyMetrics,
      timeVariance: {
        variance:           timeMetrics.variance,
        standardDeviation:  timeMetrics.standardDeviation,
        avgTimeOnCorrect:   timeMetrics.avgTimeOnCorrect,
        avgTimeOnIncorrect: timeMetrics.avgTimeOnIncorrect,
      },
      attemptOrderQuality,
      metricsFramework,
      computedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );

  return result;
};

module.exports = { computeAdvancedAnalytics };
