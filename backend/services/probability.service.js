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

const TOTAL_SYLLABUS_CHAPTERS = 86;

/**
 * Formats probability doc to ensure readinessIndex is included
 */
const formatDocWithReadiness = (doc) => {
  if (!doc) return null;
  const plainDoc = typeof doc.toObject === "function" ? doc.toObject({ virtuals: true }) : { ...doc };
  const chapters = plainDoc.chapters || [];
  const assessedCount = chapters.length;
  const sum = chapters.reduce((acc, c) => acc + (c.pEasy || 0), 0);

  plainDoc.assessedCount = assessedCount;
  plainDoc.totalSyllabusChapters = TOTAL_SYLLABUS_CHAPTERS;
  plainDoc.assessedAverage = assessedCount > 0 ? Math.round((sum / assessedCount) * 100) : 0;
  plainDoc.readinessIndex = Math.round((sum / TOTAL_SYLLABUS_CHAPTERS) * 100);

  return plainDoc;
};

/**
 * Initialise or update probability from questionnaire (merging chapter ratings)
 */
const setQuestionnaireLevel = async (studentId, sprintId, chapterData) => {
  const QUESTIONNAIRE_PROBABILITY = StudentProbability.QUESTIONNAIRE_PROBABILITY;

  let doc = await StudentProbability.findOne({ student: studentId, sprint: sprintId });
  if (!doc) {
    doc = new StudentProbability({
      student: studentId,
      sprint: sprintId,
      chapters: [],
    });
  }

  chapterData.forEach(({ subject, chapter, level }) => {
    const pEasy = QUESTIONNAIRE_PROBABILITY[level] || 0.55;
    const derived = deriveProbabilities(pEasy);
    const existing = doc.chapters.find(
      (c) => c.subject.toLowerCase() === subject.toLowerCase() && c.chapter.toLowerCase() === chapter.toLowerCase()
    );

    if (existing) {
      existing.questionnaireLevel = level;
      if (existing.source !== "objective") {
        existing.source = "questionnaire";
        Object.assign(existing, derived);
      }
      existing.updatedAt = new Date();
    } else {
      doc.chapters.push({
        subject,
        chapter,
        source: "questionnaire",
        questionnaireLevel: level,
        ...derived,
        updatedAt: new Date(),
      });
    }
  });

  await doc.save();
  return formatDocWithReadiness(doc);
};

/**
 * Update probability with objective data from an attempt
 */
const updateObjectiveProbability = async (studentId, sprintId, attemptId, responses) => {
  let doc = await StudentProbability.findOne({
    student: studentId,
    sprint: sprintId,
  });

  if (!doc) {
    doc = new StudentProbability({
      student: studentId,
      sprint: sprintId,
      chapters: [],
    });
  }

  // Group responses by chapter
  const chapterMap = {};
  responses.forEach((r) => {
    if (!r.subject || !r.chapter) return;
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
      (c) => c.subject.toLowerCase() === subject.toLowerCase() && c.chapter.toLowerCase() === chapter.toLowerCase()
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
  return formatDocWithReadiness(doc);
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
  formatDocWithReadiness,
};
