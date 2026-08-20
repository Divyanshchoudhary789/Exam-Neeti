const Batch = require("../models/Batch.model");
const User = require("../models/User.model");
const Attempt = require("../models/Attempt.model");
const AnalyticsResult = require("../models/AnalyticsResult.model");
const AdvancedAnalytics = require("../models/AdvancedAnalytics.model");
const StudentProbability = require("../models/StudentProbability.model");
const SyllabusProgress = require("../models/SyllabusProgress.model");
const Report = require("../models/Report.model");
const NotificationLog = require("../models/NotificationLog.model");
const AdminAuditLog = require("../models/AdminAuditLog.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { ROLES, ADMIN_ACTIONS } = require("../config/constants");

/** Escape special regex characters to prevent ReDoS */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.createBatch = asyncHandler(async (req, res, next) => {
  const { name, description, programType } = req.body;

  const batch = await Batch.create({
    name,
    description,
    programType: programType || null,
    createdBy: req.user.id,
  });

  return sendSuccess(res, 201, "Batch created successfully.", { batch });
});

exports.listBatches = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { isActive, search } = req.query;

  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

  const [batches, total] = await Promise.all([
    Batch.find(filter)
      .populate("studentCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Batch.countDocuments(filter),
  ]);

  return sendPaginated(
    res, 200, "Batches fetched successfully.",
    { batches },
    buildPaginationMeta(total, page, limit)
  );
});

exports.getBatch = asyncHandler(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id)
    .populate("studentCount")
    .lean({ virtuals: true });

  if (!batch) return next(new AppError("Batch not found.", 404));

  return sendSuccess(res, 200, "Batch fetched.", { batch });
});

exports.updateBatch = asyncHandler(async (req, res, next) => {
  const { name, description, isActive, programType } = req.body;
  const updates = {};
  if (name        !== undefined) updates.name        = name;
  if (description !== undefined) updates.description = description;
  if (isActive    !== undefined) updates.isActive    = isActive;
  if (programType !== undefined) updates.programType = programType;

  const batch = await Batch.findByIdAndUpdate(req.params.id, updates, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!batch) return next(new AppError("Batch not found.", 404));

  return sendSuccess(res, 200, "Batch updated.", { batch });
});

exports.deactivateBatch = asyncHandler(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return next(new AppError("Batch not found.", 404));

  if (!batch.isActive) {
    return next(new AppError("Batch is already inactive.", 409));
  }

  batch.isActive = false;
  await batch.save();

  await AdminAuditLog.create({
    actor:     req.user.id,
    actorRole: req.user.role,
    action:    ADMIN_ACTIONS.BATCH_DEACTIVATED,
    target:    null,
    metadata: { batchId: batch._id, batchName: batch.name },
    ip:        req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Batch deactivated.", {
    _id:      batch._id,
    isActive: batch.isActive,
  });
});

exports.reactivateBatch = asyncHandler(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return next(new AppError("Batch not found.", 404));

  if (batch.isActive) {
    return next(new AppError("Batch is already active.", 409));
  }

  batch.isActive = true;
  await batch.save();

  await AdminAuditLog.create({
    actor:     req.user.id,
    actorRole: req.user.role,
    action:    ADMIN_ACTIONS.BATCH_REACTIVATED,
    target:    null,
    metadata: { batchId: batch._id, batchName: batch.name },
    ip:        req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Batch reactivated.", {
    _id:      batch._id,
    isActive: batch.isActive,
  });
});

// ─── Admin: Hard-delete a batch ───────────────────────────────────────────────
//
// Permanently deletes the batch and ALL its associated data:
//   • All student accounts in the batch
//   • All Attempts, AnalyticsResults, StudentProbability records, and Reports
//     belonging to those students
//
// BLOCKED if the batch still has active (isActive: true) students — the caller
// must either reassign or deactivate them first, or pass `force: true` to
// override. This prevents accidental bulk data loss.
//
// This action is IRREVERSIBLE. Only super_admin can perform it.
// Confirmation requires passing the batch name as `confirmName`.

exports.deleteBatch = asyncHandler(async (req, res, next) => {
  const { confirmName, force = false } = req.body;

  const batch = await Batch.findById(req.params.id);
  if (!batch) return next(new AppError("Batch not found.", 404));

  // Require the caller to echo the batch name back
  if (!confirmName || confirmName.trim() !== batch.name.trim()) {
    return next(
      new AppError(
        "Confirmation failed. Pass the batch name as `confirmName` to proceed.",
        400
      )
    );
  }

  // Safety gate: block deletion if active students exist unless force flag is set
  const activeStudentCount = await User.countDocuments({
    batch: batch._id,
    role: ROLES.STUDENT,
    isActive: true,
  });

  if (activeStudentCount > 0 && !force) {
    return next(
      new AppError(
        `Batch has ${activeStudentCount} active student(s). Reassign or deactivate them first, or pass \`force: true\` to delete everything.`,
        409
      )
    );
  }

  // Collect all student IDs in this batch for cascading deletes
  const students = await User.find(
    { batch: batch._id, role: ROLES.STUDENT },
    "_id"
  ).lean();
  const studentIds = students.map((s) => s._id);
  const totalStudents = studentIds.length;

  // Cascade-delete all student data in parallel
  if (studentIds.length > 0) {
    await Promise.all([
      User.deleteMany({ _id: { $in: studentIds } }),
      Attempt.deleteMany({ student: { $in: studentIds } }),
      AnalyticsResult.deleteMany({ student: { $in: studentIds } }),
      AdvancedAnalytics.deleteMany({ student: { $in: studentIds } }),
      StudentProbability.deleteMany({ student: { $in: studentIds } }),
      SyllabusProgress.deleteMany({ student: { $in: studentIds } }),
      Report.deleteMany({ owner: { $in: studentIds } }),
      NotificationLog.deleteMany({ recipient: { $in: studentIds } }),
    ]);
  }

  // Delete the batch last, after all student data is gone
  await batch.deleteOne();

  // Immutable audit trail
  await AdminAuditLog.create({
    actor:     req.user.id,
    actorRole: req.user.role,
    action:    ADMIN_ACTIONS.BATCH_DELETED,
    target:    null,
    metadata: {
      batchId:       batch._id,
      batchName:     batch.name,
      studentsDeleted: totalStudents,
      forced:        force,
    },
    ip:        req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Batch and all associated data permanently deleted.", {
    deletedBatchId:  batch._id,
    batchName:       batch.name,
    studentsDeleted: totalStudents,
  });
});

exports.getBatchStudents = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const batch = await Batch.findById(req.params.id);
  if (!batch) return next(new AppError("Batch not found.", 404));

  const [students, total] = await Promise.all([
    User.find({ batch: req.params.id, role: ROLES.STUDENT })
      .select("name email phone isActive createdAt lastLoginAt")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments({ batch: req.params.id, role: ROLES.STUDENT }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Batch students fetched.",
    data: { batch: { _id: batch._id, name: batch.name }, students },
    pagination: buildPaginationMeta(total, page, limit),
  });
});
