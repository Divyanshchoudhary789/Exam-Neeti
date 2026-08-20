/**
 * Admin Team Management Controller
 *
 * All endpoints are super_admin only.
 *
 * Responsibilities:
 *  - Create / list / view / update / deactivate / reactivate admin accounts
 *  - Immutable audit trail via AdminAuditLog
 *  - Email notification on admin invite
 *  - Platform-wide stats visible only to super_admin
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const AdminAuditLog = require("../models/AdminAuditLog.model");
const Batch = require("../models/Batch.model");
const Exam = require("../models/Exam.model");
const Attempt = require("../models/Attempt.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { sendEmail, templates } = require("../services/email.service");
const { NOTIFICATION_TRIGGER, ROLES, ATTEMPT_STATUS, ADMIN_ACTIONS } = require("../config/constants");

/** Escape special regex characters to prevent ReDoS */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Internal helper: write an audit log entry ────────────────────────────────

const writeAudit = async ({ actor, action, target = null, metadata = {}, req }) => {
  try {
    // req.user shape is { id, email, role } — note "id" not "_id"
    // Mongoose documents use "_id"; plain objects from lean() may use either.
    // Resolve to a raw ObjectId-compatible value in priority order.
    const actorId   = actor._id ?? actor.id ?? actor;
    const actorRole = actor.role ?? req?.user?.role;

    await AdminAuditLog.create({
      actor:       actorId,
      actorRole,
      action,
      target:      target?._id ?? target?.id ?? target ?? null,
      targetEmail: target?.email ?? null,
      metadata,
      ip:          req?.ip ?? null,
      userAgent:   req?.headers?.["user-agent"] ?? null,
    });
  } catch (err) {
    // Audit log failure must NEVER break the main request
    console.error("[Audit] Failed to write audit log:", err.message);
  }
};

// ─── GET /admin-team  — List all admins (paginated, filterable) ───────────────

exports.listAdmins = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { search, role, isActive } = req.query;

  const filter = {
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  };

  // Filter by specific role if provided
  if (role && [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role)) {
    filter.role = role;
  }

  // Filter by active status
  if (isActive !== undefined) {
    filter.isActive = isActive === "true" || isActive === true;
  }

  // Search by name or email — escape to prevent ReDoS
  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name:  { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const [admins, total] = await Promise.all([
    User.find(filter)
      .select("-password -passwordResetToken -passwordResetExpires -passwordChangedAt")
      .sort({ role: 1, createdAt: -1 })   // super_admin first, then admins
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Admin team fetched successfully.",
    data: { admins },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── GET /admin-team/:id  — Get single admin profile ─────────────────────────

exports.getAdmin = asyncHandler(async (req, res, next) => {
  const admin = await User.findOne({
    _id:  req.params.id,
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  })
    .select("-password -passwordResetToken -passwordResetExpires -passwordChangedAt")
    .lean();

  if (!admin) return next(new AppError("Admin not found.", 404));

  // Fetch their recent audit activity
  const recentActivity = await AdminAuditLog.find({
    $or: [{ actor: admin._id }, { target: admin._id }],
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("actor", "name email role")
    .populate("target", "name email role")
    .lean();

  return sendSuccess(res, 200, "Admin profile fetched.", {
    admin,
    recentActivity,
  });
});

// ─── POST /admin-team  — Create a new admin ───────────────────────────────────

exports.createAdmin = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password: providedPassword } = req.body;

  // Prevent duplicate accounts
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return next(new AppError("An account with this email already exists.", 409));
  }

  // Auto-generate a secure temporary password if not provided
  const plainPassword = providedPassword || crypto.randomBytes(10).toString("hex");

  const admin = await User.create({
    name,
    email,
    phone:    phone || null,
    password: plainPassword,
    role:     ROLES.ADMIN,
    isActive: true,
  });

  // FIX: this was `await`ed despite the "non-blocking" comment — an SMTP
  // hiccup would hold the "create admin" request open. Genuinely fire-and-forget now.
  setImmediate(() => {
    sendEmail({
      to:          admin.email,
      subject:     "You have been added to Exam Neeti Admin Team",
      html:        templates.adminInvited({
        name,
        email,
        password:   plainPassword,
        role:       admin.role,
        invitedBy:  req.user.email,
      }),
      trigger:     NOTIFICATION_TRIGGER.ADMIN_INVITED,
      recipientId: admin._id,
      contextRef:  admin._id,
    }).catch((err) => console.error("[AdminTeam] Invite email failed:", err.message));
  });

  // Write audit log
  await writeAudit({
    actor:    req.user,
    action:   ADMIN_ACTIONS.ADMIN_CREATED,
    target:   admin,
    metadata: { name: admin.name, email: admin.email, role: admin.role },
    req,
  });

  const response = {
    _id:       admin._id,
    name:      admin.name,
    email:     admin.email,
    role:      admin.role,
    isActive:  admin.isActive,
    createdAt: admin.createdAt,
  };

  return sendSuccess(res, 201, "Admin created. Invite email is being sent.", {
    admin: response,
  });
});

// ─── PATCH /admin-team/:id  — Update admin name / phone ──────────────────────

exports.updateAdmin = asyncHandler(async (req, res, next) => {
  const target = await User.findOne({
    _id:  req.params.id,
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  });

  if (!target) return next(new AppError("Admin not found.", 404));

  // A regular admin can only update their own profile.
  // super_admin can update any admin's profile EXCEPT another super_admin
  // (super_admin can still update themselves).
  if (req.user.role === ROLES.ADMIN) {
    if (target._id.toString() !== req.user.id) {
      return next(
        new AppError("Admins can only update their own profile.", 403)
      );
    }
  }

  // Even super_admin cannot edit another super_admin's profile
  if (
    target.role === ROLES.SUPER_ADMIN &&
    target._id.toString() !== req.user.id
  ) {
    return next(
      new AppError("Super admin profile can only be edited by themselves.", 403)
    );
  }

  const allowedFields = ["name", "phone"];
  const before = {};
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      before[field]  = target[field];
      updates[field] = req.body[field];
    }
  }

  const updatedAdmin = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    { returnDocument: "after", runValidators: true }
  ).select("-password -passwordResetToken -passwordResetExpires -passwordChangedAt");

  await writeAudit({
    actor:    req.user,
    action:   ADMIN_ACTIONS.ADMIN_UPDATED,
    target,
    metadata: { before, after: updates },
    req,
  });

  return sendSuccess(res, 200, "Admin updated successfully.", {
    admin: updatedAdmin,
  });
});

// ─── PATCH /admin-team/:id/deactivate  — Deactivate admin ────────────────────

exports.deactivateAdmin = asyncHandler(async (req, res, next) => {
  const target = await User.findOne({
    _id:  req.params.id,
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  });

  if (!target) return next(new AppError("Admin not found.", 404));

  // Prevent self-deactivation
  if (target._id.toString() === req.user.id) {
    return next(new AppError("You cannot deactivate your own account.", 400));
  }

  // Prevent deactivating another super_admin
  if (target.role === ROLES.SUPER_ADMIN) {
    return next(new AppError("Super admin accounts cannot be deactivated.", 403));
  }

  if (!target.isActive) {
    return next(new AppError("Admin is already deactivated.", 400));
  }

  target.isActive = false;
  await target.save({ validateBeforeSave: false });

  await writeAudit({
    actor:    req.user,
    action:   ADMIN_ACTIONS.ADMIN_DEACTIVATED,
    target,
    metadata: { email: target.email },
    req,
  });

  return sendSuccess(res, 200, "Admin deactivated successfully.", {
    _id:      target._id,
    isActive: target.isActive,
  });
});

// ─── PATCH /admin-team/:id/reactivate  — Reactivate admin ────────────────────

exports.reactivateAdmin = asyncHandler(async (req, res, next) => {
  const target = await User.findOne({
    _id:  req.params.id,
    role: ROLES.ADMIN,      // only admins can be reactivated this way
  });

  if (!target) return next(new AppError("Admin not found.", 404));

  if (target.isActive) {
    return next(new AppError("Admin is already active.", 400));
  }

  target.isActive = true;
  await target.save({ validateBeforeSave: false });

  await writeAudit({
    actor:    req.user,
    action:   ADMIN_ACTIONS.ADMIN_REACTIVATED,
    target,
    metadata: { email: target.email },
    req,
  });

  return sendSuccess(res, 200, "Admin reactivated successfully.", {
    _id:      target._id,
    isActive: target.isActive,
  });
});

// ─── DELETE /admin-team/:id  — Permanently delete admin account ──────────────
//
// Hard delete is intentionally a distinct, irreversible operation separate from
// deactivation. Deactivate = lock out. Delete = full removal + data scrub.
//
// Safety guardrails (all enforced server-side, never trust client):
//  1. Cannot delete yourself.
//  2. Cannot delete another super_admin — only seed script manages super_admins.
//  3. Optional "reason" body field is recorded in the audit log for accountability.
//  4. Audit log is written BEFORE deletion so the actor reference is still valid.
//  5. Notification email is sent to the deleted admin's address (best-effort).
//  6. All active sessions are invalidated by clearing refreshTokenHash — the
//     access token is short-lived and will expire on its own (acceptable window).

exports.deleteAdmin = asyncHandler(async (req, res, next) => {
  const { reason } = req.body; // optional justification — saved in audit metadata

  const target = await User.findOne({
    _id:  req.params.id,
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
  });

  // 404 — admin not found or not an admin role
  if (!target) return next(new AppError("Admin not found.", 404));

  // Guard 1 — self-delete prevention
  if (target._id.toString() === req.user.id) {
    return next(new AppError("You cannot delete your own account.", 400));
  }

  // Guard 2 — super_admin accounts are immutable via API
  if (target.role === ROLES.SUPER_ADMIN) {
    return next(
      new AppError(
        "Super admin accounts cannot be deleted via the API. Use the database directly if absolutely required.",
        403
      )
    );
  }

  // Capture a snapshot of the target before deletion — audit log needs this
  const snapshot = {
    _id:       target._id,
    name:      target.name,
    email:     target.email,
    role:      target.role,
    isActive:  target.isActive,
    createdAt: target.createdAt,
  };

  // Write audit log BEFORE deletion — actor/target refs must exist in DB at write time.
  // If audit write fails (non-throwing by design in writeAudit), we still proceed.
  await writeAudit({
    actor:    req.user,
    action:   ADMIN_ACTIONS.ADMIN_DELETED,
    target,
    metadata: {
      deletedAdmin: snapshot,
      reason:       reason || null,
    },
    req,
  });

  // Hard delete the user document from the database
  await User.deleteOne({ _id: target._id });

  // Best-effort notification to the deleted admin — fire-and-forget
  sendEmail({
    to:          snapshot.email,
    subject:     "Your Exam Neeti admin account has been deleted",
    html:        templates.adminDeleted({
      name:      snapshot.name,
      deletedBy: req.user.email,
    }),
    trigger:     NOTIFICATION_TRIGGER.ADMIN_DELETED,
    recipientId: snapshot._id,   // no longer in DB but log references the old id
    contextRef:  snapshot._id,
  }).catch((err) =>
    console.error("[deleteAdmin] Email notification failed:", err.message)
  );

  return sendSuccess(res, 200, "Admin account permanently deleted.", {
    deleted: {
      _id:   snapshot._id,
      name:  snapshot.name,
      email: snapshot.email,
    },
  });
});

// ─── GET /admin-team/audit-logs  — Audit log viewer ──────────────────────────

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const { adminId, action, startDate, endDate } = req.query;

  const filter = {};

  if (adminId && adminId.trim()) {
    const cleanSearch = adminId.trim();
    if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
      filter.$or = [{ actor: cleanSearch }, { target: cleanSearch }];
    } else {
      const regex = new RegExp(escapeRegex(cleanSearch), "i");
      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      })
        .select("_id")
        .lean();

      const userIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        { actor: { $in: userIds } },
        { target: { $in: userIds } },
        { targetEmail: regex },
      ];
    }
  }

  if (action && action.trim()) {
    filter.action = new RegExp(escapeRegex(action.trim()), "i");
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actor", "name email role")
      .populate("target", "name email role")
      .lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    message: "Audit logs fetched.",
    data: { logs },
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// ─── GET /admin-team/platform-stats  — Platform-wide stats for super admin ────

exports.getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalAdmins,
    activeAdmins,
    totalStudents,
    activeStudents,
    totalBatches,
    activeBatches,
    totalExams,
    totalAttempts,
    recentAdmins,
  ] = await Promise.all([
    // FIX: Include both admin and super_admin in team counts (was excluding super_admin)
    User.countDocuments({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }),
    User.countDocuments({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] }, isActive: true }),
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({ role: ROLES.STUDENT, isActive: true }),
    Batch.countDocuments(),
    Batch.countDocuments({ isActive: true }),
    Exam.countDocuments(),
    Attempt.countDocuments({ status: ATTEMPT_STATUS.SUBMITTED }),
    // FIX: Include super_admin in recent admins list too
    User.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } })
      .select("name email role isActive lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return sendSuccess(res, 200, "Platform stats fetched.", {
    team: {
      totalAdmins,
      activeAdmins,
      inactiveAdmins: totalAdmins - activeAdmins,
    },
    students: {
      total:    totalStudents,
      active:   activeStudents,
      inactive: totalStudents - activeStudents,
    },
    platform: {
      totalBatches,
      activeBatches,
      totalExams,
      totalAttempts,
    },
    recentAdmins,
  });
});
