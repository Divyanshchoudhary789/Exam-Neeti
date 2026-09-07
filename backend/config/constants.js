/**
 * Platform-wide constants. Keep all magic values here.
 */

const ROLES = Object.freeze({
  STUDENT:     "student",
  ADMIN:       "admin",
  SUPER_ADMIN: "super_admin",
});

// How a user account authenticates. "local" = email + password,
// "google" = created/linked via Google Sign-In (OpenID Connect).
const AUTH_PROVIDERS = Object.freeze({
  LOCAL:  "local",
  GOOGLE: "google",
});

const CLASS_LEVELS = Object.freeze({
  XI:      "XI",
  XII:     "XII",
  DROPPER: "dropper",
});

// Program types map to which class-level bucket each batch runs
const PROGRAM_TYPES = Object.freeze({
  CLASS_XI:       "class_xi",
  CLASS_XII:      "class_xii",
  DROPPER:        "dropper",
});

const DIFFICULTY = Object.freeze({
  EASY:   "easy",
  MEDIUM: "medium",
  HARD:   "hard",
});

const QUESTION_TYPE = Object.freeze({
  MCQ: "mcq",
});

/**
 * Question review lifecycle.
 *   draft    → freshly bulk-uploaded / awaiting an owning admin's review.
 *   active   → reviewed & approved. The ONLY status usable in exams and
 *              sprint slot-pinning (strict — see questionReconstruction.service.js
 *              and sprint.controller.js validateSlotPins/listSlotQuestions).
 *   rejected → reviewed & turned down. Never exam-eligible. Kept (not deleted)
 *              so the rejection + reason stay on the activity trail; an owner
 *              or super_admin can send it back to draft to rework it.
 */
const QUESTION_STATUS = Object.freeze({
  DRAFT:    "draft",
  ACTIVE:   "active",
  REJECTED: "rejected",
});

const SUBJECTS = Object.freeze({
  BIOLOGY:   "biology",
  CHEMISTRY: "chemistry",
  PHYSICS:   "physics",
});

const ATTEMPT_STATUS = Object.freeze({
  IN_PROGRESS: "in_progress",
  SUBMITTED:   "submitted",
});

const EXAM_STATUS = Object.freeze({
  DRAFT:     "draft",
  PUBLISHED: "published",
  COMPLETED: "completed",
});

const SPRINT_STATUS = Object.freeze({
  DRAFT:     "draft",    // initial state before activation
  ACTIVE:    "active",
  COMPLETED: "completed",
  ARCHIVED:  "archived",
});

const REPORT_TYPE = Object.freeze({
  STUDENT_OVERALL:    "student_overall",
  STUDENT_SUBJECT:    "student_subject",
  STUDENT_CHAPTER:    "student_chapter",
  STUDENT_TIME:       "student_time",
  STUDENT_ACCURACY:   "student_accuracy",
  STUDENT_RECOVERABLE:"student_recoverable",
  ADMIN_SPRINT:       "admin_sprint",
  ADMIN_BATCH:        "admin_batch",
  ADMIN_STUDENT:      "admin_student",
  ADMIN_COMPARATIVE:  "admin_comparative",
});

const REPORT_FORMAT = Object.freeze({
  PDF:   "pdf",
  EXCEL: "excel",
});

const REPORT_SCOPE = Object.freeze({
  SINGLE_TEST:  "single_test",
  FULL_SPRINT:  "full_sprint",
  BATCH:        "batch",
  // A single student, addressed by scopeRefId. Lets an admin / super admin
  // pull any student's individual (student_*) reports.
  STUDENT:      "student",
});

// Used in report.service.js status updates — centralised to avoid magic strings
const REPORT_STATUS = Object.freeze({
  PENDING: "pending",
  READY:   "ready",
  FAILED:  "failed",
});

const NOTIFICATION_TRIGGER = Object.freeze({
  ACCOUNT_CREATED:        "account_created",
  EXAM_AVAILABLE:         "exam_available",
  EXAM_SUBMITTED:         "exam_submitted",
  ANALYTICS_READY:        "analytics_ready",
  REPORT_EMAILED:         "report_emailed",
  BATCH_ANALYTICS_UPDATED:"batch_analytics_updated",
  SPRINT_COMPLETED:       "sprint_completed",
  PASSWORD_RESET:         "password_reset",
  ADMIN_INVITED:          "admin_invited",
  ADMIN_DELETED:          "admin_deleted",
  SELF_REGISTERED:        "self_registered",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
});

const NOTIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  SENT:    "sent",
  FAILED:  "failed",
});

// Questionnaire self-assessment levels used in probability
const QUESTIONNAIRE_LEVELS = Object.freeze({
  NEVER_STUDIED:   "never_studied",
  STARTED:         "started",
  CAN_SOLVE_BASIC: "can_solve_basic",
  COMFORTABLE:     "comfortable",
  CAN_EXPLAIN:     "can_explain",
});

// Admin audit actions — exported here AND from model for backward compat
const ADMIN_ACTIONS = Object.freeze({
  ADMIN_CREATED:     "admin_created",
  ADMIN_UPDATED:     "admin_updated",
  ADMIN_DEACTIVATED: "admin_deactivated",
  ADMIN_REACTIVATED: "admin_reactivated",
  ADMIN_DELETED:     "admin_deleted",
  ROLE_CHANGED:      "role_changed",
  LOGIN:             "login",
  PASSWORD_CHANGED:  "password_changed",
  PASSWORD_RESET:    "password_reset",
  STUDENT_DEACTIVATED: "student_deactivated",
  STUDENT_REACTIVATED: "student_reactivated",
  STUDENT_DELETED:     "student_deleted",
  BATCH_DEACTIVATED:   "batch_deactivated",
  BATCH_REACTIVATED:   "batch_reactivated",
  BATCH_DELETED:       "batch_deleted",
  // Question bank — the question's own append-only activityLog covers the
  // full lifecycle while the doc exists; these AdminAuditLog actions capture
  // the events that outlive (delete) or span (bulk) individual documents.
  QUESTION_DELETED:       "question_deleted",
  QUESTION_BULK_DEACTIVATED: "question_bulk_deactivated",
  // Sprint — same reasoning: the sprint's activityLog is gone once it's
  // deleted, so the deletion itself is mirrored to the platform audit log.
  SPRINT_DELETE_REQUESTED: "sprint_delete_requested",
  SPRINT_DELETE_APPROVED:  "sprint_delete_approved",
  SPRINT_DELETE_REJECTED:  "sprint_delete_rejected",
  SPRINT_DELETED:          "sprint_deleted",
  // Self-serve plan catalog — the plan's linked public batch is created /
  // removed alongside it, so these capture the whole lifecycle.
  PLAN_CREATED:            "plan_created",
  PLAN_UPDATED:            "plan_updated",
  PLAN_DELETED:            "plan_deleted",
});

// Test types: minor (chapter test), semi-major (half-sprint), major (full syllabus)
const EXAM_TYPE = Object.freeze({
  MINOR:      "minor",
  SEMI_MAJOR: "semi_major",
  MAJOR:      "major",
});

// A student may attempt any one exam at most this many times (Revisit/Reattempt).
const MAX_ATTEMPTS_PER_EXAM = 2;

// Batch.source — 'coaching' batches are admin-managed & always active (billed
// offline). 'public' batches back the self-serve plan catalog (see Plan model)
// and are the only batches subject to Subscription expiry checks.
const BATCH_SOURCE = Object.freeze({
  COACHING: "coaching",
  PUBLIC:   "public",
});

const SUBSCRIPTION_STATUS = Object.freeze({
  TRIAL:     "trial",
  ACTIVE:    "active",
  EXPIRED:   "expired",
  CANCELLED: "cancelled",
});

const ORDER_STATUS = Object.freeze({
  CREATED: "created",
  PAID:    "paid",
  FAILED:  "failed",
});

// Self-serve plan catalog keys — each maps 1:1 to a seeded public Batch.
const PLAN_KEYS = Object.freeze({
  TRIAL:           "trial",
  SIGNATURE_ENTRY: "signature_entry",
  CORE:            "core",
  PRIME:           "prime",
  ELITE:           "elite",
});

module.exports = {
  ROLES,
  AUTH_PROVIDERS,
  CLASS_LEVELS,
  PROGRAM_TYPES,
  EXAM_TYPE,
  MAX_ATTEMPTS_PER_EXAM,
  BATCH_SOURCE,
  SUBSCRIPTION_STATUS,
  ORDER_STATUS,
  PLAN_KEYS,
  DIFFICULTY,
  QUESTION_TYPE,
  QUESTION_STATUS,
  SUBJECTS,
  ATTEMPT_STATUS,
  EXAM_STATUS,
  SPRINT_STATUS,
  REPORT_TYPE,
  REPORT_FORMAT,
  REPORT_SCOPE,
  REPORT_STATUS,
  NOTIFICATION_TRIGGER,
  NOTIFICATION_STATUS,
  QUESTIONNAIRE_LEVELS,
  ADMIN_ACTIONS,
};
