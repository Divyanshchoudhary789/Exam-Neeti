const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { bulkImportStudentsSchema } = require("../validators/batch.validator");
const {
  createStudentSchema,
  updateStudentSchema,
  updateMyProfileSchema,
  deleteStudentSchema,
} = require("../validators/user.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);

// ── Student-accessible routes ─────────────────────────────────────────────────
// Students can only read and update their own profile.
// /me routes must be defined BEFORE router.use(authorize(ROLES.ADMIN))
// so they remain accessible to students.
router.get("/me", userController.getMyProfile);
router.patch("/me", validate(updateMyProfileSchema), userController.updateMyProfile);

// ── Admin-only routes ─────────────────────────────────────────────────────────
// All student management operations are restricted to admins and super_admin.
router.use(authorize(ROLES.ADMIN));

router.get("/", userController.listStudents);
router.post("/", validate(createStudentSchema), userController.createStudent);
router.post("/bulk-import", validate(bulkImportStudentsSchema), userController.bulkImportStudents);
router.get("/:id", userController.getStudent);
router.patch("/:id", validate(updateStudentSchema), userController.updateStudent);
router.patch("/:id/deactivate", userController.deactivateStudent);
router.patch("/:id/reactivate", userController.reactivateStudent);

// ── Super-admin-only routes ───────────────────────────────────────────────────
// Hard delete is irreversible — restricted to super_admin only.
router.delete(
  "/:id",
  authorize(ROLES.SUPER_ADMIN),
  validate(deleteStudentSchema),
  userController.deleteStudent
);

module.exports = router;
