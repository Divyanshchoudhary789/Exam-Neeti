"use strict";

const Joi = require("joi");
const { PROGRAM_TYPES } = require("../config/constants");

const PROGRAM_VALUES = Object.values(PROGRAM_TYPES);

const examBreakdownSchema = Joi.object({
  minor:     Joi.number().integer().min(0).max(1000).default(0),
  semiMajor: Joi.number().integer().min(0).max(1000).default(0),
  major:     Joi.number().integer().min(0).max(1000).default(0),
});

// Shared presentation / pricing fields (create requires the essentials; update
// makes everything optional).
const planFields = {
  name:          Joi.string().trim().min(2).max(80),
  priceRupees:   Joi.number().min(0).max(1_000_000),
  mrpRupees:     Joi.number().min(0).max(1_000_000).allow(null).default(null),
  durationDays:  Joi.number().integer().min(1).max(3650).allow(null),
  testsIncluded: Joi.number().integer().min(0).max(1000).default(0),
  description:   Joi.string().trim().allow("").max(600).default(""),
  programType:   Joi.string().valid(...PROGRAM_VALUES).allow(null).default(null),
  tagline:       Joi.string().trim().allow("").max(120).default(""),
  features:      Joi.array().items(Joi.string().trim().max(120)).max(12).default([]),
  examBreakdown: examBreakdownSchema.default({}),
  featured:      Joi.boolean().default(false),
  sortOrder:     Joi.number().integer().min(0).max(999).default(0),
};

const createPlanSchema = Joi.object({
  ...planFields,
  name:        planFields.name.required(),
  priceRupees: planFields.priceRupees.required(),

  // Batch wiring — a plan always ends up linked to one `source: "public"` batch.
  batchMode: Joi.string().valid("create", "link").default("create"),
  batchName: Joi.string().trim().min(2).max(100),                       // optional override for "create"
  batchSlug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]{2,60}$/) // required for "link"
    .when("batchMode", { is: "link", then: Joi.required() }),
});

const updatePlanSchema = Joi.object({
  ...planFields,
  isActive: Joi.boolean(),
}).min(1);

module.exports = { createPlanSchema, updatePlanSchema };
