const Exam = require("../models/Exam.model");
const Attempt = require("../models/Attempt.model");
const Sprint = require("../models/Sprint.model");
const Batch = require("../models/Batch.model");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
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

// ─── Admin: Generate (create) a new exam for a batch ─────────────────────────

exports.generateExam = asyncHandler(async (req, res, next) => {
  const { sprintId, batchId, title, durationMinutes, scheduledAt, instructions } = req.body;

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

  // Determine the next exam number in this sprint for this batch
  const lastExam = await Exam.findOne({ sprint: sprintId, batch: batchId })
    .sort({ examNumber: -1 })
    .lean();
  const examNumber = lastExam ? lastExam.examNumber + 1 : 1;

  // Create placeholder first so we have an examId for usage logging
  const exam = await Exam.create({
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

  return res.status(200).json({
    success: true,
    message: "Exams fetched.",
    data: { exams },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── Get exam details ─────────────────────────────────────────────────────────

exports.getExam = asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id)
    .populate("sprint", "name totalQuestions durationMinutes")
    .populate("batch", "name")
    .lean();

  if (!exam) return next(new AppError("Exam not found.", 404));

  // Students must not see correctAnswer before they submit
  // Also enforce batch membership — a student cannot view exams from other batches
  if (req.user.role === ROLES.STUDENT) {
    const student = await User.findById(req.user.id).select("batch").lean();
    if (!student?.batch || student.batch.toString() !== exam.batch._id.toString()) {
      return next(new AppError("You are not authorised to view this exam.", 403));
    }
    exam.questions = stripAnswers(exam.questions);
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
    return sendSuccess(res, 200, "Resuming existing attempt.", {
      attempt: existingAttempt,
      exam: { ...exam, questions: stripAnswers(exam.questions) },
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

  const attempt = await Attempt.create({
    student:    req.user.id,
    exam:       exam._id,
    sprint:     exam.sprint._id,
    batch:      exam.batch,
    status:     ATTEMPT_STATUS.IN_PROGRESS,
    responses,
    totalMarks: exam.totalMarks,
    startedAt:  new Date(),
  });

  return sendSuccess(res, 201, "Attempt started.", {
    attempt: { _id: attempt._id, startedAt: attempt.startedAt, status: attempt.status },
    exam:    { ...exam, questions: stripAnswers(exam.questions) },
  });
});

// ─── Student: Submit attempt ──────────────────────────────────────────────────

exports.submitAttempt = asyncHandler(async (req, res, next) => {
  const { responses: submittedResponses, totalTimeSeconds } = req.body;

  const attempt = await Attempt.findOne({
    _id:     req.params.attemptId,
    student: req.user.id,
  });

  if (!attempt) return next(new AppError("Attempt not found.", 404));
  if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
    return next(new AppError("This attempt has already been submitted.", 409));
  }

  // Fetch exam — correctAnswer lives here, NOT in the attempt
  const exam = await Exam.findById(attempt.exam).lean();
  if (!exam) return next(new AppError("Exam not found.", 404));

  // Enforce time limit — prevent 0-second submissions that corrupt analytics
  const maxAllowedSeconds = exam.durationMinutes * 60 + 60; // +60s grace
  if (totalTimeSeconds < 0 || totalTimeSeconds > maxAllowedSeconds) {
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

  let score = 0;

  // Build final responses — use .toObject() to get plain object per subdoc
  const finalResponses = attempt.responses.map((storedResp) => {
    const resp     = storedResp.toObject();
    const submitted = submittedResponses.find((r) => r.slotPosition === resp.slotPosition);
    const examQ    = examQMap[resp.slotPosition];

    if (!submitted || submitted.selectedAnswer === null) {
      return {
        ...resp,
        selectedAnswer:  null,
        isAttempted:     false,
        isCorrect:       null,
        marksAwarded:    0,
        timeSpentSeconds: submitted?.timeSpentSeconds || 0,
        sequencePosition: submitted?.sequencePosition || null,
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
      selectedAnswer:  submitted.selectedAnswer,
      isAttempted:     true,
      isCorrect,
      marksAwarded,
      timeSpentSeconds: submitted.timeSpentSeconds || 0,
      sequencePosition: submitted.sequencePosition || null,
      wasReattempted:  submitted.wasReattempted    || false,
      answerChanges:   submitted.answerChanges     || 0,
      initialAnswer:   submitted.initialAnswer     || null,
      finalAnswer:     submitted.selectedAnswer,
      confidence:      submitted.confidence        || null,
    };
  });

  attempt.responses        = finalResponses;
  attempt.score            = parseFloat(score.toFixed(2));
  attempt.percentage       = parseFloat(((score / attempt.totalMarks) * 100).toFixed(2));
  attempt.totalTimeSeconds = totalTimeSeconds;
  attempt.status           = ATTEMPT_STATUS.SUBMITTED;
  attempt.submittedAt      = new Date();
  await attempt.save();

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
    _id:    attempt._id,
    sprint: attempt.sprint,
    batch:  attempt.batch,
    exam:   attempt.exam,
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

      await sendEmail({
        to:          studentSnapshot.email,
        subject:     `Results Ready — ${exam.title}`,
        html:        templates.analyticsReady({
          name:        studentSnapshot.name,
          examTitle:   exam.title,
          examNumber:  exam.examNumber,
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
