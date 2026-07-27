/**
 * seedAdmin.js — One-time bootstrap script to seed a Super Admin.
 *
 * Usage:
 *   node seedAdmin.js
 *
 * Optional env overrides (set in .env or pass inline):
 *   SEED_ADMIN_NAME     — default: "Super Admin"
 *   SEED_ADMIN_EMAIL    — default: "superadmin@examneeti.com"
 *   SEED_ADMIN_PASSWORD — default: auto-generated (printed to console)
 *
 * Rules:
 *   - Safe to run multiple times. Skips if email already exists.
 *   - super_admin can ONLY be created via this script, never via the API.
 *   - The plain-text password is only shown ONCE in the terminal. Store it safely.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

// ─── Credentials ──────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || "superadmin@examneeti.com";
const SUPER_ADMIN_NAME     = process.env.SEED_ADMIN_NAME     || "Super Admin";
// If not set, generate a strong random password and display it once
const SUPER_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString("hex");

// ─── Minimal inline schema (avoids app bootstrap side-effects) ────────────────

const userSchema = new mongoose.Schema(
  {
    name:                 { type: String,  required: true, trim: true },
    email:                { type: String,  required: true, unique: true, lowercase: true, trim: true },
    password:             { type: String,  required: true, select: false },
    role:                 { type: String,  enum: ["student", "admin", "super_admin"], default: "student" },
    batch:                { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null },
    isActive:             { type: Boolean, default: true },
    passwordResetToken:   { type: String,  select: false },
    passwordResetExpires: { type: Date,    select: false },
    passwordChangedAt:    { type: Date,    select: false },
    lastLoginAt:          { type: Date,    default: null },
    profilePicture:       { type: String,  default: null },
    phone:                { type: String,  default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error("\n[Seed] ✖  MONGO_URI is not set. Check your .env file.\n");
    process.exit(1);
  }

  console.log("\n[Seed] Connecting to MongoDB...");

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("[Seed] ✔  Connected:", mongoose.connection.host);

  const User = mongoose.models.User || mongoose.model("User", userSchema);

  // ── Idempotency check ────────────────────────────────────────────────────────
  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL }).lean();

  if (existing) {
    console.log(`\n[Seed] ℹ  Super admin already exists.`);
    console.log(`         Email : ${existing.email}`);
    console.log(`         Role  : ${existing.role}`);
    console.log(`         Active: ${existing.isActive}`);
    console.log("\n[Seed] No changes made.\n");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Create ───────────────────────────────────────────────────────────────────
  const admin = await User.create({
    name:     SUPER_ADMIN_NAME,
    email:    SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    role:     "super_admin",
    isActive: true,
  });

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         Super Admin Seeded Successfully          ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  ID       : ${admin._id}`);
  console.log(`║  Name     : ${SUPER_ADMIN_NAME}`);
  console.log(`║  Email    : ${SUPER_ADMIN_EMAIL}`);
  console.log(`║  Role     : super_admin`);
  console.log(`║  Password : ${SUPER_ADMIN_PASSWORD}`);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  ⚠  Change this password after first login!      ║");
  console.log("║  ⚠  This is the only time it will be shown.      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  await mongoose.disconnect();
  console.log("[Seed] ✔  Done.\n");
  process.exit(0);
}

seed().catch((err) => {
  console.error("\n[Seed] ✖  Fatal error:", err.message, "\n");
  mongoose.disconnect().finally(() => process.exit(1));
});
