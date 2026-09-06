const Subscription = require("../models/Subscription.model");
const Batch = require("../models/Batch.model");
const User = require("../models/User.model");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { BATCH_SOURCE, SUBSCRIPTION_STATUS } = require("../config/constants");
const { resolveStudentAccess } = require("../services/planAccess.service");

// ─── Student: Get my current subscription ────────────────────────────────────
// "Current" = most recently created Subscription doc for this student.

exports.getMySubscription = asyncHandler(async (req, res) => {
  let subscription = await Subscription.findOne({ student: req.user.id })
    .sort({ createdAt: -1 })
    .populate("plan", "key name priceRupees testsIncluded durationDays");

  if (
    subscription?.status === SUBSCRIPTION_STATUS.ACTIVE &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() <= Date.now()
  ) {
    subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
    await subscription.save();

    const [student, trialBatch] = await Promise.all([
      User.findById(req.user.id).populate("batch", "source"),
      Batch.findOne({ slug: "public-trial", source: BATCH_SOURCE.PUBLIC }),
    ]);

    if (student?.batch?.source === BATCH_SOURCE.PUBLIC && trialBatch) {
      student.batch = trialBatch._id;
      await student.save({ validateBeforeSave: false });
    }

    subscription = await Subscription.findById(subscription._id)
      .populate("plan", "key name priceRupees testsIncluded durationDays");
  }

  return sendSuccess(res, 200, "Subscription fetched.", { subscription });
});

// ─── Student: Get my plan-access summary ─────────────────────────────────────
// Powers the dashboard banner + the Tests section header ("1 of 1 free tests
// used"). See planAccess.service.js for the rules.

exports.getMyAccess = asyncHandler(async (req, res) => {
  const access = await resolveStudentAccess(req.user.id);
  return sendSuccess(res, 200, "Access summary fetched.", { access });
});
