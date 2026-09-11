const nodemailer = require("nodemailer");
const NotificationLog = require("../models/NotificationLog.model");
const { NOTIFICATION_STATUS } = require("../config/constants");

// ─── Delivery transport ─────────────────────────────────────────────────────
//
// Preferred path is Brevo's HTTP API (POST over HTTPS/443) — it is immune to the
// most common production failure mode for SMTP: networks (many ISPs, offices,
// some cloud hosts) that accept the TCP connection to port 25/465/587/2525 but
// silently drop the SMTP protocol, which surfaces as "Greeting never received".
// Set BREVO_API_KEY (Brevo → SMTP & API → API Keys) to use it.
//
// Without an API key it falls back to SMTP via nodemailer, now with explicit
// connection/greeting/socket timeouts and no pooling, so a dead socket fails
// fast instead of hanging the caller.

// Read at call time, never at module load — email.service can be required before
// dotenv has populated process.env (load order), and a value frozen to "" here
// would silently force the SMTP fallback even when BREVO_API_KEY is configured.
const cfg = () => ({
  fromName: process.env.EMAIL_FROM_NAME || "Exam Neeti",
  fromAddress: process.env.EMAIL_FROM_ADDRESS || "noreply@example.com",
  apiKey: (process.env.BREVO_API_KEY || "").trim(),
});

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = parseInt(process.env.BREVO_SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port,
      secure: port === 465, // 465 = implicit TLS; 587/2525 = STARTTLS
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
      pool: false,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
};

/** Normalise a "a@x.com" | "a@x.com,b@y.com" | ["a@x.com"] recipient to an array. */
const toList = (to) =>
  (Array.isArray(to) ? to : String(to).split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);

/**
 * Send one email through whichever transport is configured. Throws on failure
 * so callers can record it; never silently swallows.
 */
const deliver = async ({ to, subject, html, replyTo }) => {
  const { fromName, fromAddress, apiKey } = cfg();

  if (apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromAddress },
          to: toList(to).map((email) => ({ email })),
          subject,
          htmlContent: html,
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Brevo API ${res.status}: ${detail.slice(0, 300)}`);
      }
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Brevo API request timed out after 15s");
      throw err;
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
};

/** One-line startup log so it's obvious which transport is live. */
const logTransport = () => {
  if (cfg().apiKey) {
    console.log("[Email] Transport: Brevo HTTP API (https://api.brevo.com)");
  } else {
    console.warn(
      "[Email] Transport: SMTP fallback — set BREVO_API_KEY to use Brevo's HTTP API. " +
        "Many networks block outbound SMTP ports (25/465/587/2525), which shows up as " +
        '"Greeting never received" / "Connection timeout".',
    );
  }
};

/**
 * Escapes HTML special characters to prevent XSS in email clients.
 * Any user-controlled value inserted into HTML templates must be escaped.
 */
const escHtml = (str) => {
  if (str == null) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#x27;");
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
    await deliver({ to, subject, html });

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

// ─── Design system ──────────────────────────────────────────────────────────
//
// Table-based, fully inline-styled layout — the only thing that renders
// consistently across Gmail, Apple Mail, Outlook (desktop + web) and mobile.
// A <style> block is included for progressive enhancement only (dark mode /
// responsive tweaks); nothing critical lives there because many clients drop it.

const BRAND = {
  name: "Exam Neeti",
  tagline: "Every Score Has a Strategy",
  indigo: "#4f46e5",
  indigoDark: "#3730a3",
  ink: "#0f172a",
  inkSoft: "#475569",
  inkFaint: "#94a3b8",
  line: "#e2e8f0",
  panel: "#f8fafc",
  page: "#eef2ff",
  good: "#059669",
  bad: "#dc2626",
};

const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM_ADDRESS || "hello@examneeti.in";

const COMPANY_LINE =
  process.env.EMAIL_COMPANY_LINE || `${BRAND.name} · India`;

/** Hidden preview text shown by the inbox before the email is opened. */
const preheader = (text) => `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;">
    ${escHtml(text)}&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;&#8199;
  </div>`;

/** Bulletproof-ish CTA button (rounded on modern clients, square on old Outlook). */
const button = (label, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="${BRAND.indigo}" style="border-radius:8px;">
        <a href="${escHtml(url)}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
          ${escHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;

/** Small "if the button doesn't work" fallback line. */
const fallbackLink = (url) => `
  <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:${BRAND.inkFaint};">
    Or paste this link into your browser:
  </p>
  <p style="margin:0 0 8px;font-size:12px;line-height:1.6;word-break:break-all;">
    <a href="${escHtml(url)}" target="_blank" style="color:${BRAND.indigo};">${escHtml(url)}</a>
  </p>`;

/** Key / value detail panel. rows = [[label, value], ...]; value may be pre-escaped HTML if `raw` is true. */
const panel = (rows, { raw = false } = {}) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:8px 0 20px;background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:10px;">
    <tr><td style="padding:6px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(
            ([k, v]) => `
        <tr>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.inkFaint};vertical-align:top;width:44%;">${escHtml(k)}</td>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${BRAND.ink};vertical-align:top;">${raw ? v : escHtml(v)}</td>
        </tr>`,
          )
          .join("")}
      </table>
    </td></tr>
  </table>`;

/** Coloured callout for security / important notes. */
const callout = (text, tone = "info") => {
  const c =
    tone === "warn"
      ? { bg: "#fef2f2", bd: "#fecaca", fg: "#991b1b" }
      : tone === "good"
        ? { bg: "#ecfdf5", bd: "#a7f3d0", fg: "#065f46" }
        : { bg: "#eef2ff", bd: "#c7d2fe", fg: BRAND.indigoDark };
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
    <tr><td style="padding:12px 16px;background:${c.bg};border:1px solid ${c.bd};border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.6;color:${c.fg};">
      ${text}
    </td></tr>
  </table>`;
};

const para = (html) =>
  `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${BRAND.inkSoft};">${html}</p>`;

/**
 * Wrap section content in the branded shell.
 * @param {Object} o
 * @param {string} o.title    Big heading inside the card
 * @param {string} o.preview  Inbox preview text
 * @param {string} o.body     Inner HTML (use para/panel/button/callout helpers)
 */
const shell = ({ title, preview, body }) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escHtml(title)}</title>
  <!--[if mso]><style>table{border-collapse:collapse}</style><![endif]-->
  <style>
    @media only screen and (max-width:620px) {
      .en-card { padding:24px !important; }
      .en-wrap { padding:16px !important; }
    }
    a { color:${BRAND.indigo}; }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%;">
  ${preheader(preview || title)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};">
    <tr>
      <td class="en-wrap" align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND.indigo};border-radius:14px 14px 0 0;padding:22px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#ffffff;letter-spacing:0.2px;">
                    ${BRAND.name}
                  </td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#c7d2fe;text-transform:uppercase;">
                    ${escHtml(BRAND.tagline)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="en-card" style="background:#ffffff;padding:34px 32px;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};">
              <h1 style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:${BRAND.ink};">
                ${escHtml(title)}
              </h1>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border:1px solid ${BRAND.line};border-top:none;border-radius:0 0 14px 14px;padding:22px 32px;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.inkFaint};">
                Need help? Write to
                <a href="mailto:${escHtml(SUPPORT_EMAIL)}" style="color:${BRAND.indigo};font-weight:bold;">${escHtml(SUPPORT_EMAIL)}</a>.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${BRAND.inkFaint};">
                This is an automated message from ${escHtml(COMPANY_LINE)}. Please do not reply to this address.<br />
                &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const greet = (name) => para(`Hi <strong style="color:${BRAND.ink};">${escHtml(name || "there")}</strong>,`);

// ─── Templates ──────────────────────────────────────────────────────────────
// All user-controlled values are passed through escHtml() (directly or via the
// helpers) to prevent XSS in email clients.

const templates = {
  accountCreated: ({ name, email, password, loginUrl }) =>
    shell({
      title: "Your Exam Neeti account is ready",
      preview: "Sign in with the credentials inside and set your own password.",
      body:
        greet(name) +
        para("Your account has been created. Use the credentials below to sign in for the first time.") +
        panel([
          ["Email", email],
          ["Temporary password", `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${escHtml(password)}</code>`],
        ], { raw: true }) +
        callout("For your security, change this temporary password immediately after your first sign-in.", "warn") +
        (loginUrl ? button("Sign in to Exam Neeti", loginUrl) + fallbackLink(loginUrl) : ""),
    }),

  examAvailable: ({ name, examTitle, examNumber, dashboardUrl }) =>
    shell({
      title: "A new test is now available",
      preview: `${examTitle || `Exam ${examNumber}`} has been published to your dashboard.`,
      body:
        greet(name) +
        para("A new test has been published to your dashboard and is ready to attempt.") +
        panel([
          ["Test", examTitle || `Exam ${examNumber}`],
          ["Test number", examNumber != null ? `#${examNumber}` : ""],
        ]) +
        (dashboardUrl ? button("Open my dashboard", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    }),

  examSubmitted: ({ name, examTitle, examNumber, submittedAt }) =>
    shell({
      title: "We've received your submission",
      preview: `Your attempt for ${examTitle || `Exam ${examNumber}`} was recorded successfully.`,
      body:
        greet(name) +
        para(`Your attempt for <strong style="color:${BRAND.ink};">${escHtml(examTitle || `Exam ${examNumber}`)}</strong> has been recorded successfully.`) +
        (submittedAt ? panel([["Submitted at", submittedAt]]) : "") +
        para("We're now scoring your paper and computing your analytics — subject and chapter breakdown, recoverable marks, timing and error analysis. You'll get another email the moment your results are ready."),
    }),

  analyticsReady: ({ name, examTitle, examNumber, dashboardUrl, score, maxScore, percentage, accuracy, percentile }) => {
    const rows = [];
    if (score != null && maxScore != null) rows.push(["Score", `${score} / ${maxScore}`]);
    if (percentage != null) rows.push(["Percentage", `${percentage}%`]);
    if (accuracy != null) rows.push(["Accuracy", `${accuracy}%`]);
    if (percentile != null && Number(percentile) > 0) rows.push(["Percentile", `${percentile}`]);
    return shell({
      title: "Your results are ready",
      preview: `Detailed analytics for ${examTitle || `Exam ${examNumber}`} are now on your dashboard.`,
      body:
        greet(name) +
        para(`Your results for <strong style="color:${BRAND.ink};">${escHtml(examTitle || `Exam ${examNumber}`)}</strong> have been computed.`) +
        (rows.length ? panel(rows) : "") +
        para("Open your dashboard for the full picture — subject &amp; chapter accuracy, recoverable marks, time utilisation, error classification and how this attempt compares to your previous ones.") +
        (dashboardUrl ? button("View detailed analytics", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    });
  },

  batchAnalyticsUpdated: ({ adminName, batchName, submittedCount, totalStudents, dashboardUrl }) =>
    shell({
      title: "Batch analytics updated",
      preview: `Every student in ${batchName} has submitted — batch analytics are refreshed.`,
      body:
        greet(adminName) +
        para(`All students in <strong style="color:${BRAND.ink};">${escHtml(batchName)}</strong> have completed the latest test, and batch-level analytics have been recalculated.`) +
        (submittedCount != null && totalStudents != null
          ? panel([
              ["Batch", batchName],
              ["Submissions", `${submittedCount} / ${totalStudents} students`],
            ])
          : "") +
        (dashboardUrl ? button("Open the admin dashboard", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    }),

  sprintCompleted: ({ name, sprintName, dashboardUrl }) =>
    shell({
      title: "Sprint complete — well done",
      preview: `You've finished every test in ${sprintName}.`,
      body:
        greet(name) +
        para(`You've completed every test in the sprint <strong style="color:${BRAND.ink};">${escHtml(sprintName)}</strong>.`) +
        para("Your full sprint summary is now available — trend across tests, strongest and weakest chapters, and where your recoverable marks are concentrated.") +
        (dashboardUrl ? button("View sprint summary", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    }),

  passwordReset: ({ name, resetUrl }) =>
    shell({
      title: "Reset your password",
      preview: "This link is valid for 10 minutes.",
      body:
        greet(name) +
        para("We received a request to reset your Exam Neeti password. Click the button below to choose a new one.") +
        button("Reset my password", resetUrl) +
        callout("This link expires in <strong>10 minutes</strong> and can be used only once.", "info") +
        fallbackLink(resetUrl) +
        para(`If you didn't request this, you can safely ignore this email — your password will not change. If these requests continue, contact us at <a href="mailto:${escHtml(SUPPORT_EMAIL)}">${escHtml(SUPPORT_EMAIL)}</a>.`),
    }),

  reportReady: ({ name, reportType, downloadUrl }) =>
    shell({
      title: "Your report is ready to download",
      preview: `${reportType} is ready.`,
      body:
        greet(name) +
        para(`Your requested report (<strong style="color:${BRAND.ink};">${escHtml(reportType)}</strong>) has been generated.`) +
        (downloadUrl ? button("Download report", downloadUrl) + fallbackLink(downloadUrl) : "") +
        para("For security, you may be asked to sign in before the download begins."),
    }),

  adminInvited: ({ name, email, password, role, invitedBy, loginUrl }) =>
    shell({
      title: "You've been added to the Exam Neeti team",
      preview: `${invitedBy} added you as ${role}.`,
      body:
        greet(name) +
        para(`<strong style="color:${BRAND.ink};">${escHtml(invitedBy)}</strong> has added you to the ${BRAND.name} team as <strong style="color:${BRAND.ink};">${escHtml(role)}</strong>.`) +
        panel([
          ["Email", email],
          ["Temporary password", `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${escHtml(password)}</code>`],
          ["Role", role],
        ], { raw: true }) +
        callout("Change this temporary password immediately after your first sign-in.", "warn") +
        (loginUrl ? button("Sign in", loginUrl) + fallbackLink(loginUrl) : ""),
    }),

  selfRegisteredWelcome: ({ name, dashboardUrl }) =>
    shell({
      title: "Welcome to Exam Neeti",
      preview: "Your free diagnostic test is waiting on your dashboard.",
      body:
        greet(name) +
        para("Your account is ready. You have <strong>1 free diagnostic test</strong> waiting on your dashboard.") +
        para("Take it to see exactly where you stand — then pick the plan that fits your preparation.") +
        (dashboardUrl ? button("Go to my dashboard", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    }),

  subscriptionActivated: ({ name, planName, expiresAt, amount, dashboardUrl }) =>
    shell({
      title: "Your plan is active",
      preview: `${planName} is now active on your account.`,
      body:
        greet(name) +
        para("Your payment was successful and your plan is now active. Every test included in it has been unlocked on your dashboard.") +
        panel([
          ["Plan", planName],
          ["Amount paid", amount ? `₹${amount}` : ""],
          ["Access", expiresAt ? `Until ${expiresAt}` : "One-time — never expires"],
        ]) +
        (dashboardUrl ? button("Go to my dashboard", dashboardUrl) + fallbackLink(dashboardUrl) : ""),
    }),

  adminDeleted: ({ name, deletedBy }) =>
    shell({
      title: "Your admin account has been removed",
      preview: "Your access to the Exam Neeti admin console has ended.",
      body:
        greet(name) +
        para(`Your admin account on ${BRAND.name} has been permanently deleted by <strong style="color:${BRAND.ink};">${escHtml(deletedBy)}</strong>. You will no longer be able to sign in to the admin console.`) +
        para(`If you believe this was a mistake, please contact the platform owner or write to <a href="mailto:${escHtml(SUPPORT_EMAIL)}">${escHtml(SUPPORT_EMAIL)}</a>.`),
    }),

  // ── Contact form (internal notification) ──────────────────────────────────
  contactFormReceived: ({ name, email, reason, message }) =>
    shell({
      title: "New contact-form message",
      preview: `${name} · ${reason}`,
      body:
        para("A new message was submitted through the website contact form.") +
        panel([
          ["Name", name],
          ["Email", email],
          ["Topic", reason],
        ]) +
        para(`<span style="color:${BRAND.inkFaint};">Message</span>`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;">
           <tr><td style="padding:14px 16px;background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${BRAND.ink};white-space:pre-wrap;">${escHtml(message)}</td></tr>
         </table>` +
        para(`Reply directly to this email to respond to ${escHtml(name)}.`),
    }),

  contactAck: ({ name }) =>
    shell({
      title: "We've received your message",
      preview: "A member of the team will get back to you within one working day.",
      body:
        greet(name) +
        para(`Thanks for reaching out to ${BRAND.name}. Your message is with the product team and we'll get back to you within one working day.`) +
        para(`If it's urgent, you can also reach us at <a href="mailto:${escHtml(SUPPORT_EMAIL)}">${escHtml(SUPPORT_EMAIL)}</a>.`) +
        para(`— Team ${BRAND.name}`),
    }),

  // ── Newsletter ───────────────────────────────────────────────────────────
  newsletterWelcome: ({ email }) =>
    shell({
      title: "You're subscribed",
      preview: "Exam Neeti Strategy Briefings — your first one lands soon.",
      body:
        para(`Thanks for subscribing to <strong style="color:${BRAND.ink};">${BRAND.name} Strategy Briefings</strong> — short, practical notes on mock-test strategy, percentile optimisation and cutting negative marks.`) +
        para("Your first briefing will land in your inbox soon.") +
        callout(`You're receiving this because <strong>${escHtml(email)}</strong> was used to subscribe on our website. Didn't do this? Ignore this email and you won't be added.`, "info") +
        para(`— Team ${BRAND.name}`),
    }),
};

/**
 * Fire-and-forget email with no NotificationLog row — used for messages that
 * aren't tied to a User account (e.g. the public contact form). Failures are
 * logged, never thrown, so they can't break the request flow.
 *
 * @param {Object}  opts
 * @param {string}  opts.to       Recipient
 * @param {string}  opts.subject
 * @param {string}  opts.html
 * @param {string} [opts.replyTo] Sets the Reply-To header (e.g. the sender's address)
 */
const sendRawEmail = async ({ to, subject, html, replyTo }) => {
  try {
    await deliver({ to, subject, html, replyTo });
    return true;
  } catch (err) {
    console.error(`[Email] Raw send failed to ${to}:`, err.message);
    return false;
  }
};

module.exports = { sendEmail, sendRawEmail, templates, logTransport };
