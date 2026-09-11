const mongoose = require("mongoose");
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
const { clientPath } = require("../utils/clientUrl");
const { NOTIFICATION_TRIGGER, ROLES, ADMIN_ACTIONS } = require("../config/constants");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { parseStudentRoster } = require("../utils/studentRosterParser");
const { getStudentTemplateBuffer } = require("../utils/studentRosterTemplate");
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

  // FIX: was `await`ed on the request path — an SMTP hiccup would hold the
  // "create student" request open. Fire-and-forget, matching bulkImportStudents.
  setImmediate(() => {
    sendEmail({
      to: student.email,
      subject: "Welcome to Exam Neeti — Your Account is Ready",
      html: templates.accountCreated({
        name: student.name,
        email: student.email,
        password: plainPassword,
        loginUrl: clientPath("/login"),
      }),
      trigger: NOTIFICATION_TRIGGER.ACCOUNT_CREATED,
      recipientId: student._id,
      contextRef: student._id,
    }).catch((err) => console.error("[User] Welcome email failed:", err.message));
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

/**
 * Shared: create a list of {name,email,phone,password?} students into one
 * batch. Skips already-registered emails, creates the rest in parallel, and
 * fires welcome emails in the background. Returns { created, failed }.
 */
async function createStudentsInBatch(students, batchId, preSkipped = []) {
  const emails = students.map((s) => s.email.toLowerCase().trim());
  const existing = await User.find({ email: { $in: emails } }, "email").lean();
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));

  const toCreate = [];
  const failed = preSkipped.map((s) => ({ row: s.row, email: s.email || null, reason: s.reason }));

  for (const s of students) {
    const email = s.email?.toLowerCase().trim();
    if (!email) { failed.push({ row: s._row, email: s.email || "(empty)", reason: "Email is required." }); continue; }
    if (existingEmails.has(email)) { failed.push({ row: s._row, email: s.email, reason: "Email already registered." }); continue; }
    toCreate.push(s);
  }

  const createResults = await Promise.allSettled(
    toCreate.map(async (s) => {
      const plainPassword = s.password || crypto.randomBytes(6).toString("hex");
      const student = await User.create({
        name: s.name, email: s.email, phone: s.phone || null,
        password: plainPassword, role: ROLES.STUDENT, batch: batchId,
      });
      return { student, plainPassword };
    })
  );

  const created = [];
  const emailQueue = [];
  createResults.forEach((r, i) => {
    if (r.status === "fulfilled") {
      created.push({ _id: r.value.student._id, email: r.value.student.email, name: r.value.student.name });
      emailQueue.push(r.value);
    } else {
      failed.push({ row: toCreate[i]._row, email: toCreate[i].email, reason: r.reason?.message || "Could not create." });
    }
  });

  setImmediate(() => {
    Promise.allSettled(
      emailQueue.map(({ student, plainPassword }) =>
        sendEmail({
          to: student.email,
          subject: "Welcome to Exam Neeti — Your Account is Ready",
          html: templates.accountCreated({ name: student.name, email: student.email, password: plainPassword, loginUrl: clientPath("/login") }),
          trigger: NOTIFICATION_TRIGGER.ACCOUNT_CREATED,
          recipientId: student._id,
          contextRef: student._id,
        })
      )
    ).then((settled) => {
      const n = settled.filter((r) => r.status === "rejected").length;
      if (n > 0) console.error(`[bulkImport] ${n} welcome email(s) failed to send.`);
    });
  });

  return { created, failed };
}

// ─── Admin: Bulk import students (JSON body) ─────────────────────────────────

exports.bulkImportStudents = asyncHandler(async (req, res, next) => {
  const { students, batchId } = req.body;

  const batch = await Batch.findById(batchId);
  if (!batch) return next(new AppError("Batch not found.", 404));

  const { created, failed } = await createStudentsInBatch(students, batchId);

  return sendSuccess(res, 207, "Bulk import completed.", {
    totalProcessed: students.length,
    totalCreated:   created.length,
    totalFailed:    failed.length,
    created,
    failed,
  });
});

// ─── Admin: Bulk import students from an uploaded .xlsx / .docx roster ────────

exports.bulkImportStudentsFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded. Attach a .xlsx or .docx file as "file".', 400));
  }
  const batchId = req.body.batchId || req.body.batch;
  if (!batchId || !/^[a-f\d]{24}$/i.test(batchId)) {
    return next(new AppError("A valid target batchId is required.", 400));
  }
  const batch = await Batch.findById(batchId);
  if (!batch) return next(new AppError("Batch not found.", 404));

  const isXlsx = req.file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const format = isXlsx ? "xlsx" : "docx";

  let parsed;
  try {
    parsed = await parseStudentRoster(req.file.buffer, format);
  } catch (err) {
    return next(err); // AppError with a specific 400 message
  }

  if (parsed.students.length > 500) {
    return next(new AppError(`Too many students in one file (${parsed.students.length}). Maximum 500 per upload.`, 400));
  }

  const { created, failed } = await createStudentsInBatch(parsed.students, batchId, parsed.skipped);

  return sendSuccess(res, 207, "Bulk import completed.", {
    fileName:       req.file.originalname,
    batchName:      batch.name,
    totalRows:      parsed.students.length + parsed.skipped.length,
    totalCreated:   created.length,
    totalFailed:    failed.length,
    created,
    failed,
  });
});

// ─── Admin: Download the sample student roster template ──────────────────────

exports.downloadStudentTemplate = asyncHandler(async (req, res) => {
  const format = req.query.format === "docx" ? "docx" : "xlsx";
  const buffer = await getStudentTemplateBuffer(format);

  const contentType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="exam-neeti-student-roster-template.${format}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.send(buffer);
});

// ─── Admin: List all students (paginated, filterable by batch) ────────────────

exports.listStudents = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { search, isActive } = req.query;
  // Frontends send the batch filter as `batch`; older callers used `batchId`.
  const batchFilter = req.query.batch || req.query.batchId;

  const filter = { role: ROLES.STUDENT };
  if (batchFilter) {
    if (!mongoose.Types.ObjectId.isValid(batchFilter)) {
      return next(new AppError("Invalid batch id.", 400));
    }
    filter.batch = batchFilter;
  }
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
