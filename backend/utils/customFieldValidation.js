/**
 * customFieldValidation.js
 *
 * Runtime validation for Question.customFields against the LIVE
 * QuestionFieldDefinition documents. Joi (question.validator.js) only checks
 * that `customFields` is a plain object of string keys — the actual per-type
 * validation (required, number ranges, dropdown options, ...) has to happen
 * here because the set of valid fields/types is admin-defined data, not a
 * static schema.
 */

"use strict";

const AppError = require("./AppError");

const MAX_TEXT_LENGTH = 500;
const MAX_TEXTAREA_LENGTH = 2000;

/**
 * @param {Record<string, unknown>} rawValues   — req.body.customFields (already JSON-parsed)
 * @param {Array<object>}           fieldDefinitions — ACTIVE QuestionFieldDefinition docs (lean)
 * @returns {Record<string, unknown>} normalized values, keyed ONLY by known active field keys
 */
function validateAndNormalizeCustomFields(rawValues, fieldDefinitions) {
  const input = rawValues && typeof rawValues === "object" ? rawValues : {};
  const normalized = {};

  for (const def of fieldDefinitions) {
    const raw = input[def.key];
    const isEmpty = raw === undefined || raw === null || raw === "";

    // Boolean fields always have a value (checked/unchecked) — "required"
    // doesn't apply the same way it does to text/number/select.
    if (def.required && def.type !== "boolean" && isEmpty) {
      throw new AppError(`"${def.label}" is required.`, 400);
    }

    if (isEmpty) continue; // optional and not provided — don't store it

    switch (def.type) {
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          throw new AppError(`"${def.label}" must be a valid number.`, 400);
        }
        if (def.min !== undefined && def.min !== null && n < def.min) {
          throw new AppError(`"${def.label}" must be at least ${def.min}.`, 400);
        }
        if (def.max !== undefined && def.max !== null && n > def.max) {
          throw new AppError(`"${def.label}" must be at most ${def.max}.`, 400);
        }
        normalized[def.key] = n;
        break;
      }

      case "boolean": {
        normalized[def.key] = raw === true || raw === "true";
        break;
      }

      case "select": {
        const val = String(raw);
        if (!Array.isArray(def.options) || !def.options.includes(val)) {
          throw new AppError(`"${def.label}" must be one of: ${(def.options || []).join(", ")}.`, 400);
        }
        normalized[def.key] = val;
        break;
      }

      case "textarea": {
        normalized[def.key] = String(raw).trim().slice(0, MAX_TEXTAREA_LENGTH);
        break;
      }

      case "text":
      default: {
        normalized[def.key] = String(raw).trim().slice(0, MAX_TEXT_LENGTH);
        break;
      }
    }
  }

  return normalized;
}

module.exports = { validateAndNormalizeCustomFields };
