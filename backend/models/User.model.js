const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../config/constants");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.STUDENT,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /**
     * refreshTokenHash stores a SHA-256 hash of the most-recently issued refresh token.
     * On logout this is cleared so the old token can never be used again.
     * On /refresh-token we verify against this hash before issuing a new access token.
     */
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    /**
     * The previous refreshTokenHash, kept for a short grace window after
     * rotation. Lets a concurrent refresh request (multi-tab, retried
     * network call) that read the token just before it was rotated succeed
     * instead of being treated as reuse and nuking every active session —
     * see backend/controllers/auth.controller.js refreshToken().
     */
    previousRefreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    refreshTokenRotatedAt: {
      type: Date,
      select: false,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Hash password before saving ──────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);

  // Mark password change time so changedPasswordAfter() works on update
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

// ─── Instance methods ──────────────────────────────────────────────────────────

/** Compare plain-text candidate against stored bcrypt hash */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/** Returns true if password was changed AFTER the JWT was issued */
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return jwtTimestamp < changedAt;
  }
  return false;
};

// ─── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ batch: 1 });

module.exports = mongoose.model("User", userSchema);
