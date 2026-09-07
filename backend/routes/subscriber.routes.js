"use strict";

const express = require("express");
const router = express.Router();

const subscriberController = require("../controllers/subscriber.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  subscribeSchema, listSubscribersQuerySchema,
} = require("../validators/subscriber.validator");
const { ROLES } = require("../config/constants");

// ── Public — the newsletter opt-in / opt-out ──────────────────────────────
// authLimiter (10 / 15 min / IP) keeps a bot from flooding the list.
router.post("/", authLimiter, validate(subscribeSchema), subscriberController.subscribe);
router.post("/unsubscribe", authLimiter, subscriberController.unsubscribe);
router.get("/unsubscribe", subscriberController.unsubscribe);

// ── Admin — subscriber management ─────────────────────────────────────────
router.use(authenticate, authorize(ROLES.ADMIN));
router.get("/", validate(listSubscribersQuerySchema, "query"), subscriberController.listSubscribers);
router.delete("/:id", subscriberController.removeSubscriber);

module.exports = router;
