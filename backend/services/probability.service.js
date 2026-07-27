/**
 * Probability Service — Initial & Objective Probability Calculations
 * 
 * Implements client formulas:
 * - Questionnaire-based initial probability
 * - P(Medium) = P(Easy) - 15%
 * - P(Hard) = P(Easy) - 35%
 * - Objective probability = Total Correct / Total Attempted across all tests
 * - Switches from questionnaire to objective when test data is available
 * 
 * Also drives ROI computation in analytics.
 */

const StudentProbability = require("../models/StudentProbability.model");

// Medium and Hard offsets from Easy probability — client formula
const MEDIUM_OFFSET = 0.15;
const HARD_OFFSET = 0.35;

const clamp = (val, min = 0.05, max = 0.99) => Math.max(min, Math.min(max, val));

/**
 * Derives medium & hard probabilities from easy probability
 */
const deriveProbabilities = (pEasy) => {
  return {
    pEasy: clamp(pEasy),
    pMedium: clamp(pEasy - MEDIUM_OFFSET),
    pHard: clamp(pEasy - HARD_OFFSET),
  };
};

/**
 * Initialise or update probability from questionnaire
 */
const setQuestionnaireLevel = async (studentId, sprintId, chapterData) => {
  const QUESTIONNAIRE_PROBABILITY = StudentProbability.QUESTIONNAIRE_PROBABILITY;
  const updated = chapterData.map(({ subject, chapter, level }) => {
    const pEasy = QUESTIONNAIRE_PROBABILITY[level] || 0.55;
    return {
      subject,
      chapter,
      source: "questionnaire",
      questionnaireLevel: level,
      ...deriveProbabilities(pEasy),
      updatedAt: new Date(),
    };
  });

  const doc = await StudentProbability.findOneAndUpdate(
    { student: studentId, sprint: sprintId },
    {
      $set: {
        student: studentId,
        sprint: sprintId,
        chapters: updated,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  return doc;
};

/**
 * Update probability with objective data from an attempt
 */
const updateObjectiveProbability = async (studentId, sprintId, attemptId, responses) => {
  const doc = await StudentProbability.findOne({
    student: studentId,
    sprint: sprintId,
  });

  if (!doc) return null;

  // Group responses by chapter
  const chapterMap = {};
  responses.forEach((r) => {
    const key = `${r.subject}__${r.chapter}`;
    if (!chapterMap[key]) {
      chapterMap[key] = { subject: r.subject, chapter: r.chapter, correct: 0, total: 0 };
    }
    if (r.isAttempted) {
      chapterMap[key].total++;
      if (r.isCorrect) chapterMap[key].correct++;
    }
  });

  for (const { subject, chapter, correct, total } of Object.values(chapterMap)) {
    if (total === 0) continue;

    const existing = doc.chapters.find(
      (c) => c.subject === subject && c.chapter === chapter
    );

    if (existing) {
      existing.totalAttempted = (existing.totalAttempted || 0) + total;
      existing.totalCorrect = (existing.totalCorrect || 0) + correct;

      existing.assessmentHistory = existing.assessmentHistory || [];
      existing.assessmentHistory.push({ attemptId, correct, total, date: new Date() });

      // Switch to objective probability
      const pEasy = clamp(existing.totalCorrect / existing.totalAttempted);
      Object.assign(existing, { source: "objective", ...deriveProbabilities(pEasy), updatedAt: new Date() });
    } else {
      const pEasy = clamp(correct / total);
      doc.chapters.push({
        subject,
        chapter,
        source: "objective",
        questionnaireLevel: null,
        ...deriveProbabilities(pEasy),
        totalAttempted: total,
        totalCorrect: correct,
        assessmentHistory: [{ attemptId, correct, total, date: new Date() }],
        updatedAt: new Date(),
      });
    }
  }

  await doc.save();
  return doc;
};

/**
 * Returns a flat probability map by chapter for analytics use
 * e.g. { "biology_genetics": { pEasy: 0.8, pMedium: 0.65, pHard: 0.45 } }
 */
const getProbabilityMap = async (studentId, sprintId) => {
  const doc = await StudentProbability.findOne({
    student: studentId,
    sprint: sprintId,
  }).lean();

  if (!doc) return {};

  const map = {};
  for (const c of doc.chapters) {
    const key = `${c.subject}_${c.chapter}`;
    map[key] = { pEasy: c.pEasy, pMedium: c.pMedium, pHard: c.pHard, source: c.source };
  }
  return map;
};

module.exports = {
  setQuestionnaireLevel,
  updateObjectiveProbability,
  getProbabilityMap,
  deriveProbabilities,
};
