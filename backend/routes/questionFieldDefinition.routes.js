/**
 * questionFieldDefinition.routes.js
 *
 * Admin/super_admin CRUD for custom Question field definitions.
 * Both roles are allowed on every route here (authorize(ROLES.ADMIN) already
 * covers super_admin via its blanket-bypass) — the product requirement is
 * that either role can define new question fields from the UI.
 *
 *   GET    /question-field-definitions            list (?activeOnly=true)
 *   POST   /question-field-definitions            create
 *   PUT    /question-field-definitions/:id        update
 *   PATCH  /question-field-definitions/:id/toggle toggle active
 *   DELETE /question-field-definitions/:id        delete (blocked if in use)
 */

"use strict";

const express = require("express");
const router = express.Router();

const controller = require("../controllers/questionFieldDefinition.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const {
  createQuestionFieldDefinitionSchema,
  updateQuestionFieldDefinitionSchema,
  listQuestionFieldDefinitionsQuerySchema,
} = require("../validators/questionFieldDefinition.validator");
const { ROLES } = require("../config/constants");

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get("/", validate(listQuestionFieldDefinitionsQuerySchema, "query"), controller.list);
router.post("/", validate(createQuestionFieldDefinitionSchema), controller.create);
router.put("/:id", validate(updateQuestionFieldDefinitionSchema), controller.update);
router.patch("/:id/toggle", controller.toggleActive);
router.delete("/:id", controller.remove);

module.exports = router;
