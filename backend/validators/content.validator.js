"use strict";

const Joi = require("joi");
const { RESOURCE_KINDS } = require("../models/Resource.model");

const hexColor = Joi.string().pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

const blogStyleSchema = Joi.object({
  fontFamily:   Joi.string().valid("sans", "serif", "mono"),
  fontSizePx:   Joi.number().integer().min(12).max(24),
  lineHeight:   Joi.number().min(1.2).max(2.4),
  textColor:    hexColor,
  headingColor: hexColor,
  accentColor:  hexColor,
  align:        Joi.string().valid("left", "center", "justify"),
});

const createBlogSchema = Joi.object({
  title:    Joi.string().trim().min(3).max(200).required(),
  excerpt:  Joi.string().trim().allow("").max(400).default(""),
  content:  Joi.string().trim().min(1).required(),
  category: Joi.string().trim().max(60).default("General"),
  tags:     Joi.array().items(Joi.string().trim().max(40)).max(12).default([]),
  status:   Joi.string().valid("draft", "published").default("draft"),
  style:    blogStyleSchema.default({}),
  readMinutes: Joi.number().integer().min(1).max(60),
  removeCoverImage: Joi.boolean().default(false),
});

const updateBlogSchema = Joi.object({
  title:    Joi.string().trim().min(3).max(200),
  excerpt:  Joi.string().trim().allow("").max(400),
  content:  Joi.string().trim().min(1),
  category: Joi.string().trim().max(60),
  tags:     Joi.array().items(Joi.string().trim().max(40)).max(12),
  status:   Joi.string().valid("draft", "published"),
  style:    blogStyleSchema,
  readMinutes: Joi.number().integer().min(1).max(60),
  removeCoverImage: Joi.boolean().default(false),
}).min(1);

const YT = Joi.string().uri().pattern(/(youtube\.com|youtu\.be)/i);

const createResourceSchema = Joi.object({
  title:       Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().allow("").max(500).default(""),
  detail:      Joi.string().trim().allow("").max(5000).default(""),
  kind:        Joi.string().valid(...RESOURCE_KINDS).required(),
  youtubeUrl:  Joi.when("kind", { is: "video", then: YT.required(), otherwise: YT.allow(null, "") }),
  externalUrl: Joi.string().uri().allow(null, ""),
  subject:     Joi.string().valid("biology", "chemistry", "physics").allow(null, ""),
  classLevel:  Joi.string().valid("XI", "XII", "dropper").allow(null, ""),
  tags:        Joi.array().items(Joi.string().trim().max(40)).max(12).default([]),
  status:      Joi.string().valid("draft", "published").default("draft"),
  removeCoverImage: Joi.boolean().default(false),
  removeFile:       Joi.boolean().default(false),
});

const updateResourceSchema = createResourceSchema.fork(
  ["title", "kind"],
  (s) => s.optional()
).min(1);

const listContentQuerySchema = Joi.object({
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(50).default(12),
  status:     Joi.string().valid("draft", "published", "all"),
  kind:       Joi.string().valid(...RESOURCE_KINDS),
  category:   Joi.string().trim().max(60),
  subject:    Joi.string().trim().max(40),
  classLevel: Joi.string().trim().max(20),
  search:     Joi.string().trim().max(120),
  tag:        Joi.string().trim().max(40),
}).unknown(true);

module.exports = {
  createBlogSchema,
  updateBlogSchema,
  createResourceSchema,
  updateResourceSchema,
  listContentQuerySchema,
};
