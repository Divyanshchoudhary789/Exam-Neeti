const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
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
const { sendEmail, templates } = require("../services/email.service");
const { NOTIFICATION_TRIGGER, ROLES, ADMIN_ACTIONS } = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const crypto = require("crypto");

/** Escape special regex characters to prevent ReDoS */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Admin: Create a single student ──────────────────────────────────────────

exports.createStudent = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password: providedPassword } = req.body;
  const targetBatchId = req.body.batchId || req.body.batch;

  const batch = await Batch.findById(targetBatchId);
  if (!batch) return next(new AppError("Batch not found.", 404));

  // Auto-generate password if not provided
  const plainPassword =
    providedPassword || crypto.randomBytes(6).toString("hex");

  const student = await User.create({
    name,
    email,
    phone,
    password: plainPassword,
    role: ROLES.STUDENT,
    batch: targetBatchId,
  });

  await sendEmail({
    to: student.email,
    subject: "Welcome to Exam Neeti — Your Account is Ready",
    html: templates.accountCreated({
      name: student.name,
      email: student.email,
      password: plainPassword,
    }),
    trigger: NOTIFICATION_TRIGGER.ACCOUNT_CREATED,
    recipientId: student._id,
    contextRef: student._id,
  });

  const response = {
    _id: student._id,
    name: student.name,
    email: student.email,
    role: student.role,
    batch: student.batch,
    createdAt: student.createdAt,
  };

  return sendSuccess(res, 201, "Student account created successfully.", {
    student: response,
  });
});

// ─── Admin: Bulk import students into a batch ─────────────────────────────────

exports.bulkImportStudents = asyncHandler(async (req, res, next) => {
  const { students, batchId } = req.body;

  const batch = await Batch.findById(batchId);
  if (!batch) return next(new AppError("Batch not found.", 404));

  // FIX: Single DB query to find all already-registered emails (was N queries)
  const emails = students.map((s) => s.email.toLowerCase().trim());
  const existingUsers = await User.find(
    { email: { $in: emails } },
    "email"
  ).lean();
  const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const toCreate   = [];
  const failedFast = [];

  for (const studentData of students) {
    const email = studentData.email?.toLowerCase().trim();
    if (!email) {
      failedFast.push({ email: studentData.email || "(empty)", reason: "Email is required." });
      continue;
    }
    if (existingEmails.has(email)) {
      failedFast.push({ email: studentData.email, reason: "Email already registered." });
      continue;
    }
    toCreate.push(studentData);
  }

  // FIX: Parallel creates instead of sequential
  const createResults = await Promise.allSettled(
    toCreate.map(async (studentData) => {
      const plainPassword = studentData.password || crypto.randomBytes(6).toString("hex");
      const student = await User.create({
        name:     studentData.name,
        email:    studentData.email,
        phone:    studentData.phone || null,
        password: plainPassword,
        role:     ROLES.STUDENT,
        batch:    batchId,
      });
      return { student, plainPassword };
    })
  );

  const results = { created: [], failed: [...failedFast] };

  // FIX: Collect created students and fire emails in background (non-blocking)
  const emailQueue = [];
  for (let i = 0; i < createResults.length; i++) {
    const r = createResults[i];
    if (r.status === "fulfilled") {
      const { student, plainPassword } = r.value;
      results.created.push({ _id: student._id, email: student.email, name: student.name });
      emailQueue.push({ student, plainPassword });
    } else {
      results.failed.push({ email: toCreate[i].email, reason: r.reason?.message || "Unknown error." });
    }
  }

  // Send welcome emails in the background — do not block the HTTP response
  setImmediate(() => {
    Promise.allSettled(
      emailQueue.map(({ student, plainPassword }) =>
        sendEmail({
          to:          student.email,
          subject:     "Welcome to Exam Neeti — Your Account is Ready",
          html:        templates.accountCreated({
            name:     student.name,
            email:    student.email,
            password: plainPassword,
          }),
          trigger:     NOTIFICATION_TRIGGER.ACCOUNT_CREATED,
          recipientId: student._id,
          contextRef:  student._id,
        })
      )
    ).then((settled) => {
      const failed = settled.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error(`[bulkImport] ${failed.length} welcome email(s) failed to send.`);
      }
    });
  });

  return sendSuccess(res, 207, "Bulk import completed.", {
    totalProcessed: students.length,
    totalCreated:   results.created.length,
    totalFailed:    results.failed.length,
    created:        results.created,
    failed:         results.failed,
  });
});

// ─── Admin: List all students (paginated, filterable by batch) ────────────────

exports.listStudents = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { batchId, search, isActive } = req.query;

  const filter = { role: ROLES.STUDENT };
  if (batchId) filter.batch = batchId;
  if (isActive !== undefined && isActive !== "") filter.isActive = isActive === "true";
  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name:  { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const [students, total] = await Promise.all([
    User.find(filter)
      .select("-password -passwordResetToken -passwordResetExpires")
      .populate("batch", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return sendPaginated(
    res, 200, "Students fetched successfully.",
    { students },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Admin: Get single student ────────────────────────────────────────────────

exports.getStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
  })
    .populate("batch", "name description")
    .lean();

  if (!student) return next(new AppError("Student not found.", 404));

  return sendSuccess(res, 200, "Student fetched.", { student });
});

// ─── Admin: Update student ────────────────────────────────────────────────────

exports.updateStudent = asyncHandler(async (req, res, next) => {
  const allowedFields = ["name", "phone", "batch", "isActive"];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.batch) {
    const batch = await Batch.findById(updates.batch);
    if (!batch) return next(new AppError("Batch not found.", 404));
  }

  const student = await User.findOneAndUpdate(
    { _id: req.params.id, role: ROLES.STUDENT },
    updates,
    { returnDocument: "after", runValidators: true }
  ).populate("batch", "name");

  if (!student) return next(new AppError("Student not found.", 404));

  return sendSuccess(res, 200, "Student updated successfully.", { student });
});

// ─── Admin: Deactivate student ────────────────────────────────────────────────

exports.deactivateStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });

  if (!student) return next(new AppError("Student not found.", 404));

  if (!student.isActive) {
    return next(new AppError("Student is already deactivated.", 400));
  }

  student.isActive = false;
  await student.save({ validateModifiedOnly: true });

  await AdminAuditLog.create({
    actor:       req.user.id,
    actorRole:   req.user.role,
    action:      ADMIN_ACTIONS.STUDENT_DEACTIVATED,
    target:      student._id,
    targetEmail: student.email,
    metadata:    { name: student.name, batchId: student.batch },
    ip:          req.ip,
    userAgent:   req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Student deactivated successfully.", {
    _id:      student._id,
    isActive: student.isActive,
  });
});

// ─── Admin: Reactivate student ────────────────────────────────────────────────

exports.reactivateStudent = asyncHandler(async (req, res, next) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });

  if (!student) return next(new AppError("Student not found.", 404));

  if (student.isActive) {
    return next(new AppError("Student is already active.", 400));
  }

  student.isActive = true;
  await student.save({ validateModifiedOnly: true });

  await AdminAuditLog.create({
    actor:       req.user.id,
    actorRole:   req.user.role,
    action:      ADMIN_ACTIONS.STUDENT_REACTIVATED,
    target:      student._id,
    targetEmail: student.email,
    metadata:    { name: student.name, batchId: student.batch },
    ip:          req.ip,
    userAgent:   req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Student reactivated successfully.", {
    _id:      student._id,
    isActive: student.isActive,
  });
});

// ─── Admin: Hard-delete a student ────────────────────────────────────────────
//
// Permanently removes the student and ALL their associated data:
//   • Attempts
//   • AnalyticsResults
//   • StudentProbability records
//   • Reports owned by this student
//
// This action is IRREVERSIBLE. Only super_admin can perform it.
// A confirmation token (the student's email) must be passed in the request body
// to prevent accidental deletions.

exports.deleteStudent = asyncHandler(async (req, res, next) => {
  const { confirmEmail } = req.body;

  const student = await User.findOne({
    _id: req.params.id,
    role: ROLES.STUDENT,
  });

  if (!student) return next(new AppError("Student not found.", 404));

  // Require the caller to confirm by echoing the student's email back
  if (!confirmEmail || confirmEmail.toLowerCase() !== student.email.toLowerCase()) {
    return next(
      new AppError(
        "Confirmation failed. Pass the student's email as `confirmEmail` to proceed.",
        400
      )
    );
  }

  // Run all cascading deletes in parallel for efficiency
  await Promise.all([
    Attempt.deleteMany({ student: student._id }),
    AnalyticsResult.deleteMany({ student: student._id }),
    AdvancedAnalytics.deleteMany({ student: student._id }),
    StudentProbability.deleteMany({ student: student._id }),
    SyllabusProgress.deleteMany({ student: student._id }),
    Report.deleteMany({ owner: student._id }),
    NotificationLog.deleteMany({ recipient: student._id }),
  ]);

  // Delete the user document last, after all related data is gone
  await student.deleteOne();

  // Immutable audit trail
  await AdminAuditLog.create({
    actor:       req.user.id,
    actorRole:   req.user.role,
    action:      ADMIN_ACTIONS.STUDENT_DELETED,
    target:      student._id,
    targetEmail: student.email,
    metadata: {
      name:    student.name,
      batchId: student.batch,
    },
    ip:        req.ip,
    userAgent: req.get("user-agent") || null,
  });

  return sendSuccess(res, 200, "Student and all associated data permanently deleted.", {
    deletedStudentId: student._id,
    email:            student.email,
  });
});

// ─── Student: Get own profile ─────────────────────────────────────────────────

exports.getMyProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .populate("batch", "name description")
    .lean();

  if (!user) return next(new AppError("User not found.", 404));

  return sendSuccess(res, 200, "Profile fetched.", { user });
});

// ─── Student: Update own profile ──────────────────────────────────────────────

exports.updateMyProfile = asyncHandler(async (req, res, next) => {
  const allowedFields = ["name", "phone"];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    returnDocument: "after",
    runValidators: true,
  }).populate("batch", "name");

  return sendSuccess(res, 200, "Profile updated.", { user });
});
