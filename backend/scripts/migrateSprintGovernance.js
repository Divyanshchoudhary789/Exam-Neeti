/**
 * migrateSprintGovernance.js — one-time backfill for the Phase 2 sprint
 * governance fields (subjectProgress, activityLog, deletionRequest).
 *
 * REQUIRED before/with the deploy that added the multi-admin subject workflow
 * and the super-admin-approved delete flow. Without it:
 *   • existing draft sprints have an empty subjectProgress, so the new
 *     activation gate would report "the blueprint has no subjects";
 *   • existing sprints have no deletionRequest sub-doc.
 *
 * What it does, per sprint:
 *   • subjectProgress: if empty, seed one row per distinct subject in
 *     patternSlots. Already-active/completed/archived sprints get every
 *     subject marked "done" (they were live before this workflow existed);
 *     drafts get "pending".
 *   • deletionRequest: default to { status: "none" } if missing.
 *   • activityLog: if empty, seed a single synthetic "created" entry from
 *     createdBy so the history view isn't blank for legacy sprints.
 *   • classLevel: left as-is (null) — organisational only, set it in the UI.
 *
 * Safe + idempotent: only fills what's missing.
 *
 * Usage:  node scripts/migrateSprintGovernance.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Sprint = require("../models/Sprint.model");
const { SPRINT_STATUS } = require("../config/constants");

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("\n[migrate] ✖  MONGO_URI not set in .env\n");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("[migrate] Connected to platform DB.");

  const sprints = await Sprint.find({}).lean();
  console.log(`[migrate] ${sprints.length} sprint(s) to check.`);

  let touched = 0;

  for (const s of sprints) {
    const set = {};

    const hasProgress = Array.isArray(s.subjectProgress) && s.subjectProgress.length > 0;
    if (!hasProgress) {
      const subjects = [
        ...new Set((s.patternSlots || []).map((sl) => String(sl.subject).toLowerCase())),
      ];
      const done = s.status !== SPRINT_STATUS.DRAFT; // active/completed/archived → treat as complete
      set.subjectProgress = subjects.map((subject) => ({
        subject,
        status: done ? "done" : "pending",
        markedBy: {},
        markedAt: done ? (s.updatedAt || s.createdAt || new Date()) : null,
        note: done ? "Backfilled — sprint pre-dates the per-subject workflow." : "",
      }));
    }

    if (!s.deletionRequest || !s.deletionRequest.status) {
      set.deletionRequest = { status: "none" };
    }

    if (!Array.isArray(s.activityLog) || s.activityLog.length === 0) {
      set.activityLog = [{
        action: "created",
        byUserId: s.createdBy || null,
        byEmail: "",
        byRole: "",
        at: s.createdAt || new Date(),
        meta: { backfilled: true },
      }];
    }

    if (Object.keys(set).length > 0) {
      await Sprint.updateOne({ _id: s._id }, { $set: set });
      touched++;
      console.log(`[migrate] ✔  ${s.name}`);
    }
  }

  console.log(`\n[migrate] Done — updated ${touched} of ${sprints.length} sprint(s).\n`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error("\n[migrate] ✖  Failed:", err.message, "\n");
  process.exit(1);
});
