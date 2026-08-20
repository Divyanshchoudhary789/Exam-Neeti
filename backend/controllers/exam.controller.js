const Exam = require("../models/Exam.model");
const Attempt = require("../models/Attempt.model");
const Sprint = require("../models/Sprint.model");
const Batch = require("../models/Batch.model");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
// Add sendPaginated import
const { sendSuccess, sendPaginated } = require("../utils/response");
const { reconstructExamQuestions } = require("../services/questionReconstruction.service");
const { sendEmail, templates } = require("../services/email.service");
const {
  NOTIFICATION_TRIGGER,
  EXAM_STATUS,
  ATTEMPT_STATUS,
  SPRINT_STATUS,
  ROLES,
} = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");

// ─── Helper: strip correctAnswer from question list before sending to student ─
const stripAnswers = (questions) =>
  questions.map(({ correctAnswer, ...rest }) => rest); // eslint-disable-line no-unused-vars

// ─── Helper: hydrate exam questions with full text/options from Question Bank ─
// questionBankData — array of question documents from the question bank DB
// examQuestions    — array of exam question slots (from Exam.questions)
// stripAnswer      — true for students (omit correctAnswer + solution)
const hydrateQuestions = (examQuestions, questionBankData, stripAnswer = false) => {
  // Build a map of questionId → full question doc for O(1) lookup
  const qbMap = {};
  for (const q of questionBankData) {
    qbMap[q._id.toString()] = q;
  }

  return examQuestions.map((slot) => {
    const full = qbMap[slot.questionId.toString()];

    // If question bank doc not found, return slot as-is (graceful degradation)
    if (!full) {
      const { correctAnswer, ...safeSlot } = slot; // eslint-disable-line no-unused-vars
      return stripAnswer ? safeSlot : slot;
    }

    const hydrated = {
      // ── Slot-level fields (marks, position, etc.) ──
      slotPosition:  slot.slotPosition,
      questionId:    slot.questionId,
      subject:       slot.subject,
      chapter:       slot.chapter,
      topic:         slot.topic,
      difficulty:    slot.difficulty,
      questionType:  slot.questionType,
      hasImage:      slot.hasImage || Boolean(full.questionImage?.url),
      marks:         slot.marks,
      negativeMarks: slot.negativeMarks,

      // ── Rich content from question bank ───────────────
      text:          full.text,
      hasLatex:      full.hasLatex,
      questionImage: full.questionImage ?? null,
      options:       full.options,             // [{key, text, image}]
      idealTimeSeconds: full.idealTimeSeconds ?? null,
    };

    // Admins get correctAnswer + solution; students do not
    if (!stripAnswer) {
      hydrated.correctAnswer = slot.correctAnswer;
      hydrated.solution      = full.solution ?? null;
    }

    return hydrated;
  });
};

// ─── Admin: Generate (create) a new exam for a batch ─────────────────────────

exports.generateExam = asyncHandler(async (req, res, next) => {
  const sprintId = req.body.sprintId || req.body.sprint;
  const batchId = req.body.batchId || req.body.batch;
  const { title, durationMinutes, scheduledAt, instructions } = req.body;

  const [sprint, batch] = await Promise.all([
    Sprint.findById(sprintId),
    Batch.findById(batchId),
  ]);

  if (!sprint) return next(new AppError("Sprint not found.", 404));
  if (!batch)  return next(new AppError("Batch not found.", 404));

  // Use constant — not a magic string
  if (sprint.status !== SPRINT_STATUS.ACTIVE) {
    return next(new AppError("Cannot generate exams for an inactive sprint.", 400));
  }

  const QuestionModel = req.app.get("QuestionModel");
  if (!QuestionModel) {
    return next(new AppError("Question bank connection is not available.", 503));
  }

  // FIX: Use atomic findOneAndUpdate to compute examNumber, avoiding race conditions
  // when two concurrent generateExam calls hit the same sprint+batch simultaneously.
  // The unique index on {sprint, batch, examNumber} is the final safety net,
  // but this prevents the unhandled E11000 from ever reaching the client.
  let examNumber = 1;
  const lastExam = await Exam.findOne({ sprint: sprintId, batch: batchId })
    .sort({ examNumber: -1 })
    .select("examNumber")
    .lean();
  if (lastExam) examNumber = lastExam.examNumber + 1;

  // Create placeholder first so we have an examId for usage logging.
  // Wrap in try/catch to handle the rare E11000 race condition gracefully.
  let exam;
  try {
    exam = await Exam.create({
      sprint:          sprintId,
      batch:           batchId,
      examNumber,
      title:           title || `Exam ${examNumber}`,
      durationMinutes,
      scheduledAt:     scheduledAt || null,
      instructions:    instructions || "",
      status:          EXAM_STATUS.DRAFT,
      createdBy:       req.user.id,
    });
  } catch (createErr) {
    if (createErr.code === 11000) {
      return next(new AppError("An exam with this number already exists for this sprint and batch. Please retry.", 409));
    }
    throw createErr;
  }

  // Run question reconstruction
  const selectedSlots = await reconstructExamQuestions(QuestionModel, sprint, exam._id);

  const questions = selectedSlots.map(({ slotPosition, question }) => ({
    slotPosition,
    questionId:    question._id,
    subject:       question.subject,
    chapter:       question.chapter,
    topic:         question.topic,
    difficulty:    question.difficulty,
    questionType:  question.questionType,
    hasImage:      Boolean(question.questionImage?.url),
    marks:         question.marks,
    negativeMarks: question.negativeMarks,
    correctAnswer: question.correctAnswer,
  }));

  exam.questions   = questions;
  exam.totalMarks  = questions.reduce((sum, q) => sum + q.marks, 0);
  exam.status      = EXAM_STATUS.PUBLISHED;
  exam.generatedAt = new Date();
  await exam.save();

  // Notify all students in the batch (non-blocking batch)
  const students = await User.find({ batch: batchId, role: ROLES.STUDENT, isActive: true }).lean();
  const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;

  await Promise.allSettled(
    students.map((student) =>
      sendEmail({
        to:          student.email,
        subject:     `New Exam Available — ${exam.title}`,
        html:        templates.examAvailable({
          name:        student.name,
          examTitle:   exam.title,
          examNumber:  exam.examNumber,
          dashboardUrl,
        }),
        trigger:     NOTIFICATION_TRIGGER.EXAM_AVAILABLE,
        recipientId: student._id,
        contextRef:  exam._id,
      })
    )
  );

  return sendSuccess(res, 201, "Exam generated and published successfully.", { exam });
});

// ─── Admin: List exams ────────────────────────────────────────────────────────

exports.listExams = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { sprintId, batchId, status } = req.query;

  const filter = {};
  if (sprintId) filter.sprint = sprintId;
  if (batchId)  filter.batch  = batchId;
  if (status)   filter.status = status;

  const [exams, total] = await Promise.all([
    Exam.find(filter)
      .select("-questions")
      .populate("sprint", "name status")
      .populate("batch", "name")
      .sort({ examNumber: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Exam.countDocuments(filter),
  ]);

  return sendPaginated(
    res, 200, "Exams fetched.",
    { exams },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Get exam details ─────────────────────────────────────────────────────────
// Returns exam metadata only — title, duration, totalMarks, sprint, batch, etc.
// Questions are intentionally excluded here (both for students and admins).
// Full question content (text + options) is delivered only via startAttempt,
// which enforces batch membership + creates the attempt record atomically.

exports.getExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id)
    .select("-questions")                          // never expose questions in metadata call
    .populate("sprint", "name status durationMinutes")
    .populate("batch", "name")
    .lean();

  if (!exam) return next(new AppError("Exam not found.", 404));

  // Students: enforce batch membership + only show published/completed exams
  if (req.user.role === ROLES.STUDENT) {
    const student = await User.findById(req.user.id).select("batch").lean();
    if (!student?.batch || student.batch.toString() !== exam.batch._id.toString()) {
      return next(new AppError("You are not authorised to view this exam.", 403));
    }
    if (![EXAM_STATUS.PUBLISHED, EXAM_STATUS.COMPLETED].includes(exam.status)) {
      return next(new AppError("This exam is not available.", 404));
    }
  }

  return sendSuccess(res, 200, "Exam fetched.", { exam });
});

// ─── Admin: Update exam metadata ──────────────────────────────────────────────

exports.updateExam = asyncHandler(async (req, res, next) => {
  const allowedUpdates = ["title", "durationMinutes", "scheduledAt", "status", "instructions"];
  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const exam = await Exam.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!exam) return next(new AppError("Exam not found.", 404));

  return sendSuccess(res, 200, "Exam updated.", { exam });
});

// ─── Student: Start an attempt ────────────────────────────────────────────────

exports.startAttempt = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id)
    .populate("sprint", "name status")
    .lean();

  if (!exam) return next(new AppError("Exam not found.", 404));
  if (exam.status !== EXAM_STATUS.PUBLISHED) {
    return next(new AppError("This exam is not available for attempt.", 400));
  }

  // Enforce batch membership
  const student = await User.findById(req.user.id).select("batch").lean();
  if (!student?.batch || student.batch.toString() !== exam.batch.toString()) {
    return next(new AppError("You are not assigned to this exam's batch.", 403));
  }

  // Resume or block if already attempted
  const existingAttempt = await Attempt.findOne({ student: req.user.id, exam: exam._id });
  if (existingAttempt) {
    if (existingAttempt.status === ATTEMPT_STATUS.SUBMITTED) {
      return next(new AppError("You have already submitted this exam.", 409));
    }

    // ── Hydrate for resume ─────────────────────────────────────────────────
    const QuestionModel = req.app.get("QuestionModel");
    let resumeQuestions = exam.questions;

    if (QuestionModel && resumeQuestions.length > 0) {
      const questionIds = resumeQuestions.map((q) => q.questionId);
      const questionBankDocs = await QuestionModel.find({ _id: { $in: questionIds } })
        .select("text hasLatex questionImage options idealTimeSeconds")
        .lean();
      resumeQuestions = hydrateQuestions(resumeQuestions, questionBankDocs, true);
    } else {
      resumeQuestions = stripAnswers(resumeQuestions);
    }

    return sendSuccess(res, 200, "Resuming existing attempt.", {
      attempt: existingAttempt,
      exam: { ...exam, questions: resumeQuestions },
    });
  }

  // ── SECURITY: DO NOT store correctAnswer in the Attempt document ─────────────
  // correctAnswer is kept only in Exam.questions and is looked up at submit time.
  const responses = exam.questions.map((q) => ({
    slotPosition:     q.slotPosition,
    questionId:       q.questionId,
    subject:          q.subject,
    chapter:          q.chapter,
    topic:            q.topic,
    difficulty:       q.difficulty,
    questionType:     q.questionType,
    hasImage:         Boolean(q.hasImage),
    marks:            q.marks,
    negativeMarks:    q.negativeMarks,
    // correctAnswer intentionally omitted
    selectedAnswer:   null,
    isCorrect:        null,
    isAttempted:      false,
    timeSpentSeconds: 0,
    sequencePosition: null,
    marksAwarded:     0,
  }));

  // FIX: Handle double-submit race condition — two concurrent startAttempt calls
  // from the same student would both pass findOne before either create runs.
  // Catch the E11000 from the unique index and return a friendly 409.
  let attempt;
  try {
    attempt = await Attempt.create({
      student:    req.user.id,
      exam:       exam._id,
      sprint:     exam.sprint._id,
      batch:      exam.batch,
      status:     ATTEMPT_STATUS.IN_PROGRESS,
      responses,
      totalMarks: exam.totalMarks,
      startedAt:  new Date(),
    });
  } catch (createErr) {
    if (createErr.code === 11000) {
      // Race condition: attempt was created by a concurrent request — re-fetch and resume
      const concurrent = await Attempt.findOne({ student: req.user.id, exam: exam._id });
      if (concurrent && concurrent.status === ATTEMPT_STATUS.SUBMITTED) {
        return next(new AppError("You have already submitted this exam.", 409));
      }
      if (concurrent) {
        // Hydrate questions for the resumed attempt
        const QuestionModelRace = req.app.get("QuestionModel");
        let raceQuestions = exam.questions;
        if (QuestionModelRace && raceQuestions.length > 0) {
          const qIds = raceQuestions.map((q) => q.questionId);
          const qDocs = await QuestionModelRace.find({ _id: { $in: qIds } })
            .select("text hasLatex questionImage options idealTimeSeconds")
            .lean();
          raceQuestions = hydrateQuestions(raceQuestions, qDocs, true);
        } else {
          raceQuestions = stripAnswers(raceQuestions);
        }
        return sendSuccess(res, 200, "Resuming existing attempt.", {
          attempt: concurrent,
          exam:    { ...exam, questions: raceQuestions },
        });
      }
    }
    throw createErr;
  }

  // ── Hydrate questions with text/options from Question Bank ──────────────
  const QuestionModel = req.app.get("QuestionModel");
  let examQuestions = exam.questions;

  if (QuestionModel && examQuestions.length > 0) {
    const questionIds = examQuestions.map((q) => q.questionId);
    const questionBankDocs = await QuestionModel.find({ _id: { $in: questionIds } })
      .select("text hasLatex questionImage options idealTimeSeconds")
      .lean();                                        // solution intentionally excluded

    examQuestions = hydrateQuestions(examQuestions, questionBankDocs, true); // stripAnswer=true
  } else {
    examQuestions = stripAnswers(examQuestions);
  }

  return sendSuccess(res, 201, "Attempt started.", {
    attempt: { _id: attempt._id, startedAt: attempt.startedAt, status: attempt.status },
    exam:    { ...exam, questions: examQuestions },
  });
});

// ─── Student: Submit attempt ──────────────────────────────────────────────────

exports.submitAttempt = asyncHandler(async (req, res, next) => {
  const { responses: submittedResponses, totalTimeSeconds } = req.body;

  // FIX: Atomically claim the attempt for submission before doing any work.
  // Without this, two concurrent submit calls (double-click, client retry) both
  // read status=IN_PROGRESS before either writes, both score the attempt, and
  // both run the post-submission email/analytics pipeline. findOneAndUpdate with
  // status:IN_PROGRESS in the filter guarantees only one request can win this race.
  const attempt = await Attempt.findOneAndUpdate(
    {
      _id:     req.params.attemptId,
      student: req.user.id,
      status:  ATTEMPT_STATUS.IN_PROGRESS,
    },
    { status: ATTEMPT_STATUS.SUBMITTED },
    { new: false } // we need the pre-update doc (with responses/startedAt) below
  );

  if (!attempt) {
    // Either the attempt doesn't exist/belong to this student, or it was already
    // submitted (possibly by a concurrent request that just won the race above).
    const existing = await Attempt.findOne({ _id: req.params.attemptId, student: req.user.id }).select("status").lean();
    if (existing?.status === ATTEMPT_STATUS.SUBMITTED) {
      return next(new AppError("This attempt has already been submitted.", 409));
    }
    return next(new AppError("Attempt not found.", 404));
  }

  // From here on the attempt is claimed (status=SUBMITTED in the DB already).
  // Any early-exit below MUST revert it to IN_PROGRESS first, otherwise the
  // attempt gets stuck "submitted" with stale/unscored data and the student
  // can never resubmit or resume it.
  const revertClaim = async () => {
    attempt.status = ATTEMPT_STATUS.IN_PROGRESS;
    await attempt.save({ validateBeforeSave: false });
  };

  let exam;
  try {
    // Fetch exam — correctAnswer lives here, NOT in the attempt
    exam = await Exam.findById(attempt.exam).lean();
    if (!exam) {
      await revertClaim();
      return next(new AppError("Exam not found.", 404));
    }

    // Enforce time limit — prevent 0-second submissions that corrupt analytics
    const maxAllowedSeconds = exam.durationMinutes * 60 + 60; // +60s grace

    // FIX: Also enforce the exam window against wall-clock time, not just the
    // client-reported totalTimeSeconds. Without this, a student can leave an
    // attempt open indefinitely (hours/days) and submit later with a fabricated
    // totalTimeSeconds that looks legitimate — the timer is otherwise purely
    // cosmetic on the frontend. A generous grace period tolerates real network/
    // device hiccups without penalizing honest students.
    const DEADLINE_GRACE_SECONDS = 10 * 60; // 10 extra minutes beyond the exam duration
    const elapsedWallClockSeconds = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000;
    if (elapsedWallClockSeconds > maxAllowedSeconds + DEADLINE_GRACE_SECONDS) {
      await revertClaim();
      return next(
        new AppError(
          "This exam's time window has expired. Please contact support — your progress has been saved.",
          400
        )
      );
    }

    if (totalTimeSeconds < 0 || totalTimeSeconds > maxAllowedSeconds) {
      await revertClaim();
      return next(
        new AppError(
          `Invalid totalTimeSeconds. Expected 0–${maxAllowedSeconds}s.`,
          400
        )
      );
    }

    // Build slot → examQuestion map for score computation
    const examQMap = {};
    for (const q of exam.questions) {
      examQMap[q.slotPosition] = q;
    }

    const submittedMap = new Map();
    for (const response of submittedResponses) {
      if (!examQMap[response.slotPosition]) {
        await revertClaim();
        return next(new AppError(`Invalid response slotPosition: ${response.slotPosition}.`, 400));
      }
      if (submittedMap.has(response.slotPosition)) {
        await revertClaim();
        return next(new AppError(`Duplicate response slotPosition: ${response.slotPosition}.`, 400));
      }
      submittedMap.set(response.slotPosition, response);
    }

    let score = 0;

    // Build final responses — use .toObject() to get plain object per subdoc
    const finalResponses = attempt.responses.map((storedResp) => {
    const resp     = storedResp.toObject();
    const submitted = submittedMap.get(resp.slotPosition);
    const examQ    = examQMap[resp.slotPosition];

    if (!submitted || submitted.selectedAnswer === null) {
      return {
        ...resp,
        correctAnswer:    examQ.correctAnswer,
        questionType:     examQ.questionType || resp.questionType || "mcq",
        hasImage:         Boolean(examQ.hasImage || resp.hasImage),
        selectedAnswer:  null,
        isAttempted:     false,
        isCorrect:       null,
        marksAwarded:    0,
        timeSpentSeconds: submitted?.timeSpentSeconds || 0,
        sequencePosition: submitted?.sequencePosition || null,
        firstAnswerTimeSeconds: submitted?.firstAnswerTimeSeconds ?? null,
        lastAnswerTimeSeconds: submitted?.lastAnswerTimeSeconds ?? null,
        reattemptDelaySeconds: submitted?.reattemptDelaySeconds ?? null,
        wasReattempted:  submitted?.wasReattempted   || false,
        answerChanges:   submitted?.answerChanges    || 0,
        initialAnswer:   submitted?.initialAnswer    || null,
        finalAnswer:     null,
        confidence:      submitted?.confidence       || null,
      };
    }

    const isCorrect   = submitted.selectedAnswer === examQ.correctAnswer;
    const marksAwarded = isCorrect ? examQ.marks : -examQ.negativeMarks;
    score += marksAwarded;

    return {
      ...resp,
      correctAnswer:    examQ.correctAnswer,
      questionType:     examQ.questionType || resp.questionType || "mcq",
      hasImage:         Boolean(examQ.hasImage || resp.hasImage),
      selectedAnswer:  submitted.selectedAnswer,
      isAttempted:     true,
      isCorrect,
      marksAwarded,
      timeSpentSeconds: submitted.timeSpentSeconds || 0,
      sequencePosition: submitted.sequencePosition || null,
      firstAnswerTimeSeconds: submitted.firstAnswerTimeSeconds ?? null,
      lastAnswerTimeSeconds: submitted.lastAnswerTimeSeconds ?? submitted.firstAnswerTimeSeconds ?? null,
      reattemptDelaySeconds: submitted.reattemptDelaySeconds ?? null,
      wasReattempted:  submitted.wasReattempted    || false,
      answerChanges:   submitted.answerChanges     || 0,
      initialAnswer:   submitted.initialAnswer     || null,
      finalAnswer:     submitted.selectedAnswer,
      confidence:      submitted.confidence        || null,
    };
  });

    attempt.responses        = finalResponses;
    attempt.score            = parseFloat(score.toFixed(2));
    // FIX: Clamp percentage to 0 minimum — negative scores are valid NEET behaviour
    // but a negative percentage confuses downstream analytics and UI charts.
    attempt.percentage       = parseFloat((Math.max(0, score) / attempt.totalMarks * 100).toFixed(2));
    attempt.totalTimeSeconds = totalTimeSeconds;
    attempt.status           = ATTEMPT_STATUS.SUBMITTED;
    attempt.submittedAt      = new Date();
    await attempt.save();
  } catch (err) {
    // Any failure while scoring/saving must not leave the attempt stuck as
    // SUBMITTED with stale/unscored data — revert the atomic claim so the
    // student can retry.
    await revertClaim().catch(() => {});
    throw err;
  }

  // Submission confirmation email — fetch student outside setImmediate so req is not needed later
  const studentDoc = await User.findById(req.user.id).select("name email").lean();

  await sendEmail({
    to:          studentDoc.email,
    subject:     `Submission Confirmed — ${exam.title}`,
    html:        templates.examSubmitted({
      name:       studentDoc.name,
      examTitle:  exam.title,
      examNumber: exam.examNumber,
    }),
    trigger:     NOTIFICATION_TRIGGER.EXAM_SUBMITTED,
    recipientId: studentDoc._id,
    contextRef:  attempt._id,
  });

  // ── Capture all values we need BEFORE setImmediate (req/res may be GC'd) ─────
  const attemptSnapshot = {
    _id:         attempt._id,
    sprint:      attempt.sprint,
    batch:       attempt.batch,
    exam:        attempt.exam,
    // FIX: capture exam title/number explicitly — 'exam' variable from outer scope
    // was accessed in setImmediate closure inconsistently. Snapshot it here.
    examTitle:   exam.title,
    examNumber:  exam.examNumber,
  };
  const studentSnapshot = {
    _id:   studentDoc._id,
    name:  studentDoc.name,
    email: studentDoc.email,
  };

  // ── Async analytics pipeline — does not block the HTTP response ───────────────
  setImmediate(async () => {
    try {
      const populatedAttempt = await Attempt.findById(attemptSnapshot._id).lean();
      const { computeCompleteAnalytics } = require("../services/analytics.service");
      await computeCompleteAnalytics(populatedAttempt);
      await Attempt.findByIdAndUpdate(attemptSnapshot._id, { analyticsComputed: true });

      const { updateObjectiveProbability } = require("../services/probability.service");
      await updateObjectiveProbability(
        studentSnapshot._id,
        attemptSnapshot.sprint,
        attemptSnapshot._id,
        populatedAttempt.responses
      );

      // Coverage formulas — now that syllabus data is seeded
      const { updateSyllabusProgress } = require("../services/coverage.service");
      await updateSyllabusProgress(
        studentSnapshot._id,
        attemptSnapshot.sprint,
        attemptSnapshot._id,
        populatedAttempt.responses
      );

      await sendEmail({
        to:          studentSnapshot.email,
        subject:     `Results Ready — ${attemptSnapshot.examTitle}`,
        html:        templates.analyticsReady({
          name:        studentSnapshot.name,
          examTitle:   attemptSnapshot.examTitle,
          examNumber:  attemptSnapshot.examNumber,
          dashboardUrl: `${process.env.CLIENT_URL}/dashboard`,
        }),
        trigger:     NOTIFICATION_TRIGGER.ANALYTICS_READY,
        recipientId: studentSnapshot._id,
        contextRef:  attemptSnapshot._id,
      });

      // Notify admins when entire batch has submitted
      const [totalBatchStudents, submittedCount] = await Promise.all([
        User.countDocuments({ batch: attemptSnapshot.batch, role: ROLES.STUDENT, isActive: true }),
        Attempt.countDocuments({ exam: attemptSnapshot.exam, status: ATTEMPT_STATUS.SUBMITTED }),
      ]);

      if (submittedCount >= totalBatchStudents) {
        const admins = await User.find({
          role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
          isActive: true,
        }).lean();
        const batchDoc = await Batch.findById(attemptSnapshot.batch).lean();

        await Promise.allSettled(
          admins.map((admin) =>
            sendEmail({
              to:          admin.email,
              subject:     `Batch Analytics Updated — ${batchDoc?.name || "Batch"}`,
              html:        templates.batchAnalyticsUpdated({
                adminName:   admin.name,
                batchName:   batchDoc?.name || "Batch",
                dashboardUrl: `${process.env.CLIENT_URL}/admin/dashboard`,
              }),
              trigger:     NOTIFICATION_TRIGGER.BATCH_ANALYTICS_UPDATED,
              recipientId: admin._id,
              contextRef:  attemptSnapshot.exam,
            })
          )
        );
      }
    } catch (err) {
      console.error("[Analytics] Post-submission pipeline failed:", err.message);
    }
  });

  return sendSuccess(res, 200, "Exam submitted successfully.", {
    attemptId:   attempt._id,
    score:       attempt.score,
    totalMarks:  attempt.totalMarks,
    percentage:  attempt.percentage,
    submittedAt: attempt.submittedAt,
  });
});

// ─── Student: List exams for own batch ───────────────────────────────────────
// Returns all published (and completed) exams belonging to the student's batch.
// Questions array is stripped — students must call startAttempt to get questions.
// Also annotates each exam with the student's own attempt status so the frontend
// can show "Start", "Resume", or "View Result" buttons without a second request.

exports.getMyExams = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { sprintId, status } = req.query;

  // ── 1. Resolve student's batch ────────────────────────────────────────────
  const student = await User.findById(req.user.id).select("batch isActive").lean();

  if (!student) return next(new AppError("Student account not found.", 404));
  if (!student.isActive) return next(new AppError("Your account is inactive. Please contact admin.", 403));
  if (!student.batch) {
    return next(new AppError("You are not assigned to any batch yet. Please contact admin.", 400));
  }

  // ── 2. Build query — students only see published/completed exams ──────────
  const filter = {
    batch:  student.batch,
    status: { $in: [EXAM_STATUS.PUBLISHED, EXAM_STATUS.COMPLETED] },
  };

  if (sprintId) {
    // Basic ObjectId format guard — avoids a Mongoose CastError on bad input
    if (!/^[a-f\d]{24}$/i.test(sprintId)) {
      return next(new AppError("Invalid sprintId format.", 400));
    }
    filter.sprint = sprintId;
  }

  // Allow filtering by a specific status, but only within the allowed set
  if (status) {
    const allowed = [EXAM_STATUS.PUBLISHED, EXAM_STATUS.COMPLETED];
    if (!allowed.includes(status)) {
      return next(new AppError(`Invalid status filter. Allowed: ${allowed.join(", ")}.`, 400));
    }
    filter.status = status;
  }

  // ── 3. Fetch exams + total count in parallel ──────────────────────────────
  const [exams, total] = await Promise.all([
    Exam.find(filter)
      .select("-questions")                          // never expose questions/answers in list
      .populate("sprint", "name status")
      .populate("batch",  "name")
      .sort({ examNumber: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Exam.countDocuments(filter),
  ]);

  if (exams.length === 0) {
    return res.status(200).json({
      success:    true,
      message:    "No exams found.",
      data:       { exams: [] },
      pagination: buildPaginationMeta(total, page, limit),
    });
  }

  // ── 4. Annotate with student's own attempt status ─────────────────────────
  // Single query — fetch all attempts for this student across the current page
  const examIds = exams.map((e) => e._id);
  const attempts = await Attempt.find({
    student: req.user.id,
    exam:    { $in: examIds },
  })
    .select("exam status score totalMarks percentage submittedAt startedAt")
    .lean();

  // Build a map for O(1) lookup per exam
  const attemptMap = {};
  for (const a of attempts) {
    attemptMap[a.exam.toString()] = a;
  }

  const annotatedExams = exams.map((exam) => {
    const attempt = attemptMap[exam._id.toString()];
    return {
      ...exam,
      attempt: attempt
        ? {
            _id:          attempt._id,
            status:       attempt.status,
            score:        attempt.score        ?? null,
            totalMarks:   attempt.totalMarks   ?? exam.totalMarks ?? null,
            percentage:   attempt.percentage   ?? null,
            submittedAt:  attempt.submittedAt  ?? null,
            startedAt:    attempt.startedAt    ?? null,
          }
        : null,
    };
  });

  return res.status(200).json({
    success:    true,
    message:    "Exams fetched successfully.",
    data:       { exams: annotatedExams },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Student: Get own attempts list ──────────────────────────────────────────

exports.getMyAttempts = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { sprintId } = req.query;

  const filter = { student: req.user.id, status: ATTEMPT_STATUS.SUBMITTED };
  if (sprintId) filter.sprint = sprintId;

  const [attempts, total] = await Promise.all([
    Attempt.find(filter)
      .populate("exam", "title examNumber durationMinutes totalMarks")
      .populate("sprint", "name")
      .select("-responses")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attempt.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Attempts fetched.",
    data: { attempts },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Get single attempt detail ────────────────────────────────────────────────

exports.getAttemptDetail = asyncHandler(async (req, res, next) => {
  const query =
    req.user.role === ROLES.STUDENT
      ? { _id: req.params.attemptId, student: req.user.id }
      : { _id: req.params.attemptId };

  const attempt = await Attempt.findOne(query)
    .populate("exam", "title examNumber durationMinutes totalMarks")
    .populate("sprint", "name")
    .select("-responses.correctAnswer")   // never return correctAnswer via API
    .lean();

  if (!attempt) return next(new AppError("Attempt not found.", 404));

  return sendSuccess(res, 200, "Attempt detail fetched.", { attempt });
});

// ─── Student: Get attempt detail WITH hydrated question content ───────────────
// This endpoint enriches each response with full question text, options, and
// solution from the Question Bank DB — needed for the analytics Solutions tab.
// correctAnswer is included post-submission so students can review answers.

exports.getAttemptWithQuestions = asyncHandler(async (req, res, next) => {
  const query =
    req.user.role === ROLES.STUDENT
      ? { _id: req.params.attemptId, student: req.user.id }
      : { _id: req.params.attemptId };

  const attempt = await Attempt.findOne(query)
    .populate("exam", "title examNumber durationMinutes totalMarks")
    .populate("sprint", "name")
    .lean();

  if (!attempt) return next(new AppError("Attempt not found.", 404));

  // Only enrich submitted attempts — in-progress attempts must not expose answers
  if (attempt.status !== ATTEMPT_STATUS.SUBMITTED) {
    return next(new AppError("Question details are only available after submission.", 403));
  }

  const examDoc = await Exam.findById(attempt.exam?._id || attempt.exam).select("questions").lean();
  const correctAnswerMap = {};
  for (const q of examDoc?.questions || []) {
    correctAnswerMap[q.slotPosition] = q.correctAnswer;
  }

  // Get QuestionModel from the question bank connection
  const QuestionModel = req.app.get("QuestionModel");

  if (!QuestionModel || !attempt.responses || attempt.responses.length === 0) {
    const responsesWithAnswers = (attempt.responses || []).map((resp) => ({
      ...resp,
      correctAnswer: correctAnswerMap[resp.slotPosition] || resp.correctAnswer || null,
    }));

    // Graceful degradation: return attempt without question-bank enrichment.
    return sendSuccess(res, 200, "Attempt detail fetched (no question bank connection).", {
      attempt: {
        ...attempt,
        responses: responsesWithAnswers,
      },
    });
  }

  // Batch-fetch all questions in one DB call
  const questionIds = attempt.responses.map((r) => r.questionId).filter(Boolean);

  const questionBankDocs = await QuestionModel.find({ _id: { $in: questionIds } })
    .select("text hasLatex questionImage options solution subject chapter topic difficulty classLevel idealTimeSeconds")
    .lean();

  // Build a lookup map: questionId (string) → full question doc
  const qbMap = {};
  for (const q of questionBankDocs) {
    qbMap[q._id.toString()] = q;
  }

  // Merge question content into each response
  const enrichedResponses = attempt.responses.map((resp) => {
    const qId  = resp.questionId ? resp.questionId.toString() : null;
    const qDoc = qId ? qbMap[qId] : null;

    if (!qDoc) {
      // Question not found in bank — return as-is with slot metadata only
      return {
        ...resp,
        correctAnswer: correctAnswerMap[resp.slotPosition] || resp.correctAnswer || null,
        questionData: {
          text:          "Question content unavailable",
          options:       [],
          subject:       resp.subject  || "",
          chapter:       resp.chapter  || "",
          topic:         resp.topic    || "",
          difficulty:    resp.difficulty || "",
          hasLatex:      false,
          questionImage: null,
          solution:      null,
          correctAnswer: correctAnswerMap[resp.slotPosition] || resp.correctAnswer || null,
        },
      };
    }

    return {
      ...resp,
      correctAnswer: correctAnswerMap[resp.slotPosition] || resp.correctAnswer || null,
      questionData: {
        text:          qDoc.text          || "",
        hasLatex:      qDoc.hasLatex      || false,
        questionImage: qDoc.questionImage || null,
        options:       qDoc.options       || [],
        solution:      qDoc.solution      || null,
        correctAnswer: correctAnswerMap[resp.slotPosition] || resp.correctAnswer || null,
        subject:       qDoc.subject       || resp.subject  || "",
        chapter:       qDoc.chapter       || resp.chapter  || "",
        topic:         qDoc.topic         || resp.topic    || "",
        difficulty:    qDoc.difficulty    || resp.difficulty || "",
        classLevel:    qDoc.classLevel    || "",
        idealTimeSeconds: qDoc.idealTimeSeconds || null,
      },
    };
  });

  return sendSuccess(res, 200, "Attempt detail with questions fetched.", {
    attempt: {
      ...attempt,
      responses: enrichedResponses,
    },
  });
});

// ─── Admin: List all attempts for an exam ────────────────────────────────────

exports.listExamAttempts = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return next(new AppError("Exam not found.", 404));

  const filter = { exam: req.params.id };

  const [attempts, total] = await Promise.all([
    Attempt.find(filter)
      .populate("student", "name email")
      .select("-responses")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attempt.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Exam attempts fetched.",
    data: {
      exam: { _id: exam._id, title: exam.title, examNumber: exam.examNumber },
      attempts,
    },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Admin: Delete a draft exam ───────────────────────────────────────────────
// Only DRAFT exams can be deleted. Published exams may already have attempts
// associated with them — deleting them would corrupt analytics/attempt data.

exports.deleteExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return next(new AppError("Exam not found.", 404));

  if (exam.status !== EXAM_STATUS.DRAFT) {
    return next(
      new AppError(
        `Cannot delete a ${exam.status} exam. Only DRAFT exams can be deleted. ` +
        `Set status back to "draft" first if no attempts exist.`,
        400
      )
    );
  }

  // Extra safety: block if any attempts exist even for a draft exam
  const attemptCount = await Attempt.countDocuments({ exam: exam._id });
  if (attemptCount > 0) {
    return next(
      new AppError(
        `Cannot delete exam — it has ${attemptCount} associated attempt(s). ` +
        `Delete the attempts first or deactivate the exam instead.`,
        409
      )
    );
  }

  await exam.deleteOne();

  return sendSuccess(res, 200, "Exam deleted successfully.", {
    deletedExamId: exam._id,
  });
});
