"use strict";

const Subscriber = require("../models/Subscriber.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendPaginated } = require("../utils/response");
const { getPaginationParams, buildPaginationMeta } = require("../utils/pagination");
const { sendRawEmail, templates } = require("../services/email.service");

const esc = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Public: subscribe to the newsletter ───────────────────────────────────

exports.subscribe = asyncHandler(async (req, res) => {
  const { email, source, company } = req.body;

  // Honeypot — a bot filled the hidden "company" field. Pretend it worked.
  if (company && company.trim()) {
    return sendSuccess(res, 201, "Subscribed.", { ok: true });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
    .toString().split(",")[0].trim();
  const userAgent = (req.headers["user-agent"] || "").slice(0, 400);

  const existing = await Subscriber.findOne({ email });
  let isNew = false;

  if (existing) {
    if (existing.status !== "active") {
      existing.status = "active";
      existing.unsubscribedAt = null;
      existing.source = source || existing.source;
      await existing.save();
    }
  } else {
    isNew = true;
    await Subscriber.create({ email, source: source || "other", ip, userAgent });
  }

  // Welcome email only on a genuinely new opt-in — best-effort, never throws.
  if (isNew) {
    sendRawEmail({
      to: email,
      subject: "You're on the list — Exam Neeti Strategy Briefings",
      html: templates.newsletterWelcome({ email }),
    });
  }

  return sendSuccess(res, 201, "You're subscribed. Watch your inbox for the next briefing.", {
    email,
  });
});

// ─── Public: unsubscribe ──────────────────────────────────────────────────

exports.unsubscribe = asyncHandler(async (req, res, next) => {
  const email = String(req.query.email || req.body.email || "").trim().toLowerCase();
  if (!email) return next(new AppError("An email address is required.", 400));

  const doc = await Subscriber.findOne({ email });
  if (doc && doc.status === "active") {
    doc.status = "unsubscribed";
    doc.unsubscribedAt = new Date();
    await doc.save();
  }

  return sendSuccess(res, 200, "You've been unsubscribed.", { email });
});

// ─── Admin: list subscribers ──────────────────────────────────────────────

exports.listSubscribers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.search) filter.email = new RegExp(esc(req.query.search), "i");

  const [subscribers, total, active] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Subscriber.countDocuments(filter),
    Subscriber.countDocuments({ status: "active" }),
  ]);

  return sendPaginated(
    res,
    200,
    "Subscribers fetched.",
    { subscribers, active },
    buildPaginationMeta(total, page, limit)
  );
});

// ─── Admin: remove a subscriber ───────────────────────────────────────────

exports.removeSubscriber = asyncHandler(async (req, res, next) => {
  const doc = await Subscriber.findByIdAndDelete(req.params.id);
  if (!doc) return next(new AppError("Subscriber not found.", 404));
  return sendSuccess(res, 200, "Subscriber removed.", { deletedId: doc._id });
});
