/**
 * Coverage Service — The 4 Coverage Formulas
 *
 * Implements all 4 coverage metrics that were pending client syllabus data:
 *
 *  Formula 1 — Syllabus Coverage (%)
 *    = Unique chapters tested ≥ once / Total chapters in syllabus × 100
 *
 *  Formula 2 — Concept Coverage (%)
 *    = Topics tested ≥ once / Total topics in syllabus × 100
 *
 *  Formula 3 — Weighted Coverage (%)
 *    = Σ(weight of covered topics) / Σ(weight of all topics) × 100
 *
 *  Formula 4 — Revision Coverage (%)
 *    = Topics tested ≥ REVISION_THRESHOLD times / Total covered topics × 100
 *
 * Called after every attempt submission — updates SyllabusProgress document.
 */

const mongoose       = require("mongoose");
const SyllabusConfig  = require("../models/SyllabusConfig.model");
const SyllabusProgress = require("../models/SyllabusProgress.model");
const Sprint          = require("../models/Sprint.model");

// A topic counts as "revised" once it has been tested this many times
const REVISION_THRESHOLD = 3;

const roundTo = (val, decimals = 2) => parseFloat(Number(val).toFixed(decimals));

// ─── updateSyllabusProgress ───────────────────────────────────────────────────

/**
 * Called after every attempt submission.
 * Merges attempt response data into the student's per-sprint progress document
 * then recomputes all 4 coverage metrics and caches them.
 *
 * @param {ObjectId|string} studentId
 * @param {ObjectId|string} sprintId
 * @param {ObjectId|string} attemptId  — stored in assessmentHistory for audit
 * @param {Array}           responses  — Attempt.responses array (plain objects)
 */
const updateSyllabusProgress = async (studentId, sprintId, attemptId, responses) => {
  // ── 1. Build topic map from this attempt ─────────────────────────────────────
  const attemptTopicMap = {};
  for (const r of responses) {
    if (!r.isAttempted) continue;
    const key = `${r.subject}__${r.chapter}__${r.topic}`;
    if (!attemptTopicMap[key]) {
      attemptTopicMap[key] = {
        subject: r.subject,
        chapter: r.chapter,
        topic:   r.topic,
        timesAttempted: 0,
        timesCorrect:   0,
      };
    }
    attemptTopicMap[key].timesAttempted++;
    if (r.isCorrect) attemptTopicMap[key].timesCorrect++;
  }

  // ── 2. Load or create the SyllabusProgress document ─────────────────────────
  let progress = await SyllabusProgress.findOne({ student: studentId, sprint: sprintId });
  if (!progress) {
    progress = new SyllabusProgress({ student: studentId, sprint: sprintId, topics: [] });
  }

  const now = new Date();

  // ── 3. Merge attempt data into per-topic progress ────────────────────────────
  for (const [, data] of Object.entries(attemptTopicMap)) {
    const existing = progress.topics.find(
      (t) => t.subject === data.subject && t.chapter === data.chapter && t.topic === data.topic
    );

    // Get topic weight from SyllabusConfig (defaults to 1.0 if not seeded yet)
    const syllabusEntry = await SyllabusConfig.findOne({
      subject:   data.subject,
      chapter:   data.chapter,
      topic:     data.topic,
      isActive:  true,
    }).lean();
    const weight = syllabusEntry?.weight ?? 1.0;

    if (existing) {
      existing.timesAttempted += data.timesAttempted;
      existing.timesCorrect   += data.timesCorrect;
      existing.isCovered       = true;
      existing.isRevised       = existing.timesAttempted >= REVISION_THRESHOLD;
      existing.lastAttemptedAt = now;
      existing.weight          = weight; // refresh in case admin updated weights
    } else {
      progress.topics.push({
        subject:          data.subject,
        chapter:          data.chapter,
        topic:            data.topic,
        weight,
        timesAttempted:   data.timesAttempted,
        timesCorrect:     data.timesCorrect,
        isCovered:        true,
        isRevised:        data.timesAttempted >= REVISION_THRESHOLD,
        firstAttemptedAt: now,
        lastAttemptedAt:  now,
      });
    }
  }

  // ── 4. Load syllabus denominator — all active topics for this sprint's subjects
  const sprint = await Sprint.findById(sprintId).lean();
  const sprintSubjects = [
    ...new Set((sprint?.patternSlots || []).map((s) => s.subject)),
  ];

  const syllabusTopics = await SyllabusConfig.find({
    ...(sprintSubjects.length ? { subject: { $in: sprintSubjects } } : {}),
    isActive: true,
  }).lean();

  // ── 5. Formula 1 — Syllabus Coverage ─────────────────────────────────────────
  const allChapters     = new Set(syllabusTopics.map((t) => `${t.subject}__${t.chapter}`));
  const coveredChapters = new Set(
    progress.topics.filter((t) => t.isCovered).map((t) => `${t.subject}__${t.chapter}`)
  );
  const syllabusCoverage = allChapters.size > 0
    ? roundTo((coveredChapters.size / allChapters.size) * 100)
    : 0;

  // ── 6. Formula 2 — Concept Coverage ──────────────────────────────────────────
  const totalTopics   = syllabusTopics.length;
  const coveredTopics = progress.topics.filter((t) => t.isCovered).length;
  const conceptCoverage = totalTopics > 0
    ? roundTo((coveredTopics / totalTopics) * 100)
    : 0;

  // ── 7. Formula 3 — Weighted Coverage ─────────────────────────────────────────
  const totalWeight   = syllabusTopics.reduce((s, t) => s + (t.weight || 1.0), 0);
  const coveredWeight = progress.topics
    .filter((t) => t.isCovered)
    .reduce((s, t) => s + (t.weight || 1.0), 0);
  const weightedCoverage = totalWeight > 0
    ? roundTo((coveredWeight / totalWeight) * 100)
    : 0;

  // ── 8. Formula 4 — Revision Coverage ─────────────────────────────────────────
  const revisedTopics   = progress.topics.filter((t) => t.isRevised).length;
  const revisionCoverage = coveredTopics > 0
    ? roundTo((revisedTopics / coveredTopics) * 100)
    : 0;

  // ── 9. Cache and save ────────────────────────────────────────────────────────
  progress.syllabusCoverage = syllabusCoverage;
  progress.conceptCoverage  = conceptCoverage;
  progress.weightedCoverage = weightedCoverage;
  progress.revisionCoverage = revisionCoverage;
  progress.lastUpdatedAt    = now;

  await progress.save();
  return progress;
};

// ─── getCoverageMetrics ───────────────────────────────────────────────────────

/**
 * Returns cached coverage metrics for a student in a sprint.
 * Used by analytics and dashboard controllers.
 */
const getCoverageMetrics = async (studentId, sprintId) => {
  const progress = await SyllabusProgress.findOne({
    student: studentId,
    sprint:  sprintId,
  }).lean();

  if (!progress) {
    return {
      syllabusCoverage:  0,
      conceptCoverage:   0,
      weightedCoverage:  0,
      revisionCoverage:  0,
      coveredTopics:     0,
      revisedTopics:     0,
      coveredChapters:   0,
      topicDetails:      [],
      lastUpdatedAt:     null,
    };
  }

  const coveredTopics   = progress.topics.filter((t) => t.isCovered).length;
  const revisedTopics   = progress.topics.filter((t) => t.isRevised).length;
  const coveredChapters = new Set(
    progress.topics.filter((t) => t.isCovered).map((t) => `${t.subject}__${t.chapter}`)
  ).size;

  return {
    syllabusCoverage:  progress.syllabusCoverage,
    conceptCoverage:   progress.conceptCoverage,
    weightedCoverage:  progress.weightedCoverage,
    revisionCoverage:  progress.revisionCoverage,
    coveredTopics,
    revisedTopics,
    coveredChapters,
    topicDetails:  progress.topics,
    lastUpdatedAt: progress.lastUpdatedAt,
  };
};

// ─── getBatchCoverageMetrics ──────────────────────────────────────────────────

/**
 * Cohort-level average coverage metrics for admin dashboard.
 * Optionally filters by batchId.
 */
const getBatchCoverageMetrics = async (sprintId, batchId) => {
  const sprintOid = mongoose.Types.ObjectId.isValid(sprintId)
    ? new mongoose.Types.ObjectId(sprintId)
    : null;

  if (!sprintOid) {
    return { avgSyllabusCoverage: 0, avgConceptCoverage: 0, avgWeightedCoverage: 0, avgRevisionCoverage: 0, studentCount: 0 };
  }

  let pipeline = [
    { $match: { sprint: sprintOid } },
  ];

  // If batchId provided, join with users to filter by batch
  if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
    const batchOid = new mongoose.Types.ObjectId(batchId);
    pipeline = [
      { $match: { sprint: sprintOid } },
      {
        $lookup: {
          from:         "users",
          localField:   "student",
          foreignField: "_id",
          as:           "studentInfo",
        },
      },
      { $unwind: "$studentInfo" },
      { $match: { "studentInfo.batch": batchOid } },
    ];
  }

  pipeline.push({
    $group: {
      _id:                 null,
      avgSyllabusCoverage: { $avg: "$syllabusCoverage" },
      avgConceptCoverage:  { $avg: "$conceptCoverage" },
      avgWeightedCoverage: { $avg: "$weightedCoverage" },
      avgRevisionCoverage: { $avg: "$revisionCoverage" },
      studentCount:        { $sum: 1 },
    },
  });

  const results = await SyllabusProgress.aggregate(pipeline);

  if (!results.length) {
    return { avgSyllabusCoverage: 0, avgConceptCoverage: 0, avgWeightedCoverage: 0, avgRevisionCoverage: 0, studentCount: 0 };
  }

  const r = results[0];
  return {
    avgSyllabusCoverage: roundTo(r.avgSyllabusCoverage || 0),
    avgConceptCoverage:  roundTo(r.avgConceptCoverage  || 0),
    avgWeightedCoverage: roundTo(r.avgWeightedCoverage || 0),
    avgRevisionCoverage: roundTo(r.avgRevisionCoverage || 0),
    studentCount:        r.studentCount || 0,
  };
};

module.exports = {
  updateSyllabusProgress,
  getCoverageMetrics,
  getBatchCoverageMetrics,
};
