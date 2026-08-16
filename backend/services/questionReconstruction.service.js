/**
 * Question Reconstruction Service
 *
 * Selects one question per pattern-slot for a new exam.
 *
 * ELIGIBILITY STRATEGY (attribute-based, no sprint tagging required):
 *   A question is eligible for a slot when its stored attributes satisfy every
 *   constraint defined on the slot:
 *     - subject       must match exactly
 *     - questionType  must match exactly
 *     - difficulty    must match if the slot specifies one  (null/omitted = any)
 *     - chapter       must match if the slot specifies one  (null/omitted = any)
 *     - topic         must match if the slot specifies one  (null/omitted = any)
 *     - isActive      must be true
 *
 *   patternSlotTags on a question are treated as an OPTIONAL whitelist.
 *   If a question has patternSlotTags and NONE of them match this sprint+slot,
 *   the question is excluded (it has been explicitly reserved for other sprints).
 *   If a question has NO patternSlotTags at all, it is eligible for any sprint
 *   — which is the default state of every newly seeded question.
 *
 * SELECTION WITHIN ELIGIBLE POOL:
 *   1. Prefer questions never used in this sprint (unused pool).
 *   2. If the entire pool has been used at least once, fall back to the
 *      Least-Recently-Used question (LRU cycle) so variety is maximised.
 *   3. Within the unused pool selection is random.
 *
 * PERFORMANCE:
 *   FIX: Instead of one DB query per slot (N+1), we batch all unique slot
 *   filter combinations into a single $or query per subject, reducing DB
 *   round-trips from O(slots) to O(unique subjects).
 */

const AppError = require("../utils/AppError");

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the question is eligible for this sprint + slot position.
 */
function isTagEligible(question, sprintId, slotPosition) {
  const tags = question.patternSlotTags;
  if (!tags || tags.length === 0) return true;
  const sprintIdStr = sprintId.toString();
  return tags.some(
    (t) =>
      t.sprintId.toString() === sprintIdStr &&
      t.slotPosition === slotPosition
  );
}

/**
 * Returns true if the question matches all constraints of the given slot.
 * Used for in-memory filtering after the bulk DB fetch.
 */
function matchesSlot(question, slot) {
  if (question.subject      !== slot.subject)            return false;
  if (question.questionType !== (slot.questionType || "mcq")) return false;
  if (slot.difficulty && question.difficulty !== slot.difficulty) return false;
  if (slot.chapter   && question.chapter    !== slot.chapter)    return false;
  if (slot.topic     && question.topic      !== slot.topic)      return false;
  return true;
}

// ─── reconstructExamQuestions ─────────────────────────────────────────────────

/**
 * @param {mongoose.Model} QuestionModel  — bound to the question bank connection
 * @param {Object}         sprint         — Sprint document (with patternSlots)
 * @param {ObjectId}       examId         — ID of the exam being generated
 * @returns {Array} Array of { slotPosition, question } sorted by position
 */
const reconstructExamQuestions = async (QuestionModel, sprint, examId) => {
  const selectedSlots = [];
  const sprintIdStr   = sprint._id.toString();
  const slots         = sprint.patternSlots;

  // FIX: Batch fetch — build one $or query covering all slot subject constraints
  // instead of one DB query per slot. Groups slots by subject to build minimal filters.
  const subjectSet = new Set(slots.map((s) => s.subject));
  const allCandidates = await QuestionModel.find({
    isActive: true,
    subject:  { $in: [...subjectSet] },
  }).lean();

  // Index candidates by subject for fast per-slot filtering
  const bySubject = {};
  for (const q of allCandidates) {
    if (!bySubject[q.subject]) bySubject[q.subject] = [];
    bySubject[q.subject].push(q);
  }

  // Track which question IDs we've already selected in this run (no slot can reuse same question)
  const selectedIds = new Set();

  for (const slot of slots) {
    const { position } = slot;

    // In-memory filter: match slot constraints + tag eligibility + not already selected
    const allEligible = (bySubject[slot.subject] || []).filter(
      (q) =>
        matchesSlot(q, slot) &&
        isTagEligible(q, sprint._id, position) &&
        !selectedIds.has(q._id.toString())
    );

    if (allEligible.length === 0) {
      throw new AppError(
        `No eligible questions found for sprint "${sprint.name}", ` +
        `slot ${position} (subject: ${slot.subject}, ` +
        `chapter: ${slot.chapter || "any"}, ` +
        `difficulty: ${slot.difficulty || "any"}).`,
        422
      );
    }

    // Classify into unused vs. used (within this sprint)
    const unused = [];
    const used   = [];

    for (const q of allEligible) {
      const relevantUsage = (q.usageLog || []).filter(
        (log) =>
          log.sprintId.toString() === sprintIdStr &&
          log.slotPosition === position
      );
      if (relevantUsage.length === 0) {
        unused.push(q);
      } else {
        const lastUsedAt = Math.max(
          ...relevantUsage.map((l) => new Date(l.usedAt).getTime())
        );
        used.push({ question: q, lastUsedAt });
      }
    }

    let selectedQuestion;
    if (unused.length > 0) {
      selectedQuestion = unused[Math.floor(Math.random() * unused.length)];
    } else {
      used.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      selectedQuestion = used[0].question;
    }

    selectedIds.add(selectedQuestion._id.toString());

    // Record usage on the question document
    await QuestionModel.findByIdAndUpdate(selectedQuestion._id, {
      $push: {
        usageLog: {
          sprintId:     sprint._id,
          slotPosition: position,
          examId,
          usedAt:       new Date(),
        },
      },
    });

    selectedSlots.push({ slotPosition: position, question: selectedQuestion });
  }

  selectedSlots.sort((a, b) => a.slotPosition - b.slotPosition);
  return selectedSlots;
};

// ─── getSlotPoolStats ─────────────────────────────────────────────────────────

/**
 * Returns per-slot pool stats for the Admin's question bank view.
 * FIX: Single bulk DB fetch instead of one query per slot.
 */
const getSlotPoolStats = async (QuestionModel, sprint) => {
  const stats       = [];
  const sprintIdStr = sprint._id.toString();
  const slots       = sprint.patternSlots;

  // Single bulk fetch for all relevant subjects
  const subjectSet = new Set(slots.map((s) => s.subject));
  const allCandidates = await QuestionModel.find({
    isActive: true,
    subject:  { $in: [...subjectSet] },
  }).lean();

  const bySubject = {};
  for (const q of allCandidates) {
    if (!bySubject[q.subject]) bySubject[q.subject] = [];
    bySubject[q.subject].push(q);
  }

  for (const slot of slots) {
    const { position } = slot;

    const allEligible = (bySubject[slot.subject] || []).filter(
      (q) => matchesSlot(q, slot) && isTagEligible(q, sprint._id, position)
    );

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
      slotPosition:         position,
      subject:              slot.subject,
      chapter:              slot.chapter    || null,
      topic:                slot.topic      || null,
      difficulty:           slot.difficulty || null,
      totalUniqueQuestions: totalUnique,
      unusedQuestions:      unusedCount,
      usedQuestions:        usedCount,
      examsBeforeRepeat:    unusedCount,
      repeatsStarted:       unusedCount === 0,
    });
  }

  return stats.sort((a, b) => a.slotPosition - b.slotPosition);
};

module.exports = { reconstructExamQuestions, getSlotPoolStats };

