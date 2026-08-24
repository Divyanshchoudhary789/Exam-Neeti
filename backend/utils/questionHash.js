/**
 * questionHash.js
 *
 * SHA-256 content hash used to dedup Question Bank entries.
 * Shared by the single-question create flow AND the bulk-upload pipeline —
 * both MUST use this identical function or dedup silently breaks.
 */

"use strict";

const crypto = require("crypto");

/**
 * @param {Object} fields
 * @param {string} fields.subject
 * @param {string} fields.classLevel
 * @param {string} fields.chapter
 * @param {string} fields.topic
 * @param {string} fields.text  — PROCESSED (post math-conversion) question text
 * @returns {string} hex SHA-256 digest
 */
const computeContentHash = ({ subject, classLevel, chapter, topic, text }) => {
  const raw = [
    (subject    || "").toLowerCase().trim(),
    (classLevel || "").toLowerCase().trim(),
    (chapter    || "").toLowerCase().trim(),
    (topic      || "").toLowerCase().trim(),
    // Normalise whitespace only — do NOT strip LaTeX so hash is stable
    (text || "").replace(/\s+/g, " ").trim(),
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

module.exports = { computeContentHash };
