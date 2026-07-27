const mongoose = require("mongoose");
const {
  NOTIFICATION_TRIGGER,
  NOTIFICATION_STATUS,
} = require("../config/constants");

const notificationLogSchema = new mongoose.Schema(
  {
    trigger: {
      type: String,
      enum: Object.values(NOTIFICATION_TRIGGER),
      required: [true, "Notification trigger is required."],
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required."],
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
    },
    /**
     * Error message if delivery failed — helps with debugging and retry logic.
     */
    errorMessage: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    /**
     * contextRef holds the ID of the entity that triggered this notification
     * (e.g., attemptId, examId) for traceability.
     */
    contextRef: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationLogSchema.index({ recipient: 1, createdAt: -1 });
notificationLogSchema.index({ trigger: 1, status: 1 });

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
