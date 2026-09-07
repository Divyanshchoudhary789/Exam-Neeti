"use strict";

const Joi = require("joi");
const { SUBSCRIBER_SOURCES, SUBSCRIBER_STATUS } = require("../models/Subscriber.model");

const subscribeSchema = Joi.object({
  email:  Joi.string().trim().lowercase().email({ tlds: false }).max(200).required(),
  source: Joi.string().valid(...SUBSCRIBER_SOURCES).default("other"),
  // Honeypot — real users leave this empty; bots fill every field.
  company: Joi.string().allow("").max(200),
});

const listSubscribersQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...SUBSCRIBER_STATUS),
  source: Joi.string().valid(...SUBSCRIBER_SOURCES),
  search: Joi.string().trim().max(200),
}).unknown(true);

module.exports = { subscribeSchema, listSubscribersQuerySchema };
