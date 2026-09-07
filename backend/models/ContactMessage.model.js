const mongoose = require("mongoose");

/**
 * ContactMessage — a submission from the public website contact form.
 * Stored as the durable record for support triage; an email notification is
 * also fired to the support inbox on creation (best-effort).
 */
const CONTACT_REASONS = [
  "Student Support",
  "Institute Partnership",
  "Demo Request",
  "Billing",
  "Other",
];
const CONTACT_STATUS = ["new", "read", "replied", "archived"];

const contactMessageSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true, maxlength: 120 },
    email:   { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    reason:  { type: String, enum: CONTACT_REASONS, default: "Other" },
    message: { type: String, required: true, trim: true, maxlength: 5000 },

    status:  { type: String, enum: CONTACT_STATUS, default: "new", index: true },

    // Lightweight request context — helps spot spam / abuse.
    ip:        { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // Set when an admin marks it read / replied / archived.
    handledBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      email:  { type: String, default: "" },
    },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
module.exports.CONTACT_REASONS = CONTACT_REASONS;
module.exports.CONTACT_STATUS = CONTACT_STATUS;
