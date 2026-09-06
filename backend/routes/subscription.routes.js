const express = require("express");
const router = express.Router();

const subscriptionController = require("../controllers/subscription.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { ROLES } = require("../config/constants");

router.use(authenticate, authorize(ROLES.STUDENT));

router.get("/me", subscriptionController.getMySubscription);
router.get("/me/access", subscriptionController.getMyAccess);

module.exports = router;
