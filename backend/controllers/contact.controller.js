"use strict";

const ContactMessage = require("../models/ContactMessage.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { sendRawEmail, templates } = require("../services/email.service");

const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SUPPORT_INBOX =
  process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM_ADDRESS || "hello@examneeti.in";

// ─── Public: submit the website contact form ────────────────────────────────

exports.submitContact = asyncHandler(async (req, res, next) => {
  const { name, email, reason, message, company } = req.body;

  // Honeypot — a bot filled the hidden "company" field. Pretend it worked.
  if (company && company.trim()) {
    return sendSuccess(res, 201, "Message received.", { ok: true });
  }

  const doc = await ContactMessage.create({
    name,
    email,
    reason: reason || "Other",
    message,
    ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim(),
    userAgent: (req.headers["user-agent"] || "").slice(0, 400),
  });

  // Fire both emails best-effort — a mail hiccup must not fail the submission.
  sendRawEmail({
    to: SUPPORT_INBOX,
    subject: `[Contact · ${doc.reason}] ${name}`,
    html: templates.contactFormReceived({ name, email, reason: doc.reason, message }),
    replyTo: email,
  });
  sendRawEmail({
    to: email,
    subject: "We've received your message — Exam Neeti",
    html: templates.contactAck({ name }),
  });

  return sendSuccess(res, 201, "Thanks — your message has been sent. We'll reply within a working day.", {
    id: doc._id,
  });
});

// ─── Admin: list submissions ───────────────────────────────────────────────

exports.listContactMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.reason) filter.reason = req.query.reason;
  if (req.query.search) {
    const rx = new RegExp(esc(req.query.search), "i");
    filter.$or = [{ name: rx }, { email: rx }, { message: rx }];
  }

  const [messages, total, unread] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ status: "new" }),
  ]);

  return sendPaginated(
    res,
    200,
    "Contact messages fetched.",
    { messages, unread },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Admin: update a submission's status ────────────────────────────────────

exports.updateContactMessage = asyncHandler(async (req, res, next) => {
  const doc = await ContactMessage.findById(req.params.id);
  if (!doc) return next(new AppError("Message not found.", 404));

  doc.status = req.body.status;
  doc.handledBy = { userId: req.user.id, email: req.user.email };
  doc.handledAt = new Date();
  await doc.save();

  return sendSuccess(res, 200, "Message updated.", { message: doc });
});

// ─── Admin: delete a submission ────────────────────────────────────────────

exports.deleteContactMessage = asyncHandler(async (req, res, next) => {
  const doc = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!doc) return next(new AppError("Message not found.", 404));
  return sendSuccess(res, 200, "Message deleted.", { deletedId: doc._id });
});
