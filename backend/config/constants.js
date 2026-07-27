/**
 * Platform-wide constants. Keep all magic values here.
 */

const ROLES = Object.freeze({
  STUDENT:     "student",
  ADMIN:       "admin",
  SUPER_ADMIN: "super_admin",
});

const DIFFICULTY = Object.freeze({
  EASY:   "easy",
  MEDIUM: "medium",
  HARD:   "hard",
});

const QUESTION_TYPE = Object.freeze({
  MCQ: "mcq",
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
});

module.exports = {
  ROLES,
  DIFFICULTY,
  QUESTION_TYPE,
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
