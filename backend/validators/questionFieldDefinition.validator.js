/**
 * questionFieldDefinition.validator.js
 *
 * Joi validation schemas for admin-managed custom Question field definitions.
 * `key` and `type` are only accepted on CREATE — omitting them from the
 * update schema makes them immutable server-side (stripUnknown drops any
 * attempt to change them via PUT).
 */

"use strict";

const Joi = require("joi");

const keyPattern = /^[a-z][a-zA-Z0-9]{0,39}$/;

const createQuestionFieldDefinitionSchema = Joi.object({
  key: Joi.string().pattern(keyPattern).required().messages({
    "string.pattern.base":
      "Key must start with a lowercase letter and contain only letters/numbers (max 40 chars).",
    "any.required": "Key is required.",
  }),
  label: Joi.string().trim().min(1).max(100).required().messages({
    "any.required": "Label is required.",
  }),
  type: Joi.string()
    .valid("text", "textarea", "number", "select", "boolean")
    .required()
    .messages({
      "any.required": "Type is required.",
      "any.only": "Type must be text, textarea, number, select, or boolean.",
    }),
  options: Joi.when("type", {
    is: "select",
    then: Joi.array().items(Joi.string().trim().min(1).max(100)).min(1).required().messages({
      "array.min": "Provide at least one option for a dropdown field.",
      "any.required": "Provide at least one option for a dropdown field.",
    }),
    otherwise: Joi.array().items(Joi.string()).default([]),
  }),
  required: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).default(0),
  helpText: Joi.string().trim().allow("").max(200).default(""),
  min: Joi.number().allow(null).default(null),
  max: Joi.number().allow(null).default(null),
});

const updateQuestionFieldDefinitionSchema = Joi.object({
  label: Joi.string().trim().min(1).max(100),
  options: Joi.array().items(Joi.string().trim().min(1).max(100)),
  required: Joi.boolean(),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0),
  helpText: Joi.string().trim().allow("").max(200),
  min: Joi.number().allow(null),
  max: Joi.number().allow(null),
}).min(1);

const listQuestionFieldDefinitionsQuerySchema = Joi.object({
  activeOnly: Joi.boolean().default(false),
});

module.exports = {
  createQuestionFieldDefinitionSchema,
  updateQuestionFieldDefinitionSchema,
  listQuestionFieldDefinitionsQuerySchema,
};
