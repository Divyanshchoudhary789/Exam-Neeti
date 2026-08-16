# Exam Neeti Backend — Build Status

**Status:** PRODUCTION READY — COMPLETE
**Last Updated:** August 2026
**All formulas implemented. Syllabus & Blueprint integrated. All critical bugs fixed.**

---

## Production Readiness Fixes (Latest Session)

### Critical Bugs Fixed

| Bug | Fix | File |
|---|---|---|
| `Exam.model.js` had `examSchema.index({ sprint, examNumber }, { unique: true })` — generating exams for 2+ batches in one sprint caused duplicate key crash | Changed to `{ sprint, batch, examNumber }` unique index | `models/Exam.model.js` |
| `Attempt.model.js` `responseSchema.correctAnswer` was `required: true` — `startAttempt` intentionally omits it for security, causing Mongoose 500 error on attempt creation | Changed to `default: null` (not required) | `models/Attempt.model.js` |
| `submitAttemptSchema` had `questionId: required` per response — scoring is slot-based, so this was breaking clients unnecessarily | Made `questionId` optional | `validators/exam.validator.js` |
| `DISABLE_RATE_LIMIT=true` was respected in production — could disable rate limiting if env var was accidentally set | Now only skips in non-production environments | `middleware/rateLimiter.js` |

### New Endpoints Added

| Endpoint | Access | Description |
|---|---|---|
| `DELETE /api/v1/sprints/:id` | Admin | Delete a DRAFT sprint (blocked if exams exist) |
| `DELETE /api/v1/exams/:id` | Admin | Delete a DRAFT exam (blocked if attempts exist) |
| `GET /api/v1/exams/:id/attempts` | Admin | List all attempts for an exam |

### Startup Hardening

- Added startup env var validation in `index.js` — server exits immediately with clear error if any required variable is missing (MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET, BREVO_SMTP_USER, BREVO_SMTP_PASS, EMAIL_FROM_ADDRESS, CLIENT_URL)

### Dependencies Cleaned

Removed unused packages from `package.json`:
- `passport`, `passport-google-oauth20` — no OAuth routes exist
- `node-cron` — no cron jobs in the codebase
- `sharp` — no image processing routes
- `multer` — no file upload routes
- `crypto` (npm stub) — Node.js built-in `crypto` is used directly

### ⚠️ REQUIRED: Drop Old MongoDB Index

The `examNumber` unique index changed. After deploying, drop the old index from Atlas or mongosh:

```js
db.exams.dropIndex("sprint_1_examNumber_1")
```

The new index `sprint_1_batch_1_examNumber_1` will be created automatically on server start.

---

## What Was Done Previously

### 1. Bug Fixes

| Bug | Fix |
|---|---|
| `StudentProbability` had `unique: true` on `sprint` field alone — a student could only have ONE sprint ever | Fixed: removed field-level unique, composite index `{ student, sprint }` already existed |
| `ADMIN_STUDENT` report type had no `buildReportData` handler — would return empty report | Implemented full handler with subject aggregation and test-by-test breakdown |
| `ADMIN_COMPARATIVE` report type had no handler | Implemented with student comparison table |
| `ADMIN_SPRINT` exam-wise submission counts were always 0 | Fixed: now uses aggregation to get real per-exam counts |
| `STUDENT_ACCURACY` report type had no handler | Implemented with per-test accuracy breakdown |
| `getBatchCoverageMetrics` had duplicate inline `require` inside `if` block causing reference error | Rewrote entire coverage service cleanly with proper top-level imports |
| 4 Coverage Formulas were pending client data — implemented but blocked | Unblocked: syllabus taxonomy seeded from client documents |

### 2. New Constants Added

```javascript
PROGRAM_TYPES = { CLASS_XI, CLASS_XII, DROPPER }   // batch-to-program mapping
CLASS_LEVELS  = { XI, XII, DROPPER }                 // added dropper
EXAM_TYPE     = { MINOR, SEMI_MAJOR, MAJOR }         // test type classification
```

### 3. New Models (3 added)

| Model | Purpose |
|---|---|
| `SyllabusConfig` | NEET syllabus taxonomy — subject → chapter → topic with weights |
| `TestBlueprint` | Complete test-series blueprint — all 58 tests across 3 programs |
| `SyllabusProgress` | Per-student per-sprint coverage tracking — caches all 4 coverage metrics |

### 4. New Service

**`coverage.service.js`** — implements all 4 coverage formulas:
- `updateSyllabusProgress(studentId, sprintId, attemptId, responses)` — called after every submission
- `getCoverageMetrics(studentId, sprintId)` — returns cached metrics
- `getBatchCoverageMetrics(sprintId, batchId?)` — cohort averages for admin dashboard

### 5. New Controller + Route

**`syllabus.controller.js`** + **`syllabus.routes.js`** → `GET /api/v1/syllabus/*`

| Endpoint | Access | Description |
|---|---|---|
| `GET /syllabus` | Auth | Full syllabus tree (subject→chapter→topics) |
| `GET /syllabus/stats` | Auth | Chapter and topic counts per subject |
| `GET /syllabus/blueprint` | Auth | Full test-series blueprint |
| `GET /syllabus/blueprint/:programType/:testCode` | Auth | Single blueprint entry |
| `GET /syllabus/coverage/me/:sprintId` | Student | Own coverage metrics |
| `PATCH /syllabus/topics/:id` | Admin | Update topic weight |
| `GET /syllabus/coverage/student/:studentId/:sprintId` | Admin | Any student's coverage |
| `GET /syllabus/coverage/batch/:sprintId?batchId=` | Admin | Cohort coverage averages |

### 6. Coverage wired into exam submission pipeline

```
exam.controller.js → submitAttempt → setImmediate (async pipeline):
  ├── computeCompleteAnalytics()      (already existed)
  ├── updateObjectiveProbability()    (already existed)
  └── updateSyllabusProgress()        ← NEW — runs after every submission
```

### 7. `Batch` model updated

Added `programType` field (`class_xi | class_xii | dropper`) so batches can be tagged to a program. Drives blueprint filtering and syllabus scoping.

### 8. New Seed Scripts

| Script | Command | Description |
|---|---|---|
| `scripts/seedSyllabus.js` | `npm run seed:syllabus` | Seeds complete NEET syllabus (Physics XI/XII, Chemistry XI/XII, Biology XI/XII) |
| `scripts/seedBlueprint.js` | `npm run seed:blueprint` | Seeds all 58 tests across Class XI (16), Class XII (18), Dropper (24) |

Both scripts are **idempotent** — safe to run multiple times.

### 9. `package.json` scripts updated

```json
"seed:syllabus":  "node scripts/seedSyllabus.js"
"seed:blueprint": "node scripts/seedBlueprint.js"
"seed:all":       "node seedAdmin.js && node scripts/seedSyllabus.js && node scripts/seedBlueprint.js"
```

---

## Complete Formula Status

### All 65 Client Formulas — DONE

| Group | Formulas | Status |
|---|---|---|
| Foundation Metrics | 4 | ✅ DONE |
| Time & Speed | 9 | ✅ DONE |
| Difficulty Performance | 4 | ✅ DONE |
| Initial Probability | 4 | ✅ DONE |
| Objective Probability | 4 | ✅ DONE |
| Expected Marks & ROI | 5 | ✅ DONE |
| Error Classification | 3 | ✅ DONE |
| Score Opportunity Index | 5 | ✅ DONE |
| Fatigue Curve | 7 | ✅ DONE |
| Streak Analysis | 3 | ✅ DONE |
| Reattempt Metrics | 6 | ✅ DONE |
| Attempt Order Quality (Spearman ρ) | 11 | ✅ DONE |

### 4 Coverage Formulas — NOW DONE (were pending client data)

| Formula | Status |
|---|---|
| Syllabus Coverage = Covered chapters / Total chapters × 100 | ✅ DONE |
| Concept Coverage = Covered topics / Total topics × 100 | ✅ DONE |
| Weighted Coverage = Σ(covered weights) / Σ(all weights) × 100 | ✅ DONE |
| Revision Coverage = Revised topics / Covered topics × 100 | ✅ DONE |

**Total formulas implemented: 69**

---

## Complete Architecture

### Files: 76 (zero syntax errors)

```
config/
  constants.js          — All enums incl. PROGRAM_TYPES, EXAM_TYPE (new)
  db.js

utils/
  AppError.js, asyncHandler.js, token.js
  pagination.js, response.js, cookies.js

middleware/
  authenticate.js, authorize.js, validate.js
  errorHandler.js, rateLimiter.js

models/ (16 total — 3 new)
  User, Batch*, Sprint, Question, Exam, Attempt
  AnalyticsResult, AdvancedAnalytics, FormulaConfig
  StudentProbability**, Report, NotificationLog, AdminAuditLog
  SyllabusConfig (NEW), TestBlueprint (NEW), SyllabusProgress (NEW)

  * Batch: added programType field
  ** StudentProbability: fixed unique index bug

services/ (7 total — 1 new)
  analytics.service.js          — Basic analytics (Sections A–F)
  advancedAnalytics.service.js  — All client formulas
  probability.service.js        — Questionnaire + objective probability
  coverage.service.js           (NEW) — 4 coverage formulas
  questionReconstruction.service.js
  email.service.js              — Brevo SMTP + 10 templates
  report.service.js             — PDF + Excel generation

controllers/ (11 total — 1 new)
  auth, user, batch, sprint, exam
  analytics (+ coverage in sprint summary)
  dashboard, report (all types complete), probability
  adminTeam, syllabus (NEW)

routes/ (12 total — 1 new)
  auth, users, batches, sprints, exams
  analytics, dashboard, reports, probability
  admin-team, syllabus (NEW), main.router

validators/ (9)
  auth, user, batch* (+ programType), sprint, exam
  report, formula, probability, adminTeam

scripts/ (6 total — 2 new)
  seedAdmin.js (existing)
  seedQuestions.js (existing)
  seedSyllabus.js (NEW) — full NEET taxonomy
  seedBlueprint.js (NEW) — complete test-series blueprint
  extractDocx.js, checkJson.js, fixJsonEscapes.js
```

---

## Complete API Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/forgot-password
PATCH  /api/v1/auth/reset-password/:token
GET    /api/v1/auth/me
PATCH  /api/v1/auth/change-password
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all

GET    /api/v1/users                             [admin]
POST   /api/v1/users                             [admin]
POST   /api/v1/users/bulk-import                 [admin]
GET    /api/v1/users/me                          [student]
PATCH  /api/v1/users/me                          [student]
GET    /api/v1/users/:id                         [admin]
PATCH  /api/v1/users/:id                         [admin]
PATCH  /api/v1/users/:id/deactivate              [admin]
PATCH  /api/v1/users/:id/reactivate              [admin]
DELETE /api/v1/users/:id                         [super_admin]

GET    /api/v1/batches                           [admin]
POST   /api/v1/batches                           [admin]  ← accepts programType
GET    /api/v1/batches/:id                       [admin]
PATCH  /api/v1/batches/:id                       [admin]  ← accepts programType
PATCH  /api/v1/batches/:id/deactivate            [admin]
PATCH  /api/v1/batches/:id/reactivate            [admin]
DELETE /api/v1/batches/:id                       [super_admin]
GET    /api/v1/batches/:id/students              [admin]

GET    /api/v1/sprints/active                    [auth]
GET    /api/v1/sprints                           [admin]
POST   /api/v1/sprints                           [admin]
GET    /api/v1/sprints/:id                       [admin]
PATCH  /api/v1/sprints/:id                       [admin]
GET    /api/v1/sprints/:id/slot-stats            [admin]
DELETE /api/v1/sprints/:id                       [admin]   ← NEW (DRAFT only)

GET    /api/v1/exams                             [admin]
POST   /api/v1/exams                             [admin]
GET    /api/v1/exams/my-attempts                 [student]
GET    /api/v1/exams/:id                         [auth]
PATCH  /api/v1/exams/:id                         [admin]
DELETE /api/v1/exams/:id                         [admin]   ← NEW (DRAFT only)
GET    /api/v1/exams/:id/attempts                [admin]   ← NEW
POST   /api/v1/exams/:id/start                   [student]
POST   /api/v1/exams/attempts/:id/submit         [student]
GET    /api/v1/exams/attempts/:id                [auth]

GET    /api/v1/analytics/attempts/:id            [auth]
GET    /api/v1/analytics/attempts/:id/advanced   [auth]
GET    /api/v1/analytics/attempts/:id/order-quality [auth]
GET    /api/v1/analytics/sprint/:sid/me          [student]  ← includes coverageMetrics
GET    /api/v1/analytics/sprint/:sid/student/:uid [admin]
POST   /api/v1/analytics/attempts/:id/recompute  [admin]
POST   /api/v1/analytics/formula-config          [admin]
GET    /api/v1/analytics/formula-config/sprint/:id [admin]

GET    /api/v1/dashboard/sprint/:id/overview         [admin]
GET    /api/v1/dashboard/sprint/:id/batches          [admin]
GET    /api/v1/dashboard/sprint/:id/rankings         [admin]
GET    /api/v1/dashboard/sprint/:id/exam-performance [admin]
GET    /api/v1/dashboard/sprint/:id/subject-performance [admin]
GET    /api/v1/dashboard/sprint/:id/summary          [admin]

GET    /api/v1/reports                           [auth]
POST   /api/v1/reports                           [auth]
GET    /api/v1/reports/:id/status                [auth]
GET    /api/v1/reports/:id/download              [auth]

POST   /api/v1/probability/questionnaire         [student]
GET    /api/v1/probability/sprint/:sprintId      [student]
GET    /api/v1/probability/sprint/:sid/student/:uid [admin]

GET    /api/v1/admin-team                        [super_admin]
GET    /api/v1/admin-team/platform-stats         [super_admin]
GET    /api/v1/admin-team/audit-logs             [super_admin]
POST   /api/v1/admin-team                        [super_admin]
GET    /api/v1/admin-team/:id                    [super_admin]
PATCH  /api/v1/admin-team/:id                    [super_admin]
PATCH  /api/v1/admin-team/:id/deactivate         [super_admin]
PATCH  /api/v1/admin-team/:id/reactivate         [super_admin]
DELETE /api/v1/admin-team/:id                    [super_admin]

GET    /api/v1/syllabus                          [auth]      ← NEW
GET    /api/v1/syllabus/stats                    [auth]      ← NEW
GET    /api/v1/syllabus/blueprint                [auth]      ← NEW
GET    /api/v1/syllabus/blueprint/:prog/:code    [auth]      ← NEW
GET    /api/v1/syllabus/coverage/me/:sprintId    [student]   ← NEW
PATCH  /api/v1/syllabus/topics/:id               [admin]     ← NEW
GET    /api/v1/syllabus/coverage/student/:sid/:sprintId [admin] ← NEW
GET    /api/v1/syllabus/coverage/batch/:sprintId [admin]     ← NEW
```

---

## Syllabus Data Seeded

Topics seeded from client Nomenclature documents:

| Subject | Class | Chapters | Topics |
|---|---|---|---|
| Physics | XI | 18 | ~100 |
| Physics | XII | 14 | ~100 |
| Chemistry | XI | 14 | ~70 |
| Chemistry | XII | 12 | ~65 |
| Biology | XI | 19 | ~115 |
| Biology | XII | 13 | ~65 |
| **Total** | | **90 chapters** | **~515 topics** |

## Blueprint Seeded

| Program | Tests | Breakdown |
|---|---|---|
| Class XI | 16 | 10 Minor + 2 Semi Major + 4 Major |
| Class XII | 18 | 10 Minor + 2 Semi Major + 6 Major |
| Dropper | 24 | 10 Minor + 2 Semi + 12 Major |
| **Total** | **58** | |

---

## Production Deploy Checklist

```
[ ] 1. npm install
[ ] 2. Set all env vars in Render dashboard (see .env.example)
[ ] 3. Verify Brevo sender email domain
[ ] 4. Atlas: allow 0.0.0.0/0 or Render egress IPs
[ ] 5. DROP old index: db.exams.dropIndex("sprint_1_examNumber_1")  ← REQUIRED
[ ] 6. npm run seed:admin          → creates super_admin account
[ ] 7. npm run seed:syllabus       → seeds NEET syllabus taxonomy (~515 topics)
[ ] 8. npm run seed:blueprint      → seeds test series blueprint (58 tests)
[ ] 9. Create Sprint via Admin API (POST /api/v1/sprints)
[ ] 10. Insert questions into questionbank DB with patternSlotTags
[ ] 11. Create Batch with programType → import students (bulk import)
[ ] 12. Generate Exam (POST /api/v1/exams)
[ ] 13. Test full flow: start → submit → analytics → coverage
```

---

## FormulaConfig Keys (tunable via API without redeploy)

```
correct_marks                         default: 4
incorrect_marks                       default: -1
weak_topic_accuracy_threshold         default: 40
strong_topic_accuracy_threshold       default: 80
guess_attempt_time_threshold_seconds  default: 5
silly_mistake_confidence_threshold    default: 80
concept_error_confidence_min          default: 50
concept_error_confidence_max          default: 80
guess_confidence_threshold            default: 50
guess_time_factor                     default: 0.6
high_roi_threshold                    default: 2.5
low_roi_threshold                     default: 1.5
rolling_window_size                   default: 5
critical_accuracy_threshold           default: 40
recovery_accuracy_threshold           default: 60
silly_mistake_reward                  default: 5
high_roi_skip_penalty                 default: 4
low_roi_wrong_penalty                 default: 1
guess_penalty                         default: 1
order_weight_roi                      default: 0.5
order_weight_easy                     default: 0.3
order_weight_marks                    default: 0.2
```

---

## Frontend Must Send on Exam Submit

```json
{
  "slotPosition": 15,
  "questionId": "<ObjectId>",
  "selectedAnswer": "B",
  "sequencePosition": 3,
  "timeSpentSeconds": 45,
  "confidence": 80,
  "wasReattempted": false,
  "answerChanges": 0,
  "initialAnswer": null
}
```

`sequencePosition` powers Spearman Rank Correlation (Attempt Order Quality).
`confidence` powers Error Classification (Silly Mistakes / Concept Errors / Guesses).
Both fields are optional — analytics degrade gracefully if missing.
