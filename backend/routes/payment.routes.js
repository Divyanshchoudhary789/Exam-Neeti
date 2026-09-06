const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const { createOrderSchema, verifyPaymentSchema } = require("../validators/payment.validator");
const { ROLES } = require("../config/constants");

// ── Public: Razorpay server-to-server webhook ────────────────────────────────
// Body is parsed as raw Buffer (see index.js — mounted with express.raw()
// BEFORE the global express.json()) so the HMAC signature can be verified
// against the exact bytes Razorpay signed.
router.post("/webhook", paymentController.webhook);

// ── Student-only: checkout flow ───────────────────────────────────────────────
router.use(authenticate, authorize(ROLES.STUDENT));

router.post("/create-order", authLimiter, validate(createOrderSchema), paymentController.createOrder);
router.post("/verify", authLimiter, validate(verifyPaymentSchema), paymentController.verifyPayment);

module.exports = router;
