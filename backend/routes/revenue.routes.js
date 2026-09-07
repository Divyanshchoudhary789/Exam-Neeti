/**
 * Revenue & Billing Routes
 *
 * Base path: /api/v1/revenue
 *
 * Strictly super_admin territory — these endpoints expose platform-wide
 * financial data (lifetime revenue, per-customer spend, the full payment
 * ledger). A regular admin must never see this, so the router is gated with
 * authorize(ROLES.SUPER_ADMIN) rather than authorize(ROLES.ADMIN).
 */

const express = require("express");
const router = express.Router();

const revenueController = require("../controllers/revenue.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { heavyOperationLimiter } = require("../middleware/rateLimiter");
const { ROLES } = require("../config/constants");

router.use(authenticate);
router.use(authorize(ROLES.SUPER_ADMIN));

// Headline KPIs + 12-month revenue trend + per-plan revenue split.
router.get("/summary", heavyOperationLimiter, revenueController.getRevenueSummary);

// The full payment ledger — paginated, filterable by status / plan / date / search.
router.get("/transactions", revenueController.listTransactions);

module.exports = router;
