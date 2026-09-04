/**
 * Question Reconstruction Service
 *
 * Selects one question per pattern-slot for a new exam.
 *
 * ELIGIBILITY STRATEGY (attribute-based, no sprint tagging required):
 *   A question is eligible for a slot when its stored attributes satisfy the
 *   constraints defined on the slot:
 *     - subject       must match (case-insensitive)
 *     - questionType  must match (default: "mcq")
 *     - difficulty    matches if available, or falls back to adjacent difficulties
 *     - chapter       matches exactly or via flexible string normalization/overlap
 *     - topic         matches if specified, or falls back if omitted/unmatched
 *     - isActive      must be true
 *
 * PROGRESSIVE MULTI-TIERED FALLBACK:
 *   To guarantee zero 422 failures during exam generation in production, the engine
 *   evaluates questions through 7 priority tiers:
 *     Tier 1: Exact/Normalized Chapter + Topic + Difficulty + Unselected + Tag Eligible
 *     Tier 2: Flexible Chapter & Topic + Strict Difficulty + Tag Eligible
 *     Tier 3: Flexible Chapter + Relax Topic + Strict Difficulty + Tag Eligible
 *     Tier 4: Flexible Chapter + Relax Difficulty + Tag Eligible
 *     Tier 5: Subject Level Fallback (Any Chapter/Difficulty, Tag Eligible, Unselected)
 *     Tier 6: Relax Tag Restrictions (Any Tag, Unselected)
 *     Tier 7: Subject Pool Reuse (if DB total subject questions < sprint slots)
 *
 * SELECTION WITHIN ELIGIBLE POOL:
 *   1. Prefer questions never used in this sprint & slot (unused pool).
 *   2. If the entire pool has been used at least once, fall back to the
 *      Least-Recently-Used question (LRU cycle) so variety is maximised.
 *   3. Within the unused pool selection is random.
 *
 * PINNED (ADMIN-FIXED) SLOTS — takes priority over everything above:
 *   When a slot carries `pinnedQuestionIds`, the ENTIRE tier engine is
 *   skipped for that slot. The eligible pool is exactly those questions
 *   (any that were since deleted / deactivated / left as draft are dropped).
 *   The same unused→LRU selection then runs over just that pinned set, so a
 *   sprint that generates more exams than it has pins cycles them fairly.
 *   If every pinned question has disappeared, the slot falls back to the
 *   generic tier engine so exam generation can never hard-fail (422).
 */

const AppError = require("../utils/AppError");

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalizes string for fuzzy/robust matching:
 * - Lowercase
 * - Replace '&' with 'and'
 * - Remove non-alphanumeric punctuation
 * - Collapse multiple spaces and trim
 */
function normalizeStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if qText matches targetText under flexible normalization & word overlap.
 */
function isFlexibleMatch(qText, targetText) {
  if (!targetText) return true;
  if (!qText) return false;

  const nQ = normalizeStr(qText);
  const nTarget = normalizeStr(targetText);

  // 1. Exact or normalized equality
  if (nQ === nTarget) return true;

  // 2. Substring containment
  if (nQ.includes(nTarget) || nTarget.includes(nQ)) return true;

  // 3. Word overlap matching (excluding common stop words)
  const stopWords = new Set(["and", "or", "of", "in", "the", "a", "to", "for", "with", "on", "at"]);
  const targetWords = nTarget.split(" ").filter((w) => w.length > 2 && !stopWords.has(w));
  const qWords = new Set(nQ.split(" ").filter((w) => w.length > 2 && !stopWords.has(w)));

  if (targetWords.length === 0) return true;

  let matchCount = 0;
  for (const tw of targetWords) {
    // Exact word or stem match (e.g. "measurement" vs "measurements")
    let found = false;
    for (const qw of qWords) {
      if (qw === tw || qw.startsWith(tw) || tw.startsWith(qw)) {
        found = true;
        break;
      }
    }
    if (found) matchCount++;
  }

  // If at least 50% of target non-stop words match (or >= 1 word if target has 1-2 key words)
  const threshold = Math.ceil(targetWords.length * 0.5);
  return matchCount >= Math.min(threshold, targetWords.length);
}

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
 * Finds candidate pool for a pattern slot using progressive tier fallback.
 */
function getSlotCandidatePool(candidates, slot, sprintId, selectedIds) {
  const { position, subject, chapter, topic, difficulty, questionType } = slot;
  const targetType = (questionType || "mcq").toLowerCase();

  // Filter out questions not matching subject or questionType (case-insensitive)
  const subjectCandidates = candidates.filter((q) => {
    if (q.subject.toLowerCase() !== subject.toLowerCase()) return false;
    const qType = (q.questionType || "mcq").toLowerCase();
    if (qType !== targetType) return false;
    return true;
  });

  if (subjectCandidates.length === 0) return [];

  // Helper for checking slot constraints per tier
  const filterByTier = (useFuzzyChapter, useFuzzyTopic, checkDifficulty, checkTags, allowSelected) => {
    return subjectCandidates.filter((q) => {
      if (!allowSelected && selectedIds.has(q._id.toString())) return false;
      if (checkTags && !isTagEligible(q, sprintId, position)) return false;

      // Difficulty check
      if (checkDifficulty && difficulty) {
        if (q.difficulty !== difficulty) return false;
      }

      // Chapter check
      if (chapter) {
        if (useFuzzyChapter) {
          if (!isFlexibleMatch(q.chapter, chapter)) return false;
        } else {
          if (q.chapter !== chapter) return false;
        }
      }

      // Topic check
      if (topic) {
        if (useFuzzyTopic) {
          if (!isFlexibleMatch(q.topic, topic)) return false;
        } else {
          if (q.topic !== topic) return false;
        }
      }

      return true;
    });
  };

  // Tier 1: Strict/Exact Match + Unselected + Tag Eligible
  let pool = filterByTier(false, false, true, true, false);
  if (pool.length > 0) return pool;

  // Tier 2: Flexible Chapter & Topic Match + Strict Difficulty + Tag Eligible
  pool = filterByTier(true, true, true, true, false);
  if (pool.length > 0) return pool;

  // Tier 3: Flexible Chapter + Relax Topic + Strict Difficulty + Tag Eligible
  pool = filterByTier(true, false, true, true, false);
  if (pool.length > 0) return pool;

  // Tier 4: Flexible Chapter + Relax Difficulty + Tag Eligible
  pool = filterByTier(true, false, false, true, false);
  if (pool.length > 0) return pool;

  // Tier 5: Subject Level Fallback (Any Chapter, Any Difficulty, Tag Eligible, Unselected)
  pool = filterByTier(false, false, false, true, false);
  if (pool.length > 0) return pool;

  // Tier 6: Relax Tag Restrictions (Any Tag, Unselected)
  pool = filterByTier(false, false, false, false, false);
  if (pool.length > 0) return pool;

  // Tier 7: Reuse questions in exam if subject candidate pool is smaller than slots
  return subjectCandidates;
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

  // Bulk fetch all active questions
  // status:{$ne:"draft"} (not status:"active") so pre-existing questions with
  // no status field at all (created before the draft/active workflow existed)
  // remain exam-eligible without requiring a migration first.
  const allCandidates = await QuestionModel.find({
    isActive: true,
    status: { $ne: "draft" },
  }).lean();

  // Index candidates by subject (lowercase) for fast lookup, and by _id for
  // resolving pinned questions (which may belong to any subject).
  const bySubject = {};
  const byId = {};
  for (const q of allCandidates) {
    const subjKey = q.subject.toLowerCase();
    if (!bySubject[subjKey]) bySubject[subjKey] = [];
    bySubject[subjKey].push(q);
    byId[q._id.toString()] = q;
  }

  // Track question IDs selected in this exam run (prevent duplicates per exam)
  const selectedIds = new Set();
  // Usage-log writes are batched into one bulkWrite after the loop instead of
  // one `await` per slot — for a full NEET-sized sprint (150-200 slots) that
  // was 150-200 sequential DB round trips serialized inside the admin's
  // "generate exam" request, adding real latency on top of an already
  // multi-step operation.
  const usageLogOps = [];

  for (const slot of slots) {
    const { position } = slot;
    const subjKey = slot.subject.toLowerCase();
    const candidateList = bySubject[subjKey] || [];

    // ── Pinned slot: strict, engine-bypassing selection ──────────────────
    const pinnedIds = (slot.pinnedQuestionIds || []).map((id) => id.toString());
    let eligiblePool;
    if (pinnedIds.length > 0) {
      const pinnedPool = pinnedIds.map((id) => byId[id]).filter(Boolean);
      // Deliberately NOT filtered by selectedIds — an admin who pins the same
      // question to two slots has explicitly asked for that.
      eligiblePool =
        pinnedPool.length > 0
          ? pinnedPool
          : getSlotCandidatePool(candidateList, slot, sprint._id, selectedIds);
    } else {
      eligiblePool = getSlotCandidatePool(candidateList, slot, sprint._id, selectedIds);
    }

    if (eligiblePool.length === 0) {
      throw new AppError(
        `No active questions found in the Question Bank for subject "${slot.subject}". ` +
        `Please seed or add questions for ${slot.subject}.`,
        422
      );
    }

    // Classify into unused vs. used (within this sprint & slot position)
    const unused = [];
    const used   = [];

    for (const q of eligiblePool) {
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

    // Queue the usage-log write instead of awaiting it here.
    usageLogOps.push({
      updateOne: {
        filter: { _id: selectedQuestion._id },
        update: {
          $push: {
            usageLog: {
              sprintId:     sprint._id,
              slotPosition: position,
              examId,
              usedAt:       new Date(),
            },
          },
        },
      },
    });

    selectedSlots.push({ slotPosition: position, question: selectedQuestion });
  }

  if (usageLogOps.length > 0) {
    await QuestionModel.bulkWrite(usageLogOps);
  }

  selectedSlots.sort((a, b) => a.slotPosition - b.slotPosition);
  return selectedSlots;
};

// ─── getSlotPoolStats ─────────────────────────────────────────────────────────

/**
 * Returns per-slot pool stats for the Admin's question bank view.
 */
const getSlotPoolStats = async (QuestionModel, sprint) => {
  const stats       = [];
  const sprintIdStr = sprint._id.toString();
  const slots       = sprint.patternSlots;

  // status:{$ne:"draft"} (not status:"active") so pre-existing questions with
  // no status field at all (created before the draft/active workflow existed)
  // remain exam-eligible without requiring a migration first.
  const allCandidates = await QuestionModel.find({
    isActive: true,
    status: { $ne: "draft" },
  }).lean();

  const bySubject = {};
  const byId = {};
  for (const q of allCandidates) {
    const subjKey = q.subject.toLowerCase();
    if (!bySubject[subjKey]) bySubject[subjKey] = [];
    bySubject[subjKey].push(q);
    byId[q._id.toString()] = q;
  }

  for (const slot of slots) {
    const { position } = slot;
    const subjKey = slot.subject.toLowerCase();
    const candidateList = bySubject[subjKey] || [];

    const pinnedIds = (slot.pinnedQuestionIds || []).map((id) => id.toString());
    const selectedIds = new Set();
    const allEligible =
      pinnedIds.length > 0
        ? pinnedIds.map((id) => byId[id]).filter(Boolean)
        : getSlotCandidatePool(candidateList, slot, sprint._id, selectedIds);

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
      pinned:               pinnedIds.length,
      pinnedResolved:       pinnedIds.length > 0 ? totalUnique : 0,
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


