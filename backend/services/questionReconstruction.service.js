/**
 * Question Reconstruction Service
 *
 * For each new exam generated, this service selects one question per pattern-slot
 * from the question bank such that:
 *   1. Unused questions (never used in this sprint for this slot) are always preferred.
 *   2. If all questions for a slot have been used at least once, the Least-Recently-Used
 *      question is selected (LRU reuse cycle).
 *   3. Selection within eligible candidates is random (configurable).
 *
 * The service operates on the Question model from the Question Bank DB connection.
 */

const AppError = require("../utils/AppError");

/**
 * @param {mongoose.Model} QuestionModel  — bound to the question bank connection
 * @param {Object} sprint                 — Sprint document (with patternSlots)
 * @param {ObjectId} examId               — ID of the exam being generated
 * @returns {Array} Array of { slotPosition, question } objects
 */
const reconstructExamQuestions = async (QuestionModel, sprint, examId) => {
  const selectedSlots = [];

  for (const slot of sprint.patternSlots) {
    const { position, subject, chapter, topic, difficulty, questionType } = slot;

    // Build the filter to find eligible questions for this slot
    const eligibilityFilter = {
      isActive: true,
      subject,
      questionType,
      "patternSlotTags.sprintId": sprint._id,
      "patternSlotTags.slotPosition": position,
    };

    if (difficulty) eligibilityFilter.difficulty = difficulty;
    if (chapter) eligibilityFilter.chapter = chapter;
    if (topic) eligibilityFilter.topic = topic;

    const allEligible = await QuestionModel.find(eligibilityFilter).lean();

    if (allEligible.length === 0) {
      throw new AppError(
        `No eligible questions found for sprint "${sprint.name}", slot position ${position} (subject: ${subject}, difficulty: ${difficulty || "any"}).`,
        422
      );
    }

    // Classify each question: used vs. unused for this sprint+slot
    const sprintIdStr = sprint._id.toString();
    const unused = [];
    const used = [];

    for (const q of allEligible) {
      const relevantUsage = (q.usageLog || []).filter(
        (log) =>
          log.sprintId.toString() === sprintIdStr &&
          log.slotPosition === position
      );
      if (relevantUsage.length === 0) {
        unused.push(q);
      } else {
        // Track most recent usage date for LRU sorting
        const lastUsedAt = Math.max(
          ...relevantUsage.map((l) => new Date(l.usedAt).getTime())
        );
        used.push({ question: q, lastUsedAt });
      }
    }

    let selectedQuestion;

    if (unused.length > 0) {
      // Randomly pick from unused pool
      selectedQuestion = unused[Math.floor(Math.random() * unused.length)];
    } else {
      // All used — pick Least Recently Used
      used.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      selectedQuestion = used[0].question;
    }

    // Log usage on the question document
    await QuestionModel.findByIdAndUpdate(selectedQuestion._id, {
      $push: {
        usageLog: {
          sprintId: sprint._id,
          slotPosition: position,
          examId,
          usedAt: new Date(),
        },
      },
    });

    selectedSlots.push({
      slotPosition: position,
      question: selectedQuestion,
    });
  }

  // Return sorted by position
  selectedSlots.sort((a, b) => a.slotPosition - b.slotPosition);
  return selectedSlots;
};

/**
 * Returns per-slot pool stats for the Admin's question bank screen.
 * Shows how many unique questions are tagged for each slot and
 * how many more exams can be generated before repeats begin.
 *
 * @param {mongoose.Model} QuestionModel
 * @param {Object} sprint
 */
const getSlotPoolStats = async (QuestionModel, sprint) => {
  const stats = [];

  for (const slot of sprint.patternSlots) {
    const { position, subject, chapter, topic, difficulty, questionType } = slot;

    const eligibilityFilter = {
      isActive: true,
      subject,
      questionType,
      "patternSlotTags.sprintId": sprint._id,
      "patternSlotTags.slotPosition": position,
    };

    if (difficulty) eligibilityFilter.difficulty = difficulty;
    if (chapter) eligibilityFilter.chapter = chapter;
    if (topic) eligibilityFilter.topic = topic;

    const allEligible = await QuestionModel.find(eligibilityFilter).lean();
    const sprintIdStr = sprint._id.toString();

    let usedCount = 0;
    for (const q of allEligible) {
      const wasUsed = (q.usageLog || []).some(
        (log) =>
          log.sprintId.toString() === sprintIdStr &&
          log.slotPosition === position
      );
      if (wasUsed) usedCount++;
    }

    const totalUnique = allEligible.length;
    const unusedCount = totalUnique - usedCount;

    stats.push({
      slotPosition: position,
      subject,
      chapter: chapter || null,
      topic: topic || null,
      difficulty: difficulty || null,
      totalUniqueQuestions: totalUnique,
      unusedQuestions: unusedCount,
      usedQuestions: usedCount,
      examsBeforeRepeat: unusedCount,
      repeatsStarted: unusedCount === 0,
    });
  }

  return stats.sort((a, b) => a.slotPosition - b.slotPosition);
};

module.exports = { reconstructExamQuestions, getSlotPoolStats };
