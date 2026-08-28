/**
 * geminiLatexService.js
 *
 * Converts a single rendered equation image (PNG) into KaTeX-compatible
 * LaTeX using Google's Gemini vision API. This is the ONLY place in the
 * bulk-upload pipeline that calls an external AI — deliberately scoped to
 * "transcribe this one cropped formula", never "read this question and
 * figure out its structure" (see the architecture note in the implementation
 * plan for why: document structure is 100% recoverable deterministically
 * from the file's own XML, so handing that to an LLM would trade a solved,
 * zero-risk problem for a probabilistic one).
 *
 * Talks to the REST API directly via axios (already a project dependency) —
 * no extra SDK dependency, no SDK-version churn to track.
 *
 * SECURITY: GEMINI_API_KEY is read from env and used server-side only. This
 * module is never reachable from the frontend.
 */

"use strict";

const axios = require("axios");
const { validateLatex } = require("../utils/mathParser");
const { runWithConcurrencyLimit } = require("../utils/concurrencyLimiter");

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const GEMINI_MODEL     = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_MAX_CONCURRENCY = Number(process.env.GEMINI_MAX_CONCURRENCY || 5);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
const MAX_RETRIES = 3;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Deliberately strict: transcription only, no "helpfulness". This is the
// single biggest lever against silently-wrong exam content — the model is
// told explicitly not to solve, complete, or clean up what it sees.
const SYSTEM_PROMPT = `You are transcribing ONE cropped image of a single mathematical/scientific expression taken from a physics, chemistry, biology, or maths exam paper.

Rules — follow exactly:
1. Output ONLY the KaTeX-compatible LaTeX for what is visibly shown. No explanation, no markdown fences, no surrounding $ signs.
2. Transcribe EXACTLY what is in the image. Do not solve it, simplify it, correct apparent errors, or add anything not visibly present.
3. Preserve notation precisely: a vector arrow (\\vec{}) is NOT the same as a unit-vector hat (\\hat{}) is NOT plain bold text — copy exactly which one is shown.
4. If the image is illegible, cut off, or not a mathematical expression at all, output exactly: UNREADABLE
5. Output nothing else besides the LaTeX (or UNREADABLE).`;

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

async function callGeminiOnce(pngBuffer) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const url = `${API_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { inline_data: { mime_type: "image/png", data: pngBuffer.toString("base64") } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 300,
    },
  };

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(url, body, { timeout: GEMINI_TIMEOUT_MS });
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Empty response from Gemini.");
      }
      return text.trim();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (!isRetryableStatus(status) || attempt === MAX_RETRIES - 1) throw err;
      // Exponential backoff: 500ms, 1000ms, ...
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/**
 * Strips accidental wrapping the model sometimes adds despite instructions
 * (markdown fences, stray $ delimiters) before KaTeX validation.
 */
function cleanLatexOutput(raw) {
  let s = raw.trim();
  s = s.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
  else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();
  return s;
}

/**
 * @param {string} id             caller's identifier for this equation
 * @param {Buffer} pngBuffer
 * @returns {Promise<{ id: string, latex: string, flagged: boolean, reason: string|null }>}
 */
async function transcribeOne(id, pngBuffer) {
  try {
    const raw = await callGeminiOnce(pngBuffer);
    if (raw.toUpperCase() === "UNREADABLE") {
      return { id, latex: "", flagged: true, reason: "Model reported the equation image as unreadable." };
    }
    const latex = cleanLatexOutput(raw);
    const { valid, error } = validateLatex(latex);
    if (!valid) {
      return { id, latex, flagged: true, reason: `KaTeX validation failed: ${error}` };
    }
    return { id, latex, flagged: false, reason: null };
  } catch (err) {
    return {
      id,
      latex: "",
      flagged: true,
      reason: `Conversion request failed: ${err.message}`,
    };
  }
}

/**
 * Transcribes a batch of equation images, bounded by GEMINI_MAX_CONCURRENCY.
 * Never throws for individual failures — each one comes back flagged instead
 * (see conversionReview on Question.model.js), so one bad/ambiguous equation
 * never blocks the rest of a document.
 *
 * @param {Array<{ id: string, pngBuffer: Buffer }>} equations
 * @returns {Promise<Map<string, { latex: string, flagged: boolean, reason: string|null }>>}
 */
async function transcribeEquationsToLatex(equations) {
  const results = new Map();
  if (!equations || equations.length === 0) return results;

  const outcomes = await runWithConcurrencyLimit(
    equations,
    GEMINI_MAX_CONCURRENCY,
    (eq) => transcribeOne(eq.id, eq.pngBuffer)
  );

  outcomes.forEach((outcome, idx) => {
    const id = equations[idx].id;
    if (outcome.ok) {
      results.set(id, outcome.value);
    } else {
      results.set(id, { id, latex: "", flagged: true, reason: outcome.error.message });
    }
  });

  return results;
}

module.exports = { transcribeEquationsToLatex };
