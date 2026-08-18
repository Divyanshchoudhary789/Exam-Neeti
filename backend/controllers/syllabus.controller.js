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

// ─── GET /syllabus — Full syllabus tree (subject → chapter → topics) ──────────

exports.getSyllabus = asyncHandler(async (req, res) => {
  const { subject, classLevel, includeInactive } = req.query;

  const filter = {};
  if (includeInactive !== "true") {
    filter.isActive = true;
  }
  if (subject)    filter.subject    = String(subject).toLowerCase();
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
    tree[sk][ck][ch].topics.push({
      topic: t.topic,
      topicOrder: t.topicOrder,
      chapterOrder: t.chapterOrder,
      unitCode: t.unitCode,
      weight: t.weight,
      isActive: t.isActive !== false,
      _id: t._id,
    });
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
  const Question = require("../models/Question.model");

  const [breakdown, totalTaggedQuestions, uniqueSubjects, uniqueChapters] = await Promise.all([
    SyllabusConfig.aggregate([
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
    ]),
    Question.countDocuments({ isActive: { $ne: false }, chapter: { $exists: true, $ne: "" } }).catch(() => 0),
    SyllabusConfig.distinct("subject", { isActive: true }).catch(() => []),
    SyllabusConfig.distinct("chapter", { isActive: true }).catch(() => []),
  ]);

  const totalTopics = breakdown.reduce((acc, s) => acc + (s.topicCount || 0), 0);

  return sendSuccess(res, 200, "Syllabus stats fetched.", {
    stats: {
      totalSubjects: uniqueSubjects.length || breakdown.length,
      totalChapters: uniqueChapters.length,
      totalTopics: totalTopics,
      totalTaggedQuestions: totalTaggedQuestions || 0,
      breakdown,
    },
  });
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

// ─── POST /syllabus/topics — Admin: create new topic ────────────────────────

exports.createTopic = asyncHandler(async (req, res, next) => {
  const { subject, classLevel, unitCode, chapter, topic, topicOrder, chapterOrder, weight, isActive } = req.body;

  const normalizedSubject = String(subject).toLowerCase();

  const existing = await SyllabusConfig.findOne({
    subject: normalizedSubject,
    classLevel,
    chapter: chapter.trim(),
    topic: topic.trim(),
  });

  if (existing) {
    return next(new AppError("Topic already exists in this chapter and class level.", 400));
  }

  const newTopic = await SyllabusConfig.create({
    subject: normalizedSubject,
    classLevel,
    unitCode: unitCode ? unitCode.trim() : "",
    chapter: chapter.trim(),
    topic: topic.trim(),
    topicOrder: topicOrder !== undefined ? Number(topicOrder) : 1,
    chapterOrder: chapterOrder !== undefined ? Number(chapterOrder) : 1,
    weight: weight !== undefined ? Number(weight) : 1.0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  return sendSuccess(res, 201, "Syllabus topic created successfully.", { topic: newTopic });
});

// ─── PUT /syllabus/topics/:id — Admin: update entire syllabus topic ─────────

exports.updateTopic = asyncHandler(async (req, res, next) => {
  const topicId = toObjectId(req.params.id);
  if (!topicId) return next(new AppError("Invalid topic ID.", 400));

  const existingTopic = await SyllabusConfig.findById(topicId);
  if (!existingTopic) return next(new AppError("Syllabus topic not found.", 404));

  const { subject, classLevel, unitCode, chapter, topic, topicOrder, chapterOrder, weight, isActive } = req.body;

  if (subject) existingTopic.subject = String(subject).toLowerCase();
  if (classLevel) existingTopic.classLevel = classLevel;
  if (unitCode !== undefined) existingTopic.unitCode = String(unitCode).trim();
  if (chapter) existingTopic.chapter = String(chapter).trim();
  if (topic) existingTopic.topic = String(topic).trim();
  if (topicOrder !== undefined) existingTopic.topicOrder = Number(topicOrder);
  if (chapterOrder !== undefined) existingTopic.chapterOrder = Number(chapterOrder);
  if (weight !== undefined) existingTopic.weight = Number(weight);
  if (isActive !== undefined) existingTopic.isActive = Boolean(isActive);

  // Check unique index conflict if details changed
  const conflict = await SyllabusConfig.findOne({
    _id: { $ne: topicId },
    subject: existingTopic.subject,
    classLevel: existingTopic.classLevel,
    chapter: existingTopic.chapter,
    topic: existingTopic.topic,
  });

  if (conflict) {
    return next(new AppError("Another topic with the same subject, class level, chapter, and topic name already exists.", 400));
  }

  await existingTopic.save();

  return sendSuccess(res, 200, "Syllabus topic updated successfully.", { topic: existingTopic });
});

// ─── DELETE /syllabus/topics/:id — Admin: delete syllabus topic ─────────────

exports.deleteTopic = asyncHandler(async (req, res, next) => {
  const topicId = toObjectId(req.params.id);
  if (!topicId) return next(new AppError("Invalid topic ID.", 400));

  const topic = await SyllabusConfig.findByIdAndDelete(topicId);
  if (!topic) return next(new AppError("Syllabus topic not found.", 404));

  return sendSuccess(res, 200, "Syllabus topic deleted successfully.", { id: topicId });
});

// ─── PATCH /syllabus/topics/:id/toggle — Admin: toggle active status ─────────

exports.toggleTopicActive = asyncHandler(async (req, res, next) => {
  const topicId = toObjectId(req.params.id);
  if (!topicId) return next(new AppError("Invalid topic ID.", 400));

  const topic = await SyllabusConfig.findById(topicId);
  if (!topic) return next(new AppError("Syllabus topic not found.", 404));

  topic.isActive = !topic.isActive;
  await topic.save();

  return sendSuccess(res, 200, `Topic ${topic.isActive ? "activated" : "deactivated"} successfully.`, { topic });
});

// ─── POST /syllabus/topics/bulk — Admin: bulk create/upsert topics ───────────

exports.bulkCreateTopics = asyncHandler(async (req, res, next) => {
  const { topics } = req.body;
  if (!Array.isArray(topics) || topics.length === 0) {
    return next(new AppError("Please provide an array of topics to create.", 400));
  }

  const createdTopics = [];
  const errors = [];

  for (let i = 0; i < topics.length; i++) {
    const item = topics[i];
    try {
      if (!item.subject || !item.classLevel || !item.chapter || !item.topic) {
        errors.push({ index: i, topic: item.topic || "Unknown", error: "Missing required fields (subject, classLevel, chapter, topic)" });
        continue;
      }
      const normalizedSubject = String(item.subject).toLowerCase();
      const topicDoc = await SyllabusConfig.findOneAndUpdate(
        {
          subject: normalizedSubject,
          classLevel: item.classLevel,
          chapter: item.chapter.trim(),
          topic: item.topic.trim(),
        },
        {
          $set: {
            unitCode: item.unitCode ? item.unitCode.trim() : "",
            topicOrder: item.topicOrder !== undefined ? Number(item.topicOrder) : i + 1,
            chapterOrder: item.chapterOrder !== undefined ? Number(item.chapterOrder) : 1,
            weight: item.weight !== undefined ? Number(item.weight) : 1.0,
            isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
      createdTopics.push(topicDoc);
    } catch (err) {
      errors.push({ index: i, topic: item.topic, error: err.message });
    }
  }

  return sendSuccess(res, 200, `Processed ${topics.length} topics. ${createdTopics.length} created/updated.`, {
    processedCount: topics.length,
    successCount: createdTopics.length,
    errorCount: errors.length,
    createdTopics,
    errors,
  });
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

  const isAllSprints = !sprintId || sprintId === "all" || sprintId === "overall";
  const studentOid = toObjectId(studentId);
  const sprintOid  = isAllSprints ? null : toObjectId(sprintId);

  if (!studentOid) return next(new AppError("Invalid student ID.", 400));
  if (!isAllSprints && !sprintOid) return next(new AppError("Invalid sprint ID.", 400));

  // Ensure the student actually exists
  const User = require("../models/User.model");
  const { ROLES } = require("../config/constants");
  const student = await User.findOne({ _id: studentOid, role: ROLES.STUDENT }).select("_id").lean();
  if (!student) return next(new AppError("Student not found.", 404));

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

