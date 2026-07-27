const nodemailer = require("nodemailer");
const NotificationLog = require("../models/NotificationLog.model");
const { NOTIFICATION_STATUS } = require("../config/constants");

let transporter = null;

/**
 * Brevo SMTP configuration.
 * Brevo requires: host=smtp-relay.brevo.com, port=587, user=your_email, pass=smtp_key
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.BREVO_SMTP_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return transporter;
};

/**
 * Sends an email and records the result in the NotificationLog.
 *
 * @param {Object} options
 * @param {string} options.to           Recipient email address
 * @param {string} options.subject      Email subject
 * @param {string} options.html         HTML body
 * @param {string} options.trigger      NOTIFICATION_TRIGGER value
 * @param {ObjectId} options.recipientId  User._id of the recipient
 * @param {ObjectId} [options.contextRef] ID of the triggering entity (attempt, exam, etc.)
 */
const sendEmail = async ({
  to,
  subject,
  html,
  trigger,
  recipientId,
  contextRef = null,
}) => {
  const log = await NotificationLog.create({
    trigger,
    recipient: recipientId,
    recipientEmail: to,
    subject,
    status: NOTIFICATION_STATUS.PENDING,
    contextRef,
  });

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
    });

    log.status = NOTIFICATION_STATUS.SENT;
    log.sentAt = new Date();
    await log.save();
  } catch (err) {
    log.status = NOTIFICATION_STATUS.FAILED;
    log.errorMessage = err.message;
    await log.save();
    // Log but do not throw — email failure must not break the main request flow
    console.error(`[Email] Failed to send "${trigger}" to ${to}:`, err.message);
  }
};

// ─── Email template builders ────────────────────────────────────────────────

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: #1a56db; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
    .body { padding: 32px; color: #333333; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #1a56db; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { background: #f4f4f4; padding: 16px 32px; font-size: 12px; color: #888888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Exam Neeti</h1></div>
    <div class="body">${content}</div>
    <div class="footer">This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>
`;

const templates = {
  accountCreated: ({ name, email, password }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your Exam Neeti account has been created. You can now log in using the credentials below.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>Please change your password after your first login.</p>
    `),

  examAvailable: ({ name, examTitle, examNumber, dashboardUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>A new exam is now available for you: <strong>${examTitle || `Exam ${examNumber}`}</strong>.</p>
      <p>Log in to your dashboard to attempt it.</p>
      <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
    `),

  examSubmitted: ({ name, examTitle, examNumber }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your submission for <strong>${examTitle || `Exam ${examNumber}`}</strong> has been received successfully.</p>
      <p>Your results will be ready shortly. You will receive another email once the analytics are computed.</p>
    `),

  analyticsReady: ({ name, examTitle, examNumber, dashboardUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your results for <strong>${examTitle || `Exam ${examNumber}`}</strong> are ready.</p>
      <p>Visit your dashboard to view detailed analytics, subject-wise breakdown, and recoverable marks.</p>
      <a href="${dashboardUrl}" class="btn">View Results</a>
    `),

  batchAnalyticsUpdated: ({ adminName, batchName, dashboardUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${adminName}</strong>,</p>
      <p>Batch-level analytics for <strong>${batchName}</strong> have been recalculated and are now up to date.</p>
      <a href="${dashboardUrl}" class="btn">View Management Dashboard</a>
    `),

  sprintCompleted: ({ name, sprintName, dashboardUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Congratulations! You have completed all exams in the sprint: <strong>${sprintName}</strong>.</p>
      <p>Your full Sprint performance summary is now available on your dashboard.</p>
      <a href="${dashboardUrl}" class="btn">View Sprint Summary</a>
    `),

  passwordReset: ({ name, resetUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>You requested a password reset. Click the link below to set a new password. This link is valid for <strong>10 minutes</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `),

  reportReady: ({ name, reportType, downloadUrl }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your requested report (<strong>${reportType}</strong>) is ready for download.</p>
      <a href="${downloadUrl}" class="btn">Download Report</a>
    `),

  adminInvited: ({ name, email, password, role, invitedBy }) =>
    baseTemplate(`
      <p>Hi <strong>${name}</strong>,</p>
      <p>You have been added to the <strong>Exam Neeti</strong> admin team as <strong>${role}</strong> by ${invitedBy}.</p>
      <p>You can now log in using the credentials below.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${password}</code></p>
      <p style="color:#e74c3c;"><strong>Important:</strong> Please change your password immediately after your first login.</p>
    `),
};

module.exports = { sendEmail, templates };
