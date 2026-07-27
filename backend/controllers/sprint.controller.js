const Sprint = require("../models/Sprint.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { getSlotPoolStats } = require("../services/questionReconstruction.service");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { SPRINT_STATUS, ROLES } = require("../config/constants");

// Fields that must never be exposed to students — patternSlots contains
// the question-selection blueprint (subjects, chapters, difficulties) which
// could allow gaming the exam. createdBy leaks admin identity.
const ADMIN_ONLY_FIELDS = "-patternSlots -createdBy";

// ─── Create Sprint ────────────────────────────────────────────────────────────

exports.createSprint = asyncHandler(async (req, res, next) => {
  const {
    name,
    description,
    totalQuestions,
    patternSlots,
    startDate,
    endDate,
  } = req.body;

  // Validate slot count matches totalQuestions
  if (patternSlots.length !== totalQuestions) {
    return next(
      new AppError(
        `Number of pattern slots (${patternSlots.length}) must equal totalQuestions (${totalQuestions}).`,
        400
      )
    );
  }

  const sprint = await Sprint.create({
    name,
    description,
    totalQuestions,
    patternSlots,
    startDate,
    endDate,
    createdBy: req.user.id,
  });

  return sendSuccess(res, 201, "Sprint created successfully.", { sprint });
});

// ─── List Sprints ─────────────────────────────────────────────────────────────

exports.listSprints = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [sprints, total] = await Promise.all([
    Sprint.find(filter)
      .select("-patternSlots")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Sprint.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Sprints fetched.",
    data: { sprints },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Get Single Sprint ────────────────────────────────────────────────────────

exports.getSprint = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id)
    .populate("createdBy", "name email")
    .lean();

  if (!sprint) return next(new AppError("Sprint not found.", 404));

  return sendSuccess(res, 200, "Sprint fetched.", { sprint });
});

// ─── Get Active Sprint ────────────────────────────────────────────────────────
// Students receive a stripped view (no patternSlots, no createdBy).
// Admins/super_admin receive the full document.

exports.getActiveSprint = asyncHandler(async (req, res, next) => {
  const isAdmin =
    req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN;

  const query = Sprint.findOne({ status: SPRINT_STATUS.ACTIVE });

  if (isAdmin) {
    query.populate("createdBy", "name email");
  } else {
    // Strip internal blueprint fields from student-facing response
    query.select(ADMIN_ONLY_FIELDS);
  }

  const sprint = await query.lean();

  if (!sprint) {
    return sendSuccess(res, 200, "No active sprint at this time.", {
      sprint: null,
    });
  }

  return sendSuccess(res, 200, "Active sprint fetched.", { sprint });
});

// ─── Update Sprint ────────────────────────────────────────────────────────────

exports.updateSprint = asyncHandler(async (req, res, next) => {
  // Whitelist updatable fields — never allow patternSlots/createdBy to be overwritten via API
  const allowed = ["name", "description", "status", "startDate", "endDate"];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const sprint = await Sprint.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!sprint) return next(new AppError("Sprint not found.", 404));

  return sendSuccess(res, 200, "Sprint updated.", { sprint });
});

// ─── Get Slot Pool Stats ──────────────────────────────────────────────────────

exports.getSlotStats = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  const QuestionModel = req.app.get("QuestionModel");
  if (!QuestionModel) {
    return next(
      new AppError("Question bank connection is not available.", 503)
    );
  }

  const stats = await getSlotPoolStats(QuestionModel, sprint);

  return sendSuccess(res, 200, "Slot pool stats fetched.", {
    sprintId: sprint._id,
    sprintName: sprint.name,
    slots: stats,
  });
});
