/**
 * Syllabus Controller
 *
 * Exposes the NEET syllabus taxonomy, test series blueprint, and
 * per-student coverage metrics via REST endpoints.
 */

const mongoose = require("mongoose");
const SyllabusConfig   = require("../models/SyllabusConfig.model");
const TestBlueprint    = require("../models/TestBlueprint.model");
const SyllabusProgress = require("../models/SyllabusProgress.model");
const AppError         = require("../utils/AppError");
const asyncHandler     = require("../utils/asyncHandler");
const { sendSuccess }  = require("../utils/response");
const { getCoverageMetrics, getBatchCoverageMetrics } = require("../services/coverage.service");
const { ROLES, SUBJECTS, CLASS_LEVELS } = require("../config/constants");

const toObjectId = (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

// ─── GET /syllabus — Full syllabus tree (subject → chapter → topics) ──────────

exports.getSyllabus = asyncHandler(async (req, res) => {
  const { subject, classLevel } = req.query;

  const filter = { isActive: true };
  if (subject)    filter.subject    = subject;
  if (classLevel) filter.classLevel = classLevel;

  const topics = await SyllabusConfig.find(filter)
    .sort({ subject: 1, classLevel: 1, chapterOrder: 1, topicOrder: 1 })
    .lean();

  // Group into subject → classLevel → chapter → topics[]
  const tree = {};
  for (const t of topics) {
    const sk = t.subject;
    const ck = t.classLevel;
    const ch = t.chapter;
    if (!tree[sk])        tree[sk] = {};
    if (!tree[sk][ck])    tree[sk][ck] = {};
    if (!tree[sk][ck][ch]) tree[sk][ck][ch] = { unitCode: t.unitCode, chapterOrder: t.chapterOrder, topics: [] };
    tree[sk][ck][ch].topics.push({ topic: t.topic, topicOrder: t.topicOrder, weight: t.weight, _id: t._id });
  }

  // Flatten to array of chapter objects for easy frontend consumption
  const chapters = [];
  for (const [sub, levels] of Object.entries(tree)) {
    for (const [level, chaps] of Object.entries(levels)) {
      for (const [chapterName, data] of Object.entries(chaps)) {
        chapters.push({
          subject:      sub,
          classLevel:   level,
          unitCode:     data.unitCode,
          chapterOrder: data.chapterOrder,
          chapter:      chapterName,
          topics:       data.topics.sort((a, b) => a.topicOrder - b.topicOrder),
          topicCount:   data.topics.length,
        });
      }
    }
  }

  chapters.sort((a, b) => {
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    if (a.classLevel !== b.classLevel) return a.classLevel.localeCompare(b.classLevel);
    return a.chapterOrder - b.chapterOrder;
  });

  return sendSuccess(res, 200, "Syllabus fetched.", {
    totalChapters: chapters.length,
    totalTopics:   topics.length,
    chapters,
  });
});

// ─── GET /syllabus/stats — Count of chapters and topics per subject ───────────

exports.getSyllabusStats = asyncHandler(async (req, res) => {
  const stats = await SyllabusConfig.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id:      { subject: "$subject", classLevel: "$classLevel" },
        chapters: { $addToSet: "$chapter" },
        topics:   { $sum: 1 },
        totalWeight: { $sum: "$weight" },
      },
    },
    {
      $project: {
        subject:      "$_id.subject",
        classLevel:   "$_id.classLevel",
        chapterCount: { $size: "$chapters" },
        topicCount:   "$topics",
        totalWeight:  1,
      },
    },
    { $sort: { subject: 1, classLevel: 1 } },
  ]);

  return sendSuccess(res, 200, "Syllabus stats fetched.", { stats });
});

// ─── GET /syllabus/blueprint — Full test series blueprint ─────────────────────

exports.getBlueprint = asyncHandler(async (req, res) => {
  const { programType, examType } = req.query;

  const filter = { isActive: true };
  if (programType) filter.programType = programType;
  if (examType)    filter.examType    = examType;

  const blueprint = await TestBlueprint.find(filter)
    .sort({ programType: 1, testNumber: 1 })
    .lean();

  // Group by program type for frontend display
  const grouped = {};
  for (const entry of blueprint) {
    if (!grouped[entry.programType]) grouped[entry.programType] = [];
    grouped[entry.programType].push(entry);
  }

  return sendSuccess(res, 200, "Test series blueprint fetched.", {
    totalTests: blueprint.length,
    blueprint: grouped,
  });
});

// ─── GET /syllabus/blueprint/:testCode — Single blueprint entry ───────────────

exports.getBlueprintEntry = asyncHandler(async (req, res, next) => {
  const { programType, testCode } = req.params;

  const entry = await TestBlueprint.findOne({ programType, testCode }).lean();
  if (!entry) return next(new AppError("Blueprint entry not found.", 404));

  return sendSuccess(res, 200, "Blueprint entry fetched.", { entry });
});

// ─── PATCH /syllabus/topics/:id — Admin: update topic weight ─────────────────

exports.updateTopicWeight = asyncHandler(async (req, res, next) => {
  const { weight } = req.body;

  // FIX: Use typeof check — !weight is falsy for 0 and would incorrectly pass
  // the check for undefined. Explicit type + range validation is correct here.
  if (typeof weight !== "number" || weight < 0.1 || weight > 10) {
    return next(new AppError("Weight must be a number between 0.1 and 10.", 400));
  }

  const topic = await SyllabusConfig.findByIdAndUpdate(
    req.params.id,
    { weight },
    { new: true, runValidators: true }
  );
  if (!topic) return next(new AppError("Syllabus topic not found.", 404));

  return sendSuccess(res, 200, "Topic weight updated.", { topic });
});

// ─── GET /syllabus/coverage/me/:sprintId — Student: own coverage ─────────────

exports.getMycoverage = asyncHandler(async (req, res) => {
  const { sprintId } = req.params;
  const coverage = await getCoverageMetrics(req.user.id, sprintId);
  return sendSuccess(res, 200, "Coverage metrics fetched.", { coverage });
});

// ─── GET /syllabus/coverage/student/:studentId/:sprintId — Admin ─────────────

exports.getStudentCoverage = asyncHandler(async (req, res, next) => {
  const { studentId, sprintId } = req.params;
  const coverage = await getCoverageMetrics(studentId, sprintId);
  return sendSuccess(res, 200, "Student coverage fetched.", { coverage });
});

// ─── GET /syllabus/coverage/batch/:sprintId — Admin: cohort coverage ─────────

exports.getBatchCoverage = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;
  const { batchId }  = req.query;

  const sprintOid = toObjectId(sprintId);
  if (!sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  const coverage = await getBatchCoverageMetrics(sprintId, batchId || null);
  return sendSuccess(res, 200, "Batch coverage metrics fetched.", { coverage });
});
