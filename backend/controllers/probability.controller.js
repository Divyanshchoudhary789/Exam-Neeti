const StudentProbability = require("../models/StudentProbability.model");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/response");
const { setQuestionnaireLevel, getProbabilityMap } = require("../services/probability.service");

// Student: Submit questionnaire for initial probability
exports.submitQuestionnaire = asyncHandler(async (req, res, next) => {
  const { sprintId, chapters } = req.body;

  if (!Array.isArray(chapters) || chapters.length === 0) {
    return next(new AppError("Chapters array is required.", 400));
  }

  const doc = await setQuestionnaireLevel(req.user.id, sprintId, chapters);

  return sendSuccess(res, 200, "Questionnaire submitted successfully.", {
    probability: doc,
  });
});

// Student: Get own probability data
exports.getMyProbability = asyncHandler(async (req, res, next) => {
  const { sprintId } = req.params;

  const doc = await StudentProbability.findOne({
    student: req.user.id,
    sprint: sprintId,
  }).lean();

  if (!doc) {
    return sendSuccess(res, 200, "No probability data yet. Submit questionnaire first.", {
      probability: null,
    });
  }

  return sendSuccess(res, 200, "Probability data fetched.", { probability: doc });
});

// Admin: Get student probability
exports.getStudentProbability = asyncHandler(async (req, res, next) => {
  const { studentId, sprintId } = req.params;

  const doc = await StudentProbability.findOne({
    student: studentId,
    sprint: sprintId,
  })
    .populate("student", "name email")
    .lean();

  if (!doc) {
    return next(new AppError("No probability data found for this student.", 404));
  }

  return sendSuccess(res, 200, "Student probability fetched.", { probability: doc });
});
