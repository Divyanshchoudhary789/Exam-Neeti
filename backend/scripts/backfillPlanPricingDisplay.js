/**
 * One-off, idempotent backfill for the redesigned public pricing cards
 * (the "Find your preparation path" layout).
 *
 *  • core / prime / elite  → set `mrpRupees` (original price) when unset, so the
 *    struck-through price + "% OFF" pill renders. Values = 12× the ₹299/399/499
 *    per-month list price shown in the design.
 *  • signature_entry        → converge to the current spec: 2 full-length
 *    tests, no minor/semi/major split (single "Total Tests" stat), one-time
 *    "never expires" access, and the matching feature copy. Written only when
 *    the stored values differ, so re-running is a no-op.
 *
 * Safe to run repeatedly. Never touches price, batch wiring or any plan not
 * listed here.
 *
 *   node scripts/backfillPlanPricingDisplay.js
 */
require("dotenv").config();

const mongoose = require("mongoose");
const Plan = require("../models/Plan.model");

const MRP_BY_KEY = { core: 3588, prime: 4788, elite: 5988 };

const ENTRY_KEY = "signature_entry";
const ENTRY_SPEC = {
  testsIncluded: 2,
  durationDays: null, // one-time — never expires
  examBreakdown: { minor: 0, semiMajor: 0, major: 0 },
  description: "Experience the Exam Neeti difference.",
  tagline: "Experience the Exam Neeti difference.",
  features: [
    "2 Full-length Tests",
    "NEET-level practice",
    "Basic performance report",
    "Lifetime access — never expires",
    "Upgrade anytime",
  ],
};

const sameArray = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("[backfill] MONGO_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const changes = [];
  // Targeted $set (no full-document revalidation — some legacy keys predate the
  // current key pattern and would fail a .save()).

  for (const [key, mrpRupees] of Object.entries(MRP_BY_KEY)) {
    const plan = await Plan.findOne({ key }).lean();
    if (!plan) {
      console.log(`[backfill] plan "${key}" not found — skipped.`);
      continue;
    }
    if (plan.mrpRupees == null && mrpRupees > plan.priceRupees) {
      await Plan.updateOne({ key }, { $set: { mrpRupees } });
      changes.push(`${key}: mrpRupees → ₹${mrpRupees}`);
    } else {
      console.log(`[backfill] ${key}: mrpRupees already set (${plan.mrpRupees}) — left as is.`);
    }
  }

  const entry = await Plan.findOne({ key: ENTRY_KEY }).lean();
  if (!entry) {
    console.log(`[backfill] plan "${ENTRY_KEY}" not found — skipped.`);
  } else {
    const bd = entry.examBreakdown || {};
    const inSync =
      entry.testsIncluded === ENTRY_SPEC.testsIncluded &&
      (entry.durationDays ?? null) === ENTRY_SPEC.durationDays &&
      (bd.minor || 0) === 0 && (bd.semiMajor || 0) === 0 && (bd.major || 0) === 0 &&
      entry.description === ENTRY_SPEC.description &&
      entry.tagline === ENTRY_SPEC.tagline &&
      sameArray(entry.features, ENTRY_SPEC.features);
    if (inSync) {
      console.log(`[backfill] ${ENTRY_KEY}: already matches spec — nothing to do.`);
    } else {
      await Plan.updateOne({ key: ENTRY_KEY }, { $set: ENTRY_SPEC });
      changes.push(`${ENTRY_KEY}: → 2 tests · never expires · single-stat · matched copy`);
    }
  }

  console.log(changes.length ? `[backfill] Done:\n  - ${changes.join("\n  - ")}` : "[backfill] Nothing to change.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[backfill] Fatal:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
