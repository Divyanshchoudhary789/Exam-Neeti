const mongoose = require("mongoose");

/**
 * Subscriber — an email address that opted in to the "Strategy Briefings"
 * newsletter from the public website (contact section or footer form).
 * One document per email (unique); re-subscribing just reactivates it.
 */
const SUBSCRIBER_SOURCES = ["contact_section", "footer", "other"];
const SUBSCRIBER_STATUS = ["active", "unsubscribed"];

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    source: { type: String, enum: SUBSCRIBER_SOURCES, default: "other" },
    status: { type: String, enum: SUBSCRIBER_STATUS, default: "active", index: true },

    // Lightweight request context — helps spot spam / abuse.
    ip:        { type: String, default: "" },
    userAgent: { type: String, default: "" },

    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subscriberSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Subscriber", subscriberSchema);
module.exports.SUBSCRIBER_SOURCES = SUBSCRIBER_SOURCES;
module.exports.SUBSCRIBER_STATUS = SUBSCRIBER_STATUS;
