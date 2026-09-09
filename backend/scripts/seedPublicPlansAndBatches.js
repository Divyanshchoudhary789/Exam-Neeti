require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User.model");
const Batch = require("../models/Batch.model");
const Plan = require("../models/Plan.model");
const { ROLES, BATCH_SOURCE, PLAN_KEYS } = require("../config/constants");

const SUPER_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "superadmin@examneeti.com";

const { PROGRAM_TYPES } = require("../config/constants");

const PLAN_FEATURES = [
  "NCERT-Aligned Coverage",
  "Filtered Practice at NEET Level",
  "Gradual Syllabus Coverage",
  "Recoverable Marks Identified",
  "Detailed Analytics for Every Test",
  "Self-Reflective Tests to Improve",
];

const PUBLIC_BATCHES = [
  { slug: "public-trial",            name: "Public Trial",            programType: null },
  { slug: "public-signature-entry",  name: "Public Signature Entry",  programType: null },
  { slug: "public-core",             name: "Public Core",             programType: PROGRAM_TYPES.CLASS_XI },
  { slug: "public-prime",            name: "Public Prime",            programType: PROGRAM_TYPES.CLASS_XII },
  { slug: "public-elite",            name: "Public Elite",            programType: PROGRAM_TYPES.DROPPER },
];

const PLANS = [
  {
    key: PLAN_KEYS.TRIAL,
    name: "Free Trial",
    priceRupees: 0,
    durationDays: null,
    batchSlug: "public-trial",
    testsIncluded: 1,
    description: "One free diagnostic test with basic performance visibility.",
    programType: null,
    tagline: "",
    features: [],
    examBreakdown: { minor: 0, semiMajor: 0, major: 0 },
    featured: false,
    sortOrder: 0,
  },
  {
    key: PLAN_KEYS.SIGNATURE_ENTRY,
    name: "Signature Entry",
    priceRupees: 149,
    durationDays: null, // one-time access — never expires
    batchSlug: "public-signature-entry",
    testsIncluded: 2,
    description: "Experience the Exam Neeti difference.",
    programType: null,
    tagline: "Experience the Exam Neeti difference.",
    features: [
      "2 Full-length Tests",
      "NEET-level practice",
      "Basic performance report",
      "Lifetime access — never expires",
      "Upgrade anytime",
    ],
    examBreakdown: { minor: 0, semiMajor: 0, major: 0 },
    featured: false,
    sortOrder: 1,
  },
  {
    key: PLAN_KEYS.CORE,
    name: "Core",
    priceRupees: 1999,
    mrpRupees: 3588,
    durationDays: 365,
    batchSlug: "public-core",
    testsIncluded: 16,
    description: "Class 11 focused yearly test series with analytics.",
    programType: PROGRAM_TYPES.CLASS_XI,
    tagline: "Build the strongest base.",
    features: PLAN_FEATURES,
    examBreakdown: { minor: 10, semiMajor: 2, major: 4 },
    featured: false,
    sortOrder: 2,
  },
  {
    key: PLAN_KEYS.PRIME,
    name: "Prime",
    priceRupees: 2599,
    mrpRupees: 4788,
    durationDays: 365,
    batchSlug: "public-prime",
    testsIncluded: 18,
    description: "Class 12 focused yearly test series with analytics.",
    programType: PROGRAM_TYPES.CLASS_XII,
    tagline: "Strengthen concepts. Perform smarter.",
    features: PLAN_FEATURES,
    examBreakdown: { minor: 10, semiMajor: 2, major: 6 },
    featured: true,
    sortOrder: 3,
  },
  {
    key: PLAN_KEYS.ELITE,
    name: "Elite",
    priceRupees: 2999,
    mrpRupees: 5988,
    durationDays: 365,
    batchSlug: "public-elite",
    testsIncluded: 24,
    description: "Dropper focused yearly test series with the full test set.",
    programType: PROGRAM_TYPES.DROPPER,
    tagline: "Maximize your potential.",
    features: PLAN_FEATURES,
    examBreakdown: { minor: 10, semiMajor: 2, major: 12 },
    featured: false,
    sortOrder: 4,
  },
];

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error("[Seed Plans] MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const superAdmin = await User.findOne({
    email: SUPER_ADMIN_EMAIL,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
  }).select("_id email");

  if (!superAdmin) {
    throw new Error(`Active super admin not found (${SUPER_ADMIN_EMAIL}). Run npm run seed:admin first.`);
  }

  for (const batch of PUBLIC_BATCHES) {
    await Batch.findOneAndUpdate(
      { slug: batch.slug },
      {
        $set: {
          ...batch,
          description: "Self-serve public access batch managed through the public plan catalog.",
          source: BATCH_SOURCE.PUBLIC,
          programType: batch.programType || null,
          isActive: true,
          createdBy: superAdmin._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const plan of PLANS) {
    await Plan.findOneAndUpdate(
      { key: plan.key },
      { $set: { ...plan, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const [batchCount, planCount] = await Promise.all([
    Batch.countDocuments({ source: BATCH_SOURCE.PUBLIC, slug: { $in: PUBLIC_BATCHES.map((b) => b.slug) } }),
    Plan.countDocuments({ key: { $in: PLANS.map((p) => p.key) } }),
  ]);

  console.log(`[Seed Plans] Done. Public batches: ${batchCount}. Plans: ${planCount}.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("[Seed Plans] Fatal error:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { seed, PUBLIC_BATCHES, PLANS };
