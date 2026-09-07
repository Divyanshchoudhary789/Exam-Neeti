"use strict";

const Joi = require("joi");
const { CONTACT_REASONS, CONTACT_STATUS } = require("../models/ContactMessage.model");

const submitContactSchema = Joi.object({
  name:    Joi.string().trim().min(2).max(120).required(),
  email:   Joi.string().trim().lowercase().email({ tlds: false }).max(200).required(),
  reason:  Joi.string().valid(...CONTACT_REASONS).default("Other"),
  message: Joi.string().trim().min(10).max(5000).required(),
  // Honeypot — real users leave this empty; bots fill every field.
  company: Joi.string().allow("").max(200),
});

const listContactQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...CONTACT_STATUS),
  reason: Joi.string().valid(...CONTACT_REASONS),
  search: Joi.string().trim().max(120),
}).unknown(true);

const updateContactSchema = Joi.object({
  status: Joi.string().valid(...CONTACT_STATUS).required(),
});

module.exports = { submitContactSchema, listContactQuerySchema, updateContactSchema };
