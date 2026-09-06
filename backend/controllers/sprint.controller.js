const Sprint = require("../models/Sprint.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { sendPaginated } = require("../utils/response");
const { getSlotPoolStats } = require("../services/questionReconstruction.service");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { SPRINT_STATUS, ROLES, QUESTION_STATUS, ADMIN_ACTIONS } = require("../config/constants");
const AdminAuditLog = require("../models/AdminAuditLog.model");

// ─── Sprint governance helpers (Phase 2) ─────────────────────────────────────

/** One append-only activityLog entry from the authenticated requester. */
const makeSprintActivity = (req, action, meta = {}) => ({
  action,
  byUserId: req.user.id,
  byEmail:  req.user.email,
  byRole:   req.user.role,
  at:       new Date(),
  meta,
});

/**
 * Reconciles sprint.subjectProgress with the subjects actually present in
 * `patternSlots`: adds a "pending" row for a newly-introduced subject, keeps
 * the existing row (status + who marked it) for a retained subject, drops the
 * row for a subject no longer in the blueprint. Mutates + returns the array.
 */
const syncSubjectProgress = (existing, patternSlots) => {
  const subjectsInBlueprint = [
    ...new Set((patternSlots || []).map((s) => String(s.subject).toLowerCase())),
  ];
  const bySubject = new Map(
    (existing || []).map((sp) => [String(sp.subject).toLowerCase(), sp])
  );
  return subjectsInBlueprint.map(
    (subject) =>
      bySubject.get(subject) || {
        subject,
        status: "pending",
        markedBy: {},
        markedAt: null,
        note: "",
      }
  );
};

const isSuperAdmin = (req) => req.user.role === ROLES.SUPER_ADMIN;

/** Write a platform-audit row for a sprint event (never throws). */
const writeSprintAudit = async (req, action, metadata = {}) => {
  try {
    await AdminAuditLog.create({
      actor:     req.user.id,
      actorRole: req.user.role,
      action,
      target:    null,
      metadata,
      ip:        req.ip ?? null,
      userAgent: req.headers?.["user-agent"] ?? null,
    });
  } catch (err) {
    console.error("[Audit] Failed to write sprint audit log:", err.message);
  }
};

// Fields that must never be exposed to students — patternSlots contains
// the question-selection blueprint (subjects, chapters, difficulties) which
// could allow gaming the exam. createdBy leaks admin identity.
const ADMIN_ONLY_FIELDS = "-patternSlots -createdBy";

const escapeRegex = (str) => String(str).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      // STRICT: a slot can only be pinned to a reviewed-and-approved question.
      if (q.status !== QUESTION_STATUS.ACTIVE) {
        problems.push(
          q.status === QUESTION_STATUS.DRAFT
            ? `Slot ${slot.position}: pinned question ${id} is still a draft — get it reviewed and activated first.`
            : `Slot ${slot.position}: pinned question ${id} is "${q.status}" — only active (reviewed) questions can be pinned.`
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
    classLevel,
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

  // A new sprint always enters the draft→subject-work→activate workflow.
  // Only a super_admin may create one already active (bypassing the baton
  // pass) — in which case every subject is auto-marked done for the trail.
  let effectiveStatus = status || SPRINT_STATUS.DRAFT;
  if (effectiveStatus === SPRINT_STATUS.ACTIVE && !isSuperAdmin(req)) {
    effectiveStatus = SPRINT_STATUS.DRAFT;
  }

  let subjectProgress = syncSubjectProgress([], patternSlots);
  const activityLog = [makeSprintActivity(req, "created", { status: effectiveStatus })];
  if (effectiveStatus === SPRINT_STATUS.ACTIVE) {
    subjectProgress = subjectProgress.map((sp) => ({
      ...sp,
      status: "done",
      markedBy: { userId: req.user.id, email: req.user.email },
      markedAt: new Date(),
      note: "Auto-marked (sprint created directly as active by super admin).",
    }));
  }

  const sprint = await Sprint.create({
    name,
    description,
    status: effectiveStatus,
    classLevel: classLevel || null,
    totalQuestions,
    patternSlots,
    startDate,
    endDate,
    createdBy: req.user.id,
    subjectProgress,
    activityLog,
    deletionRequest: { status: "none" },
  });

  return sendSuccess(res, 201, "Sprint created successfully.", { sprint });
});

// ─── List Sprints ─────────────────────────────────────────────────────────────

exports.listSprints = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { status, search, classLevel } = req.query;

  const filter = {};
  if (status) {
    if (!Object.values(SPRINT_STATUS).includes(status)) {
      return next(new AppError(`Invalid status filter. Allowed: ${Object.values(SPRINT_STATUS).join(", ")}.`, 400));
    }
    filter.status = status;
  }
  if (classLevel) {
    filter.classLevel = classLevel;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const [sprints, total] = await Promise.all([
    Sprint.find(filter)
      // patternSlots (blueprint) and activityLog (full trail) are omitted from
      // the list for payload size — fetched per-sprint via GET /:id and
      // GET /:id/history. subjectProgress + deletionRequest stay for card badges.
      .select("-patternSlots -activityLog")
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

  const query = Sprint.find({ status: SPRINT_STATUS.ACTIVE })
    .sort({ startDate: 1, createdAt: -1 });

  if (isAdmin) {
    query.populate("createdBy", "name email");
  } else {
    // Strip internal blueprint fields from student-facing response
    query.select(ADMIN_ONLY_FIELDS);
  }

  const sprints = await query.lean();
  const sprint = sprints[0] || null;

  if (!sprint) {
    return sendSuccess(res, 200, "No active sprint at this time.", {
      sprint: null,
      sprints: [],
    });
  }

  return sendSuccess(res, 200, "Active sprints fetched.", { sprint, sprints });
});

// ─── Update Sprint ────────────────────────────────────────────────────────────

exports.updateSprint = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  // Whitelist — never allow patternSlots/createdBy/subjectProgress/activityLog/
  // deletionRequest to be overwritten through this generic endpoint.
  const metaFields = ["name", "description", "classLevel", "startDate", "endDate"];
  const oldStatus = sprint.status;
  const metaChanges = {};
  for (const field of metaFields) {
    if (req.body[field] !== undefined) {
      const val = field === "classLevel" ? (req.body[field] || null) : req.body[field];
      if (String(sprint[field] ?? "") !== String(val ?? "")) metaChanges[field] = val;
      sprint[field] = val;
    }
  }

  // Status transitions — the activation gate lives here.
  if (req.body.status !== undefined && req.body.status !== oldStatus) {
    const target = req.body.status;
    if (target === SPRINT_STATUS.ACTIVE && !sprint.allSubjectsDone && !isSuperAdmin(req)) {
      const pending = (sprint.subjectProgress || [])
        .filter((s) => s.status !== "done")
        .map((s) => s.subject);
      return next(
        new AppError(
          pending.length
            ? `Cannot activate — these subjects are not marked done yet: ${pending.join(", ")}. Each subject admin must finish their slots and mark their subject complete first.`
            : "Cannot activate — the blueprint has no subjects. Edit the blueprint first.",
          409
        )
      );
    }
    sprint.status = target;
    sprint.activityLog.push(
      makeSprintActivity(req, "status_changed", { from: oldStatus, to: target })
    );
  }

  if (Object.keys(metaChanges).length > 0) {
    sprint.activityLog.push(makeSprintActivity(req, "meta_edited", { fields: Object.keys(metaChanges) }));
  }

  await sprint.save();

  return sendSuccess(res, 200, "Sprint updated.", { sprint });
});

// ─── Mark / reopen a subject's slice of the blueprint ─────────────────────────
// The multi-admin baton pass: a subject admin finishes their slots and flips
// their subject to "done"; the sprint can only be activated once every subject
// is done. Any admin/super_admin may update any subject (teams coordinate who
// owns which subject offline).

exports.markSubjectProgress = asyncHandler(async (req, res, next) => {
  const { subject, status, note } = req.body;

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.status !== SPRINT_STATUS.DRAFT) {
    return next(
      new AppError(
        `Subject progress can only be changed while the sprint is a draft (this one is "${sprint.status}").`,
        409
      )
    );
  }

  const entry = (sprint.subjectProgress || []).find(
    (s) => String(s.subject).toLowerCase() === String(subject).toLowerCase()
  );
  if (!entry) {
    return next(
      new AppError(
        `"${subject}" is not part of this sprint's blueprint. Its pattern slots have no ${subject} questions.`,
        400
      )
    );
  }

  const from = entry.status;
  if (from === status) {
    return sendSuccess(res, 200, `Subject "${subject}" is already "${status}".`, { sprint });
  }

  entry.status = status;
  entry.note   = note || "";
  if (status === "done") {
    entry.markedBy = { userId: req.user.id, email: req.user.email };
    entry.markedAt = new Date();
  } else {
    entry.markedBy = {};
    entry.markedAt = null;
  }

  sprint.activityLog.push(
    makeSprintActivity(req, "subject_marked", { subject: entry.subject, from, to: status, note: note || "" })
  );

  await sprint.save();

  return sendSuccess(
    res,
    200,
    status === "done"
      ? `${subject} marked done.${sprint.allSubjectsDone ? " All subjects complete — the sprint can now be activated." : ""}`
      : `${subject} set to "${status}".`,
    { sprint }
  );
});

// ─── Sprint history (attribution + full activity trail) ───────────────────────

exports.getSprintHistory = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id)
    .select("name status classLevel createdBy subjectProgress activityLog deletionRequest createdAt updatedAt")
    .populate("createdBy", "name email")
    .lean();
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  const activityLog = Array.isArray(sprint.activityLog)
    ? [...sprint.activityLog].sort((a, b) => new Date(b.at) - new Date(a.at))
    : [];

  return sendSuccess(res, 200, "Sprint history fetched.", {
    history: {
      sprintId:        sprint._id,
      name:            sprint.name,
      status:          sprint.status,
      classLevel:      sprint.classLevel || null,
      createdBy:       sprint.createdBy || null,
      subjectProgress: sprint.subjectProgress || [],
      deletionRequest: sprint.deletionRequest?.status && sprint.deletionRequest.status !== "none"
        ? sprint.deletionRequest
        : null,
      createdAt:       sprint.createdAt,
      updatedAt:       sprint.updatedAt,
      activityLog,
    },
  });
});

// ─── Download Sprint Question Paper (PDF / Word) ──────────────────────────────
// Full paper in blueprint-slot order: pinned slots render the complete
// question (text, formulas, images, options, answer, solution); unpinned slots
// render a "not fixed" placeholder with the slot criteria.

exports.downloadSprintPaper = asyncHandler(async (req, res, next) => {
  const format = (req.query.format || "pdf").toLowerCase();

  const sprint = await Sprint.findById(req.params.id).lean();
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  const QuestionModel = req.app.get("QuestionModel");
  if (!QuestionModel) {
    return next(new AppError("Question bank connection is not available — cannot resolve pinned questions.", 503));
  }

  const { generateSprintPaper } = require("../services/sprintPaper.service");
  const { buffer, filename, contentType } = await generateSprintPaper(sprint, QuestionModel, format);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.send(buffer);
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

  const { name, description, status, classLevel, totalQuestions, patternSlots, startDate, endDate } = req.body;
  const oldStatus = sprint.status;

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
  if (classLevel !== undefined) sprint.classLevel = classLevel || null;
  if (startDate !== undefined) sprint.startDate = startDate;
  if (endDate !== undefined) sprint.endDate = endDate;
  sprint.totalQuestions = totalQuestions;
  sprint.patternSlots = patternSlots;

  // Reconcile the per-subject workflow with the new blueprint (keeps a
  // retained subject's "done" mark, adds pending rows for new subjects).
  sprint.subjectProgress = syncSubjectProgress(sprint.subjectProgress, patternSlots);

  sprint.activityLog.push(
    makeSprintActivity(req, "blueprint_edited", {
      totalQuestions,
      subjects: sprint.subjectProgress.map((s) => s.subject),
    })
  );

  // Activation via the blueprint save is subject to the same gate.
  if (status !== undefined && status !== oldStatus) {
    if (status === SPRINT_STATUS.ACTIVE && !sprint.allSubjectsDone && !isSuperAdmin(req)) {
      const pending = sprint.subjectProgress.filter((s) => s.status !== "done").map((s) => s.subject);
      return next(
        new AppError(
          `Cannot activate — these subjects are not marked done yet: ${pending.join(", ")}.`,
          409
        )
      );
    }
    sprint.status = status;
    sprint.activityLog.push(makeSprintActivity(req, "status_changed", { from: oldStatus, to: status }));
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

  // STRICT "active" — mirrors the exam-selection query. A slot can only be
  // filled/pinned with reviewed-and-approved questions, so that's all we
  // surface to the Sprint Builder.
  const filter = { isActive: true, status: QUESTION_STATUS.ACTIVE, subject };
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

// ─── Deletion safety checks (shared) ─────────────────────────────────────────
// Only a DRAFT sprint with zero exams can be removed — an active/completed
// sprint (or one with exams) is referenced by exam/attempt/analytics data.
// Returns a human-readable reason string, or null if it's safe to delete.

const sprintDeletionBlocker = async (sprint) => {
  if (sprint.status !== SPRINT_STATUS.DRAFT) {
    return `Only a DRAFT sprint can be deleted (this one is "${sprint.status}"). Set it back to draft first if it has no exams.`;
  }
  const Exam = require("../models/Exam.model");
  const examCount = await Exam.countDocuments({ sprint: sprint._id });
  if (examCount > 0) {
    return `This sprint has ${examCount} associated exam(s). Delete those exams first.`;
  }
  return null;
};

// ─── Request Sprint Deletion (admin) ─────────────────────────────────────────
// An admin can never delete a sprint directly — they raise a request that a
// super_admin must approve. Idempotency: a pending request can't be raised
// twice; a previously rejected request is overwritten by a fresh one.

exports.requestSprintDeletion = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.deletionRequest?.status === "pending") {
    return next(new AppError("A deletion request for this sprint is already awaiting super admin review.", 409));
  }

  // Surface obvious blockers now so the admin isn't left waiting on a request
  // a super admin can only ever reject.
  const blocker = await sprintDeletionBlocker(sprint);
  if (blocker) return next(new AppError(`Cannot request deletion — ${blocker}`, 409));

  sprint.deletionRequest = {
    status: "pending",
    requestedBy: { userId: req.user.id, email: req.user.email },
    requestedAt: new Date(),
    reason: reason || "",
    decidedBy: {},
    decidedAt: null,
    decisionNote: "",
  };
  sprint.activityLog.push(makeSprintActivity(req, "delete_requested", { reason: reason || "" }));
  await sprint.save();

  await writeSprintAudit(req, ADMIN_ACTIONS.SPRINT_DELETE_REQUESTED, {
    sprintId: String(sprint._id), sprintName: sprint.name, reason: reason || "",
  });

  return sendSuccess(res, 200, "Deletion request submitted — a super admin will review it.", {
    sprint: { _id: sprint._id, name: sprint.name, deletionRequest: sprint.deletionRequest },
  });
});

// ─── Cancel a pending deletion request (requester or super_admin) ─────────────

exports.cancelSprintDeletionRequest = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.deletionRequest?.status !== "pending") {
    return next(new AppError("There is no pending deletion request to cancel.", 409));
  }
  const requesterId = String(sprint.deletionRequest.requestedBy?.userId || "");
  if (!isSuperAdmin(req) && requesterId !== String(req.user.id)) {
    return next(new AppError("Only the admin who raised this request (or a super admin) can cancel it.", 403));
  }

  sprint.deletionRequest.status = "none";
  sprint.activityLog.push(makeSprintActivity(req, "delete_rejected", { note: "Request cancelled by requester." }));
  await sprint.save();

  return sendSuccess(res, 200, "Deletion request cancelled.", { sprintId: sprint._id });
});

// ─── List pending deletion requests (super_admin) ────────────────────────────

exports.listDeletionRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter = { "deletionRequest.status": "pending" };
  const [sprints, total] = await Promise.all([
    Sprint.find(filter)
      .select("name status classLevel totalQuestions deletionRequest createdBy createdAt")
      .populate("createdBy", "name email")
      .sort({ "deletionRequest.requestedAt": 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Sprint.countDocuments(filter),
  ]);

  return sendPaginated(
    res, 200, "Pending sprint deletion requests.",
    { requests: sprints },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Decide a deletion request (super_admin) ─────────────────────────────────
// approve → the sprint is actually deleted (after re-checking the blockers).
// reject  → the request is closed with a note; the sprint stays.

exports.decideSprintDeletion = asyncHandler(async (req, res, next) => {
  const { decision, note } = req.body;

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  if (sprint.deletionRequest?.status !== "pending") {
    return next(new AppError("This sprint has no pending deletion request.", 409));
  }

  if (decision === "reject") {
    sprint.deletionRequest.status = "rejected";
    sprint.deletionRequest.decidedBy = { userId: req.user.id, email: req.user.email };
    sprint.deletionRequest.decidedAt = new Date();
    sprint.deletionRequest.decisionNote = note || "";
    sprint.activityLog.push(makeSprintActivity(req, "delete_rejected", { note: note || "" }));
    await sprint.save();

    await writeSprintAudit(req, ADMIN_ACTIONS.SPRINT_DELETE_REJECTED, {
      sprintId: String(sprint._id), sprintName: sprint.name, note: note || "",
    });
    return sendSuccess(res, 200, "Deletion request rejected — the sprint was kept.", {
      sprint: { _id: sprint._id, name: sprint.name, deletionRequest: sprint.deletionRequest },
    });
  }

  // approve → re-validate the blockers at decision time (state may have changed
  // since the request was raised), then delete.
  const blocker = await sprintDeletionBlocker(sprint);
  if (blocker) {
    return next(new AppError(`Cannot approve deletion — ${blocker} The request is still pending; reject it or clear the blocker.`, 409));
  }

  const snapshot = {
    sprintId: String(sprint._id),
    sprintName: sprint.name,
    requestedByEmail: sprint.deletionRequest.requestedBy?.email || null,
    reason: sprint.deletionRequest.reason || "",
    approvalNote: note || "",
  };

  await sprint.deleteOne();

  await writeSprintAudit(req, ADMIN_ACTIONS.SPRINT_DELETE_APPROVED, snapshot);
  await writeSprintAudit(req, ADMIN_ACTIONS.SPRINT_DELETED, snapshot);

  return sendSuccess(res, 200, "Deletion approved — the sprint has been deleted.", {
    deletedSprintId: snapshot.sprintId,
  });
});

// ─── Delete Sprint (super_admin only, direct) ────────────────────────────────
// A super_admin may delete a draft sprint without the request/approval dance.
// Regular admins must use POST /:id/deletion-request (enforced on the router).

exports.deleteSprint = asyncHandler(async (req, res, next) => {
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return next(new AppError("Sprint not found.", 404));

  const blocker = await sprintDeletionBlocker(sprint);
  if (blocker) return next(new AppError(`Cannot delete sprint — ${blocker}`, 409));

  const snapshot = { sprintId: String(sprint._id), sprintName: sprint.name, direct: true };
  await sprint.deleteOne();
  await writeSprintAudit(req, ADMIN_ACTIONS.SPRINT_DELETED, snapshot);

  return sendSuccess(res, 200, "Sprint deleted successfully.", {
    deletedSprintId: sprint._id,
  });
});
