/**
 * AdminAuditLog — immutable append-only audit trail for all admin actions.
 * Records are never deleted — only indexed and queried.
 */

const mongoose = require("mongoose");
const { ROLES, ADMIN_ACTIONS } = require("../config/constants");

const adminAuditLogSchema = new mongoose.Schema(
  {
    /** Who performed the action */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    /** Role at time of action — enum-validated to prevent junk data */
    actorRole: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    /** What action was performed */
    action: {
      type: String,
      enum: Object.values(ADMIN_ACTIONS),
      required: true,
    },
    /** Who was affected — null for self-actions like login */
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    targetEmail: {
      type: String,
      default: null,
    },
    /** Snapshot of what changed — before/after for updates */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Client IP for security tracing */
    ip: {
      type: String,
      default: null,
    },
    /** User-Agent string */
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    // Append-only: disable updatedAt entirely
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Indexes for efficient querying
adminAuditLogSchema.index({ actor:   1, createdAt: -1 });
adminAuditLogSchema.index({ target:  1, createdAt: -1 });
adminAuditLogSchema.index({ action:  1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
