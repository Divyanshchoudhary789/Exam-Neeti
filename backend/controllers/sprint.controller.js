const Sprint = require("../models/Sprint.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { sendPaginated } = require("../utils/response");
const { getSlotPoolStats } = require("../services/questionReconstruction.service");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { SPRINT_STATUS, ROLES } = require("../config/constants");

// Fields that must never be exposed to students — patternSlots contains
// the question-selection blueprint (subjects, chapters, difficulties) which
// could allow gaming the exam. createdBy leaks admin identity.
const ADMIN_ONLY_FIELDS = "-patternSlots -createdBy";

// ─── Helper: validate admin-pinned questions on pattern slots ─────────────────
// Every id in slot.pinnedQuestionIds must resolve to a real, exam-eligible
// (active, non-draft) question whose subject matches the slot. Returns an array
// of human-readable problems (empty = all good).
const slotsHavePins = (patternSlots) =>
  patternSlots.some((s) => (s.pinnedQuestionIds || []).length > 0);

const validateSlotPins = async (QuestionModel, patternSlots) => {
  const allIds = [
    ...new Set(
      patternSlots.flatMap((s) => (s.pinnedQuestionIds || []).map(String))
    ),
  ];
  if (allIds.length === 0) return [];

  const docs = await QuestionModel.find({ _id: { $in: allIds } })
    .select("subject isActive status")
    .lean();

  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  const problems = [];

  for (const slot of patternSlots) {
    for (const rawId of slot.pinnedQuestionIds || []) {
      const id = String(rawId);
      const q = byId.get(id);
      if (!q) {
        problems.push(`Slot ${slot.position}: pinned question ${id} no longer exists.`);
        continue;
      }
      if (q.isActive === false) {
        problems.push(`Slot ${slot.position}: pinned question ${id} is deactivated.`);
      }
      if (q.status === "draft") {
        problems.push(
          `Slot ${slot.position}: pinned question ${id} is still a draft — activate it first.`
        );
      }
      if (q.subject && slot.subject && q.subject.toLowerCase() !== slot.subject.toLowerCase()) {
        problems.push(
          `Slot ${slot.position} (${slot.subject}): pinned question ${id} is ${q.subject}.`
        );
      }
    }
  }
  return problems;
};

const getQuestionModelOr503 = (req, next) => {
  const QuestionModel = req.app.get("QuestionModel");
  if (!QuestionModel) {
    next(new AppError("Question bank connection is not available.", 503));
    return null;
  }
  return QuestionModel;
};

// ─── Create Sprint ────────────────────────────────────────────────────────────

exports.createSprint = asyncHandler(async (req, res, next) => {
  const {
    name,
    description,
    status,
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

  // Validate any admin-pinned questions before persisting
  if (slotsHavePins(patternSlots)) {
    const QuestionModel = getQuestionModelOr503(req, next);
    if (!QuestionModel) return;
    const pinProblems = await validateSlotPins(QuestionModel, patternSlots);
    if (pinProblems.length > 0) {
      return next(
        new AppError(
          `Some pinned questions are invalid:\n- ${pinProblems.slice(0, 12).join("\n- ")}`,
          400
        )
      );
    }
  }

  const sprint = await Sprint.create({
    name,
    description,
    status: status || SPRINT_STATUS.DRAFT,
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

  return sendPaginated(
    res, 200, "Sprints fetched.",
    { sprints },
    buildPaginationMeta(total, page, limit)
  );
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

  // FIX: Enforce a single-active-sprint invariant. Without this, activating a
  // second sprint while one is already ACTIVE makes getActiveSprint()/
  // generateExam() non-deterministic — students and exam generation could
  // silently pick whichever sprint Mongo happens to return first.
  if (updates.status === SPRINT_STATUS.ACTIVE) {
    const otherActive = await Sprint.findOne({
      _id: { $ne: req.params.id },
      status: SPRINT_STATUS.ACTIVE,
    }).select("name").lean();

    if (otherActive) {
      return next(
        new AppError(
          `Sprint "${otherActive.name}" is already active. Complete or deactivate it before activating another sprint.`,
          409
        )
      );
    }
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

// ─── Update Sprint Blueprint (DRAFT only) ─────────────────────────────────────
// Replaces the whole pattern-slot blueprint + editable meta of a DRAFT sprint.
// Blocked once the sprint is activated or has exams, because published exams
// snapshot the slots they were generated from — silently rewriting the
// blueprint underneath them would desync analytics/coverage.

exports.updateSprintBlueprint = asyncHandler(async (req, res, next) => {
  const Exam = require("../models/Exam.model");

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.status !== SPRINT_STATUS.DRAFT) {
    return next(
      new AppError(
        `Only a DRAFT sprint's blueprint can be edited (this one is "${sprint.status}").`,
        400
      )
    );
  }

  const examCount = await Exam.countDocuments({ sprint: sprint._id });
  if (examCount > 0) {
    return next(
      new AppError(
        `Cannot edit blueprint — ${examCount} exam(s) were already generated from this sprint.`,
        409
      )
    );
  }

  const { name, description, status, totalQuestions, patternSlots, startDate, endDate } = req.body;

  if (patternSlots.length !== totalQuestions) {
    return next(
      new AppError(
        `Number of pattern slots (${patternSlots.length}) must equal totalQuestions (${totalQuestions}).`,
        400
      )
    );
  }

  if (slotsHavePins(patternSlots)) {
    const QuestionModel = getQuestionModelOr503(req, next);
    if (!QuestionModel) return;
    const pinProblems = await validateSlotPins(QuestionModel, patternSlots);
    if (pinProblems.length > 0) {
      return next(
        new AppError(
          `Some pinned questions are invalid:\n- ${pinProblems.slice(0, 12).join("\n- ")}`,
          400
        )
      );
    }
  }

  if (name !== undefined) sprint.name = name;
  if (description !== undefined) sprint.description = description;
  if (status !== undefined) sprint.status = status;
  if (startDate !== undefined) sprint.startDate = startDate;
  if (endDate !== undefined) sprint.endDate = endDate;
  sprint.totalQuestions = totalQuestions;
  sprint.patternSlots = patternSlots;

  // Single-active-sprint invariant (mirrors updateSprint)
  if (status === SPRINT_STATUS.ACTIVE) {
    const otherActive = await Sprint.findOne({
      _id: { $ne: sprint._id },
      status: SPRINT_STATUS.ACTIVE,
    }).select("name").lean();
    if (otherActive) {
      return next(
        new AppError(
          `Sprint "${otherActive.name}" is already active. Deactivate it before activating another sprint.`,
          409
        )
      );
    }
  }

  await sprint.save();

  return sendSuccess(res, 200, "Sprint blueprint updated.", { sprint });
});

// ─── Get Slot Candidate Questions (Sprint Builder) ────────────────────────────
// Full question docs (incl. correctAnswer + solution) for one slot's
// subject/chapter/topic/difficulty, so an admin can preview and pin specific
// questions while building the blueprint. Admin-only (enforced on the router).

exports.listSlotQuestions = asyncHandler(async (req, res, next) => {
  const QuestionModel = getQuestionModelOr503(req, next);
  if (!QuestionModel) return;

  const { subject, chapter, topic, difficulty, search } = req.query;
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const skip = (page - 1) * limit;

  const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // status:{$ne:"draft"} mirrors the exam-selection query — a slot can only be
  // filled by exam-eligible questions, so that's what we surface here.
  const filter = { isActive: true, status: { $ne: "draft" }, subject };
  if (chapter) filter.chapter = new RegExp(esc(chapter), "i");
  if (topic) filter.topic = new RegExp(esc(topic), "i");
  if (difficulty) filter.difficulty = difficulty;
  if (search) {
    const rx = new RegExp(esc(search), "i");
    filter.$or = [{ text: rx }, { chapter: rx }, { topic: rx }, { questionCategory: rx }];
  }

  const [questions, total] = await Promise.all([
    QuestionModel.find(filter)
      .select(
        "text hasLatex questionImage options correctAnswer solution subject chapter topic " +
        "difficulty classLevel questionType marks negativeMarks questionCategory usageLog"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    QuestionModel.countDocuments(filter),
  ]);

  const shaped = questions.map((q) => ({
    ...q,
    usageCount: Array.isArray(q.usageLog) ? q.usageLog.length : 0,
    usageLog: undefined,
  }));

  return sendPaginated(
    res,
    200,
    "Slot candidate questions fetched.",
    { questions: shaped },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Delete Sprint ────────────────────────────────────────────────────────────
// Only DRAFT sprints can be deleted. Active/completed sprints may have exams
// referencing them — deletion would break exam/attempt/analytics data integrity.

exports.deleteSprint = asyncHandler(async (req, res, next) => {
  const Exam = require("../models/Exam.model");

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.status !== SPRINT_STATUS.DRAFT) {
    return next(
      new AppError(
        `Cannot delete a ${sprint.status} sprint. Only DRAFT sprints can be deleted. ` +
        `Update status to "draft" first if it has no exams.`,
        400
      )
    );
  }

  // Block if any exams reference this sprint
  const examCount = await Exam.countDocuments({ sprint: sprint._id });
  if (examCount > 0) {
    return next(
      new AppError(
        `Cannot delete sprint — it has ${examCount} associated exam(s). ` +
        `Delete all exams in this sprint before deleting the sprint.`,
        409
      )
    );
  }

  await sprint.deleteOne();

  return sendSuccess(res, 200, "Sprint deleted successfully.", {
    deletedSprintId: sprint._id,
  });
});
