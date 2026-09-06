const mongoose = require("mongoose");
const { SPRINT_STATUS, DIFFICULTY, QUESTION_TYPE, SUBJECTS, CLASS_LEVELS } = require("../config/constants");

// ── Denormalized actor stamp (userId + email) ────────────────────────────────
// Same pattern as Question.createdBy — kept as plain fields so a lean() read
// carries a human-readable email without a populate().
const actorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email:  { type: String, default: "" },
  },
  { _id: false }
);

/**
 * subjectProgress — the multi-admin "baton pass" workflow. A NEET sprint's
 * blueprint spans physics / chemistry / biology and different subject admins
 * fill in their own slots. Each subject carries its own completion flag so
 * the UI can show "physics done, chemistry pending" and activation can be
 * gated until every subject is marked done.
 */
const subjectProgressSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      enum: Object.values(SUBJECTS),
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done"],
      default: "pending",
    },
    markedBy: { type: actorSchema, default: () => ({}) },
    markedAt: { type: Date, default: null },
    note:     { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

/**
 * deletionRequest — no admin may delete a sprint directly. They raise a
 * request; a super_admin approves (→ sprint is actually deleted) or rejects.
 * Exactly one request is tracked at a time; a fresh request overwrites a
 * previously rejected one.
 */
const deletionRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    requestedBy:  { type: actorSchema, default: () => ({}) },
    requestedAt:  { type: Date, default: null },
    reason:       { type: String, default: "", trim: true, maxlength: 1000 },
    decidedBy:    { type: actorSchema, default: () => ({}) },
    decidedAt:    { type: Date, default: null },
    decisionNote: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const sprintActivitySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "created",
        "meta_edited",         // name / description / dates / classLevel
        "blueprint_edited",    // pattern slots replaced
        "subject_marked",      // meta: { subject, from, to }
        "status_changed",      // meta: { from, to }
        "delete_requested",    // meta: { reason }
        "delete_approved",     // sprint is deleted right after this is written to the audit log
        "delete_rejected",     // meta: { note }
      ],
      required: true,
    },
    byUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    byEmail:  { type: String, default: "" },
    byRole:   { type: String, default: "" },
    at:       { type: Date, default: Date.now },
    meta:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * A PatternSlot defines one fixed position in every exam of this Sprint.
 * The actual question filling that slot changes per exam via Question Reconstruction,
 * but the rules for that slot (subject, difficulty, type, marks) are fixed here.
 */
const patternSlotSchema = new mongoose.Schema(
  {
    position: {
      type: Number,
      required: [true, "Slot position is required."],
      min: [1, "Position must be at least 1."],
    },
    subject: {
      type: String,
      required: [true, "Subject is required for a pattern slot."],
      enum: {
        values: Object.values(SUBJECTS),
        message: "Subject must be biology, chemistry, or physics.",
      },
    },
    chapter: {
      type: String,
      trim: true,
      default: null,
    },
    topic: {
      type: String,
      trim: true,
      default: null,
    },
    difficulty: {
      type: String,
      enum: {
        values: [...Object.values(DIFFICULTY), null],
        message: "Difficulty must be easy, medium, or hard.",
      },
      default: null,
    },
    questionType: {
      type: String,
      enum: Object.values(QUESTION_TYPE),
      default: QUESTION_TYPE.MCQ,
    },
    marks: {
      type: Number,
      required: [true, "Marks for this slot are required."],
      min: [0, "Marks cannot be negative."],
    },
    negativeMarks: {
      type: Number,
      default: 0,
      min: [0, "Negative marks value cannot be negative."],
    },
    /**
     * pinnedQuestionIds — admin-fixed questions for this exact slot position.
     *
     * These are _id values from the Question Bank DB (a separate Mongoose
     * connection, hence no `ref`). Semantics enforced by the Question
     * Reconstruction engine:
     *
     *   • non-empty  → every exam generated from this sprint MUST fill this
     *     slot from THIS set only. With more exams than pinned questions the
     *     engine cycles the least-recently-used pinned question. The generic
     *     attribute-based tier fallback is bypassed entirely for the slot.
     *   • empty      → unchanged behaviour: the engine picks the best-fit
     *     question from the whole bank using subject/chapter/topic/difficulty.
     */
    pinnedQuestionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { _id: true }
);

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sprint name is required."],
      trim: true,
      unique: true,
      maxlength: [150, "Sprint name cannot exceed 150 characters."],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(SPRINT_STATUS),
      default: SPRINT_STATUS.DRAFT,   // FIX: was ACTIVE — sprints must go through draft→active workflow
    },
    /**
     * classLevel — which cohort this sprint targets (XI / XII / dropper).
     * Purely organisational: powers the class-wise filter on the sprint list.
     * Nullable for legacy sprints and for cross-cohort sprints.
     */
    classLevel: {
      type: String,
      enum: [...Object.values(CLASS_LEVELS), null],
      default: null,
      index: true,
    },
    totalQuestions: {
      type: Number,
      required: [true, "Total questions count is required."],
      min: [1, "Sprint must have at least 1 question."],
    },
    patternSlots: {
      type: [patternSlotSchema],
      validate: {
        validator: function (slots) {
          if (!slots || slots.length === 0) return false;
          // Ensure no duplicate positions
          const positions = slots.map((s) => s.position);
          return new Set(positions).size === positions.length;
        },
        message: "Pattern slots must be non-empty and have unique positions.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },

    // ── Multi-admin per-subject completion workflow ─────────────────────────
    subjectProgress: {
      type: [subjectProgressSchema],
      default: [],
    },

    // ── Append-only edit / lifecycle trail ─────────────────────────────────
    activityLog: {
      type: [sprintActivitySchema],
      default: [],
    },

    // ── Super-admin-gated deletion ─────────────────────────────────────────
    deletionRequest: {
      type: deletionRequestSchema,
      default: () => ({ status: "none" }),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sprintSchema.index({ status: 1 });
sprintSchema.index({ "deletionRequest.status": 1 });

/**
 * True once every subject in the blueprint has been marked "done" (and there
 * is at least one subject to mark). Used to gate activation.
 */
sprintSchema.virtual("allSubjectsDone").get(function () {
  const sp = this.subjectProgress || [];
  return sp.length > 0 && sp.every((s) => s.status === "done");
});

module.exports = mongoose.model("Sprint", sprintSchema);
