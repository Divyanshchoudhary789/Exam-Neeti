const express = require("express");
const router = express.Router();

const batchController = require("../controllers/batch.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { createBatchSchema, updateBatchSchema, deleteBatchSchema } = require("../validators/batch.validator");
const { ROLES } = require("../config/constants");

// All batch management is admin-only.
// Students have no need to enumerate batches, view batch details, or see
// the list of students in a batch — their batch context comes from their own
// profile (GET /users/me → batch populated).
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get("/", batchController.listBatches);
router.post("/", validate(createBatchSchema), batchController.createBatch);
router.get("/:id", batchController.getBatch);
router.patch("/:id", validate(updateBatchSchema), batchController.updateBatch);
router.get("/:id/students", batchController.getBatchStudents);

// Soft-deactivate — admin and above
router.patch("/:id/deactivate", batchController.deactivateBatch);

// Reactivate a previously deactivated batch — admin and above
router.patch("/:id/reactivate", batchController.reactivateBatch);

// Hard delete — super_admin only, irreversible
router.delete(
  "/:id",
  authorize(ROLES.SUPER_ADMIN),
  validate(deleteBatchSchema),
  batchController.deleteBatch
);

module.exports = router;
