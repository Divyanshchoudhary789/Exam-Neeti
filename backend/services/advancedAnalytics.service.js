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

// Constants from client formulas
const DEFAULTS = {
  correct_marks: 4,
  incorrect_marks: -1,
  silly_mistake_confidence_threshold: 80,
  concept_error_confidence_min: 50,
  concept_error_confidence_max: 80,
  guess_confidence_threshold: 50,
  guess_time_factor: 0.6,
  high_roi_threshold: 2.5,
  low_roi_threshold: 1.5,
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

const safeDiv = (num, denom) => (denom === 0 ? 0 : parseFloat((num / denom).toFixed(4)));
const roundTo = (val, decimals = 2) => parseFloat(val.toFixed(decimals));

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
  const totalScore = responses.reduce((sum, r) => {
    if (!r.isAttempted) return sum;
    return sum + (r.isCorrect ? params.correct_marks : params.incorrect_marks);
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
  const avgTimePerQuestion = roundTo(safeDiv(totalTime, attempted.length));

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
      };
    }
    const d = difficultyMap[key];
    d.total++;
    if (r.isAttempted) {
      d.attempted++;
      if (r.isCorrect) d.correct++;
    }
    d.totalTime += r.timeSpentSeconds || 0;
  });

  const difficultyBreakdown = Object.values(difficultyMap).map((d) => ({
    difficulty: d.difficulty,
    subject: d.subject,
    totalQuestions: d.total,
    attempted: d.attempted,
    correct: d.correct,
    accuracy: roundTo(safeDiv(d.correct, d.attempted) * 100),
    attemptRate: roundTo(safeDiv(d.attempted, d.total) * 100),
    avgTimeSeconds: roundTo(safeDiv(d.totalTime, d.attempted)),
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

  const avgTime = safeDiv(
    responses.reduce((s, r) => s + (r.timeSpentSeconds || 0), 0),
    responses.filter((r) => r.isAttempted).length
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
    // Concept Error: Medium confidence + slow time + wrong
    else if (
      !r.isCorrect &&
      confidence >= params.concept_error_confidence_min &&
      confidence < params.concept_error_confidence_max &&
      timeSpent > avgTime * 1.2
    ) {
      conceptErrors.push({ questionId: r.questionId, slotPosition: r.slotPosition });
    }
  });

  const attempted = responses.filter((r) => r.isAttempted).length;

  return {
    sillyMistakes: sillyMistakes.length,
    sillyMistakeRate: roundTo(safeDiv(sillyMistakes.length, attempted) * 100),
    conceptErrors: conceptErrors.length,
    conceptErrorRate: roundTo(safeDiv(conceptErrors.length, attempted) * 100),
    guesses: guesses.length,
    guessRate: roundTo(safeDiv(guesses.length, attempted) * 100),
    sillyMistakeQuestions: sillyMistakes,
    conceptErrorQuestions: conceptErrors,
    guessQuestions: guesses,
  };
};

/**
 * 5. ROI METRICS
 * Expected ROI = (4 × P(C) - 1 × P(W)) / Expected Time
 * High ROI Coverage = Attempted High ROI / Total High ROI
 * Low ROI Attempts = Attempted Low ROI / Total Low ROI
 * Score Opportunity Index = Sum of all avoidable losses
 */
const computeROIMetrics = (responses, params, historicalProbability = {}) => {
  const roiMap = responses.map((r) => {
    const topicKey = `${r.subject}_${r.chapter}_${r.topic}`;
    const pCorrect = historicalProbability[topicKey] || (r.difficulty === "easy" ? 0.6 : r.difficulty === "medium" ? 0.45 : 0.3);
    const pWrong = 1 - pCorrect;
    const expectedMarks = params.correct_marks * pCorrect + params.incorrect_marks * pWrong;
    const avgTime = r.timeSpentSeconds || 60;
    const roi = safeDiv(expectedMarks, avgTime);

    return { ...r, roi, pCorrect, expectedMarks };
  });

  const highROI = roiMap.filter((r) => r.roi >= params.high_roi_threshold);
  const lowROI = roiMap.filter((r) => r.roi < params.low_roi_threshold);

  const highROICoverage = roundTo(safeDiv(highROI.filter((r) => r.isAttempted).length, highROI.length) * 100);
  const lowROIAttempts = roundTo(safeDiv(lowROI.filter((r) => r.isAttempted).length, lowROI.length) * 100);

  // Score Opportunity Index
  const sillyMistakesLoss = responses.filter((r) => r.isAttempted && !r.isCorrect && r.difficulty === "easy").length * params.silly_mistake_reward;
  const highROISkippedLoss = highROI.filter((r) => !r.isAttempted).length * params.high_roi_skip_penalty;
  const lowROIAttemptedLoss = lowROI.filter((r) => r.isAttempted && !r.isCorrect).length * params.low_roi_wrong_penalty;
  const guessingLoss = roiMap.filter((r) => r.isAttempted && !r.isCorrect && (r.timeSpentSeconds || 0) < 20).length * params.guess_penalty;

  const scoreOpportunityIndex = roundTo(sillyMistakesLoss + highROISkippedLoss + lowROIAttemptedLoss + guessingLoss);

  return {
    highROICoverage,
    lowROIAttempts,
    scoreOpportunityIndex,
    soiBreakdown: {
      sillyMistakesLoss: roundTo(sillyMistakesLoss),
      highROISkippedLoss: roundTo(highROISkippedLoss),
      lowROIAttemptedLoss: roundTo(lowROIAttemptedLoss),
      guessingLoss: roundTo(guessingLoss),
    },
  };
};

/**
 * 6. FATIGUE CURVE & ROLLING ACCURACY
 */
const computeFatigueCurve = (responses, params) => {
  const windowSize = params.rolling_window_size || 5;
  const rollingWindows = [];

  // Sort responses by sequence position
  const sorted = [...responses].filter((r) => r.isAttempted).sort((a, b) => (a.sequencePosition || a.slotPosition) - (b.sequencePosition || b.slotPosition));

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const correct = window.filter((r) => r.isCorrect).length;
    const accuracy = roundTo(safeDiv(correct, windowSize) * 100);

    rollingWindows.push({
      windowIndex: i,
      windowSize,
      startPosition: window[0].sequencePosition || window[0].slotPosition,
      endPosition: window[windowSize - 1].sequencePosition || window[windowSize - 1].slotPosition,
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
  const sorted = [...responses].filter((r) => r.isAttempted).sort((a, b) => (a.sequencePosition || a.slotPosition) - (b.sequencePosition || b.slotPosition));

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
    const chapterKey = `${r.subject}_${r.chapter}`;
    const probMap    = probabilityMap[chapterKey] || {};

    // P(correct) based on difficulty — use stored probability if available
    let pCorrect;
    if (probMap.pEasy !== undefined) {
      pCorrect =
        r.difficulty === "easy"   ? probMap.pEasy   :
        r.difficulty === "medium" ? probMap.pMedium :
                                    probMap.pHard;
    } else {
      pCorrect =
        r.difficulty === "easy"   ? 0.60 :
        r.difficulty === "medium" ? 0.45 :
                                    0.30;
    }

    const pWrong       = 1 - pCorrect;
    const expectedMark = CORRECT_MARKS * pCorrect + INCORRECT_MARKS * pWrong;
    const timeEstimate = r.timeSpentSeconds > 0 ? r.timeSpentSeconds : 90; // fallback 90s
    const roi          = expectedMark > 0 ? expectedMark / timeEstimate : 0;

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

  // Ideal rank: descending by priorityScore (rank 1 = highest priority)
  const idealSorted = [...withPriority].sort(
    (a, b) => b.priorityScore - a.priorityScore
  );
  idealSorted.forEach((q, idx) => {
    q.idealRank = idx + 1;
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
  // Build a map: slotPosition → idealRank (among ALL questions)
  const idealRankMap = {};
  withPriority.forEach((q) => {
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

  // Actionable insights
  const HIGH_ROI_THRESHOLD = parseFloat(params.high_roi_threshold) || 2.5;
  const LOW_ROI_THRESHOLD  = parseFloat(params.low_roi_threshold)  || 1.5;

  // High-ROI questions that were attempted late (idealRank much better than actualRank)
  const highROIAttemptedLate = sequenced
    .filter((q) => q.roi >= HIGH_ROI_THRESHOLD && q.rankDifference > 10)
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
    .filter((q) => q.roi < LOW_ROI_THRESHOLD && q.rankDifference < -10)
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
const computeAdvancedAnalytics = async (attempt, analyticsResultId) => {
  const params    = await loadFormulaParams(attempt.sprint);
  const responses = attempt.responses;

  // Load student probability map for ROI & order quality computations
  const { getProbabilityMap } = require("./probability.service");
  const probabilityMap = await getProbabilityMap(attempt.student, attempt.sprint);

  // 1. Foundation
  const foundation = computeFoundationMetrics(responses, params);

  // 2. Time Metrics
  const timeMetrics = computeTimeMetrics(responses);

  // 3. Difficulty Metrics
  const difficultyMetrics = computeDifficultyMetrics(responses);

  // 4. Error Classification
  const errorClassification = classifyErrors(responses, params);

  // 5. ROI Metrics
  const roiMetrics = computeROIMetrics(responses, params, probabilityMap);

  // 6. Fatigue Curve
  const fatigueCurve = computeFatigueCurve(responses, params);

  // 7. Streaks
  const streakMetrics = computeStreaks(responses);

  // 8. Reattempts
  const reattemptMetrics = computeReattemptMetrics(responses);

  // 9. Attempt Order Quality — Spearman Rank Correlation
  const attemptOrderQuality = computeAttemptOrderQuality(responses, params, probabilityMap);

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
      computedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );

  return result;
};

module.exports = { computeAdvancedAnalytics };
