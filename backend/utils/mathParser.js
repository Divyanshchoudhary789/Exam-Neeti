/**
 * mathParser.js — Natural Math Notation → LaTeX Converter
 *
 * PURPOSE
 * ───────
 * Teachers / admins enter math in a natural shorthand they already know.
 * This module converts that shorthand to valid KaTeX-compatible LaTeX,
 * then validates the result with KaTeX server-side before storing.
 *
 * INPUT MODES (auto-detected, priority order)
 * ────────────────────────────────────────────
 * 1. Pure LaTeX / already delimited — contains $...$ or $$...$$
 *    → only the math segments inside $ are processed (shorthand converted)
 *    → text outside $ is left as plain text
 *
 * 2. Pure math expression — entire input is a formula (no natural-language words)
 *    → whole input converted and wrapped in $...$
 *
 * 3. Natural sentence — plain text with math tokens embedded
 *    → math sub-expressions auto-detected, converted, and wrapped in $...$
 *    → surrounding text preserved as plain text
 *
 * SUPPORTED SHORTHAND (inside math segments or auto-detected)
 * ───────────────────────────────────────────────────────────
 *   frac(a,b)          →  \frac{a}{b}
 *   (a)/(b)            →  \frac{a}{b}
 *   sqrt(x)            →  \sqrt{x}
 *   root(n,x)          →  \sqrt[n]{x}
 *   x^(n+1)            →  x^{n+1}
 *   x_(n+1)            →  x_{n+1}
 *   vec(F)             →  \vec{F}
 *   hat(x)             →  \hat{x}
 *   bar(x)             →  \bar{x}
 *   abs(x)             →  \left|x\right|
 *   floor(x)           →  \lfloor x \rfloor
 *   ceil(x)            →  \lceil x \rceil
 *   alpha,beta,...      →  \alpha, \beta, ...  (all Greek, upper+lower)
 *   sin,cos,tan,...     →  \sin, \cos, \tan, ...
 *   log,ln,lim,...      →  \log, \ln, \lim, ...
 *   int, oint, sum, prod → \int, \oint, \sum, \prod
 *   partial, del        →  \partial
 *   nabla              →  \nabla
 *   +-                 →  \pm
 *   -+                 →  \mp
 *   xx / times         →  \times
 *   cdot               →  \cdot
 *   <=, >=, !=, ~=, ~~ →  \leq, \geq, \neq, \cong, \approx
 *   ->, <-, <->, =>, <=> → \to, \leftarrow, \leftrightarrow, \Rightarrow, \Leftrightarrow
 *   uarr, darr         →  \uparrow, \downarrow
 *   ...                →  \ldots
 *   inf / infinity     →  \infty
 *   30 deg / 30°       →  30^\circ
 *
 * EXPORTS
 * ───────
 *   processText(input)            → { text: string, hasLatex: boolean }
 *   processAndValidateText(input) → { text: string, hasLatex: boolean }  (throws on invalid LaTeX)
 *   convertMathSegment(expr)      → string (LaTeX, no $ delimiters)
 *   validateLatex(latex)          → { valid: boolean, error?: string }
 */

"use strict";

const katex   = require("katex");
const AppError = require("./AppError");

// ─── Greek letter map ─────────────────────────────────────────────────────────

const GREEK_LOWER = [
  "alpha","beta","gamma","delta","epsilon","varepsilon","zeta","eta",
  "theta","vartheta","iota","kappa","lambda","mu","nu","xi","pi","varpi",
  "rho","varrho","sigma","varsigma","tau","upsilon","phi","varphi",
  "chi","psi","omega",
];

const GREEK_UPPER = [
  "Gamma","Delta","Theta","Lambda","Xi","Pi","Sigma","Upsilon","Phi","Psi","Omega",
];

const ALL_GREEK = [...GREEK_LOWER, ...GREEK_UPPER];

const GREEK_REGEX = new RegExp(
  // Match Greek words even when followed by _ or ^ (subscript/superscript)
  `\\b(${ALL_GREEK.join("|")})(?=[^a-zA-Z]|$)`,
  "g"
);

// Math functions to prefix with backslash
const MATH_FUNCTIONS = [
  "arcsin","arccos","arctan","arccot","arcsec","arccsc",
  "sinh","cosh","tanh","coth",
  "sin","cos","tan","cot","sec","csc",
  "log","ln","exp","lg",
  "limsup","liminf","lim",
  "max","min","sup",
  "det","dim","ker",
  "gcd",
];
const MATH_FUNC_REGEX = new RegExp(`\\b(${MATH_FUNCTIONS.join("|")})\\b`, "g");

// ─── Balanced paren function-call replacer ────────────────────────────────────

/**
 * Extracts and replaces function-call patterns of the form NAME(args...)
 * using balanced parenthesis matching (handles nesting correctly).
 *
 * @param {string}   s         Input string
 * @param {string}   name      Function name to match (exact, case-sensitive)
 * @param {Function} transform (args: string[]) => string
 * @returns {string}
 */
function replaceFuncCalls(s, name, transform) {
  const tag    = name + "(";
  const tagLen = tag.length;
  let result   = "";
  let i        = 0;

  while (i < s.length) {
    const idx = s.indexOf(tag, i);
    if (idx === -1) { result += s.slice(i); break; }

    result += s.slice(i, idx);
    i = idx + tagLen;

    // Collect argument string with balanced parens
    let depth  = 1;
    let argStr = "";
    while (i < s.length && depth > 0) {
      const ch = s[i];
      if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth === 0) { i++; break; } }
      argStr += ch;
      i++;
    }

    result += transform(splitTopLevelCommas(argStr));
  }

  return result;
}

/**
 * Splits a string on commas that are NOT inside parentheses.
 */
function splitTopLevelCommas(s) {
  const parts = [];
  let depth   = 0;
  let current = "";

  for (const ch of s) {
    if (ch === "(")      depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(current); current = ""; }
    else current += ch;
  }
  if (current !== "") parts.push(current);
  return parts;
}

// ─── Core math segment converter ─────────────────────────────────────────────

/**
 * Converts a single math expression (WITHOUT $ delimiters) to LaTeX.
 *
 * @param {string} expr
 * @returns {string}  LaTeX string
 */
function convertMathSegment(expr) {
  if (!expr) return expr;
  let s = expr;

  // ── 1. Protect existing \cmd{} and \cmd patterns ──────────────────────────
  const protected_ = [];
  const protect = (str) => {
    const id = `\x00P${protected_.length}\x00`;
    protected_.push(str);
    return id;
  };
  const restore = (str) =>
    str.replace(/\x00P(\d+)\x00/g, (_, i) => protected_[Number(i)]);

  // Protect \command{...} with nested braces
  s = s.replace(/\\[a-zA-Z]+(?:\{[^}]*\})*/g, protect);
  // Protect remaining \command
  s = s.replace(/\\[a-zA-Z]+/g, protect);

  // ── 2. Named function calls (order matters — process before Greek/func subs) ─

  s = replaceFuncCalls(s, "frac",  (a) => a.length === 2
    ? `\\frac{${a[0].trim()}}{${a[1].trim()}}`
    : `\\frac{${a[0].trim()}}{${(a.slice(1).join(",")).trim()}}`
  );

  s = replaceFuncCalls(s, "root",  (a) => a.length === 2
    ? `\\sqrt[${a[0].trim()}]{${a[1].trim()}}`
    : `\\sqrt{${a.join(",")}}`
  );

  s = replaceFuncCalls(s, "sqrt",  (a) => `\\sqrt{${a.join(",")}}`);
  s = replaceFuncCalls(s, "vec",   (a) => `\\vec{${a.join(",")}}`);
  s = replaceFuncCalls(s, "hat",   (a) => `\\hat{${a.join(",")}}`);
  s = replaceFuncCalls(s, "bar",   (a) => `\\bar{${a.join(",")}}`);
  s = replaceFuncCalls(s, "tilde", (a) => `\\tilde{${a.join(",")}}`);
  s = replaceFuncCalls(s, "abs",   (a) => `\\left|${a.join(",")}\\right|`);
  s = replaceFuncCalls(s, "floor", (a) => `\\lfloor ${a.join(",")} \\rfloor`);
  s = replaceFuncCalls(s, "ceil",  (a) => `\\lceil ${a.join(",")} \\rceil`);
  s = replaceFuncCalls(s, "norm",  (a) => `\\left\\|${a.join(",")}\\right\\|`);

  // ── 3. Math functions ──────────────────────────────────────────────────────
  s = s.replace(MATH_FUNC_REGEX, (m) => `\\${m}`);

  // ── 4. Greek letters ──────────────────────────────────────────────────────
  s = s.replace(GREEK_REGEX, (m) => `\\${m}`);

  // ── 5. Special constants / symbols ────────────────────────────────────────
  s = s.replace(/\b(infinity|infty)\b/gi, "\\infty");
  // "inf" only if it's standalone (not inside a word like "infinite")
  s = s.replace(/\binf\b/g, "\\infty");

  // ── 6. Operators (order matters — multi-char before single-char) ──────────
  s = s.replace(/\+-/g,  "\\pm ");
  s = s.replace(/-\+/g,  "\\mp ");
  s = s.replace(/\bxx\b/g,    "\\times ");
  s = s.replace(/\btimes\b/g, "\\times ");
  s = s.replace(/\bcdot\b/g,  "\\cdot ");
  s = s.replace(/\bdiv\b/g,   "\\div ");
  s = s.replace(/\bmod\b/g,   "\\bmod ");

  // ── 7. Calculus ────────────────────────────────────────────────────────────
  s = s.replace(/\bnabla\b/g,    "\\nabla");
  s = s.replace(/\bpartial\b/g,  "\\partial");
  s = s.replace(/\bdel\b/g,      "\\partial");
  s = s.replace(/\boint\b/g,     "\\oint");
  // int and sum: word-boundary won't match before _ or ^, so use lookahead
  s = s.replace(/\bint(?=[_^{\s\\]|$)/g,  "\\int");
  s = s.replace(/\bsum(?=[_^{\s\\]|$)/g,  "\\sum");
  s = s.replace(/\bprod(?=[_^{\s\\]|$)/g, "\\prod");
  // Fallback: standalone int/sum/prod
  s = s.replace(/\bint\b/g,   "\\int");
  s = s.replace(/\bsum\b/g,   "\\sum");
  s = s.replace(/\bprod\b/g,  "\\prod");

  // ── 8. Relations (multi-char first) ──────────────────────────────────────
  s = s.replace(/<->/g,  "\\leftrightarrow ");
  s = s.replace(/<=>/g,  "\\Leftrightarrow ");
  s = s.replace(/=>/g,   "\\Rightarrow ");
  s = s.replace(/<=/g,   "\\leq ");
  s = s.replace(/>=/g,   "\\geq ");
  s = s.replace(/!=/g,   "\\neq ");
  s = s.replace(/~=/g,   "\\cong ");
  s = s.replace(/~~/g,   "\\approx ");
  s = s.replace(/\bapprox\b/g,  "\\approx ");
  s = s.replace(/\bpropto\b/g,  "\\propto ");
  s = s.replace(/->/g,   "\\to ");
  s = s.replace(/<-/g,   "\\leftarrow ");
  s = s.replace(/\buarr\b/g, "\\uparrow");
  s = s.replace(/\bdarr\b/g, "\\downarrow");

  // ── 9. Dots ────────────────────────────────────────────────────────────────
  s = s.replace(/\bldots\b/g,  "\\ldots");
  s = s.replace(/\bcdots\b/g,  "\\cdots");
  s = s.replace(/\bvdots\b/g,  "\\vdots");
  s = s.replace(/\bddots\b/g,  "\\ddots");
  s = s.replace(/\.{3,}/g,     "\\ldots");

  // ── 10. Degree symbol ─────────────────────────────────────────────────────
  // Handle BEFORE subscript/superscript processing
  s = s.replace(/(\d+)\s*°/g,        "$1^{\\circ}");
  s = s.replace(/(\d+)\s*\bdeg\b/g,  "$1^{\\circ}");
  // Non-numeric degree: theta deg → theta^{\circ}
  s = s.replace(/([A-Za-z}])\s*\bdeg\b/g, "$1^{\\circ}");

  // ── 11. Superscripts / subscripts ─────────────────────────────────────────
  // x^(n+1) → x^{n+1}
  s = s.replace(/\^\(([^)]+)\)/g, (_, inner) => `^{${inner}}`);
  // x_(n+1) → x_{n+1}
  s = s.replace(/_\(([^)]+)\)/g,  (_, inner) => `_{${inner}}`);
  // x^ab → x^{ab} (multi-char not already in braces)
  s = s.replace(/\^([A-Za-z][A-Za-z0-9]+)/g, (_, sup) => `^{${sup}}`);
  s = s.replace(/_([A-Za-z][A-Za-z0-9]+)/g,  (_, sub) => `_{${sub}}`);

  // ── 12. (a)/(b) → \frac{a}{b} ────────────────────────────────────────────
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_, n, d) => `\\frac{${n}}{${d}}`);

  // ── 13. Bare a/b → \frac{a}{b} (conservative) ────────────────────────────
  // Both sides must be multi-char or numbers; skip unit-like single-letter/letter
  const UNIT_LIKE = /^(s|m|kg|K|mol|A|cd|N|J|W|Pa|Hz|C|V|F|T|H|lm|lx|Bq|Gy|Sv|L|eV|cal)$/;
  s = s.replace(
    /([A-Za-z0-9_.^{}\\]+)\s*\/\s*([A-Za-z0-9_.^{}\\]+)/g,
    (match, num, den) => {
      if (/^[a-zA-Z]$/.test(num) && /^[a-zA-Z]$/.test(den)) return match;
      if (UNIT_LIKE.test(den)) return match;
      return `\\frac{${num}}{${den}}`;
    }
  );

  // ── 14. Restore protected LaTeX ───────────────────────────────────────────
  s = restore(s);

  return s;
}

// ─── validateLatex ────────────────────────────────────────────────────────────

/**
 * Validates a LaTeX string (WITHOUT $ delimiters) using KaTeX.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLatex(latex) {
  try {
    katex.renderToString(latex || "", {
      throwOnError: true,
      displayMode:  false,
      strict:       false,
      trust:        false,
      output:       "html",
    });
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: (err.message || "").replace(/KaTeX parse error:\s*/, ""),
    };
  }
}

/**
 * Validates and throws a descriptive Error on failure.
 * @param {string} latex         LaTeX fragment (no $ delimiters)
 * @param {string} originalExpr  Original input for error message
 */
function validateLatexFragment(latex, originalExpr) {
  const { valid, error } = validateLatex(latex);
  if (!valid) {
    throw new Error(
      `Math conversion error near "${(originalExpr || "").slice(0, 60)}":\n` +
      `  Converted to: "${(latex || "").slice(0, 80)}"\n` +
      `  KaTeX says: ${error}\n` +
      `  Tip: Use $...$ to write LaTeX directly, or check the shorthand guide.`
    );
  }
}

// ─── Text processing helpers ──────────────────────────────────────────────────

/**
 * Returns true if the input looks like a standalone math expression
 * (not a natural-language sentence).
 */
function looksLikePureMath(s) {
  // Contains natural-language words → not pure math
  const NL_WORDS = /\b(is|are|was|were|the|a|an|in|of|to|for|by|with|find|calculate|determine|what|which|how|when|where|if|given|let|consider|prove|show|assuming|body|ball|particle|distance|time|speed|mass|charge|current)\b/i;
  if (NL_WORDS.test(s)) return false;

  // Has spaces and is longer than 25 chars without a clear math operator → probably a phrase
  if (/\s/.test(s) && s.length > 25) {
    const hasMathOp = /[\^_=+\-*/]|frac\(|sqrt\(|root\(|vec\(|\\[a-zA-Z]/.test(s);
    if (!hasMathOp) return false;
  }

  // Must have at least one math token
  const hasMath = /[\^_=+\-*]|frac\(|sqrt\(|root\(|vec\(|hat\(|abs\(|\\[a-zA-Z]|\bfrac\b|\bsqrt\b/.test(s);
  if (!hasMath && !/\b(alpha|beta|gamma|delta|theta|lambda|mu|nu|pi|sigma|tau|phi|omega)\b/i.test(s)) {
    return false;
  }

  return true;
}

/**
 * Detects and converts math segments embedded in a natural sentence.
 * Returns the sentence with math expressions wrapped in $...$.
 *
 * Strategy: scan for "trigger" patterns, then greedily extract the math span.
 */
function processMixedText(text) {
  // We run multiple targeted passes rather than one huge regex:

  // Pass 1: Named math functions used in text: frac(...), sqrt(...), etc.
  const NAMED_FUNC_RE = /\b(frac|sqrt|root|vec|hat|bar|abs|floor|ceil|tilde|norm)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)/g;
  text = text.replace(NAMED_FUNC_RE, (match) => {
    const conv = convertMathSegment(match.trim());
    const { valid } = validateLatex(conv);
    return valid ? `$${conv}$` : match;
  });

  // Pass 2: Greek letters followed by math context
  const GREEK_MATH_RE = new RegExp(
    `\\b(${ALL_GREEK.join("|")})\\s*(?:=|\\^|_|<|>|\\+|-|\\*|\\s+[0-9])([^,;.!?\\n]*)`,
    "g"
  );
  text = text.replace(GREEK_MATH_RE, (match) => {
    // Only wrap if not already inside $
    const conv = convertMathSegment(match.trim());
    const { valid } = validateLatex(conv);
    return valid ? `$${conv}$` : match;
  });

  // Pass 3: Standalone Greek letters (not followed by math) — wrap individually
  text = text.replace(
    new RegExp(`(?<!\\$[^$]*)\\b(${ALL_GREEK.join("|")})\\b(?![^$]*\\$)`, "g"),
    (_, g) => `$\\${g}$`
  );

  // Pass 4: Equation patterns: identifier = expression (e.g. "F = ma", "v^2 = u^2 + 2as")
  // Match: optional leading var, =, then expression until punctuation/end
  const EQ_RE = /([A-Za-z_][A-Za-z0-9_]*(?:[_^][A-Za-z0-9{}]+)*)\s*(=)\s*([A-Za-z0-9_+\-*/^().,\\]+(?:\s[A-Za-z0-9_+\-*/^().,\\]+){0,4})/g;
  text = text.replace(EQ_RE, (match) => {
    // Skip if already wrapped
    if (match.startsWith("$")) return match;
    const conv = convertMathSegment(match.trim());
    const { valid } = validateLatex(conv);
    return valid ? `$${conv}$` : match;
  });

  // Pass 5: Superscripts/subscripts in isolation: x^2, v_0, m^2
  const SUPSUB_RE = /\b([A-Za-z][A-Za-z0-9]*)(?:\^([A-Za-z0-9{(][A-Za-z0-9+\-*/^(){}]*)|_([A-Za-z0-9{(][A-Za-z0-9+\-*/^(){}]*))+/g;
  text = text.replace(SUPSUB_RE, (match) => {
    if (match.startsWith("$")) return match;
    const conv = convertMathSegment(match.trim());
    const { valid } = validateLatex(conv);
    return valid ? `$${conv}$` : match;
  });

  return text;
}

// ─── Main text processor ──────────────────────────────────────────────────────

/**
 * Processes a full text string (question text, solution text, option text).
 *
 * @param {string} input
 * @returns {{ text: string, hasLatex: boolean }}
 */
function processText(input) {
  if (input == null) return { text: "", hasLatex: false };
  if (typeof input !== "string") return { text: String(input), hasLatex: false };

  const trimmed = input.trim();
  if (!trimmed) return { text: trimmed, hasLatex: false };

  // ── Mode A: Input already contains $ delimiters ───────────────────────────
  if (trimmed.includes("$")) {
    let processed = trimmed;

    // Process display math $$...$$ first (greedy non-$ match inside)
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
      const conv = convertMathSegment(inner);
      return `$$${conv}$$`;
    });

    // Process inline math $...$
    processed = processed.replace(/\$([^$\n]+)\$/g, (_, inner) => {
      const conv = convertMathSegment(inner);
      return `$${conv}$`;
    });

    return { text: processed, hasLatex: true };
  }

  // ── Mode B: Pure math expression ─────────────────────────────────────────
  if (looksLikePureMath(trimmed)) {
    const conv = convertMathSegment(trimmed);
    return { text: `$${conv}$`, hasLatex: true };
  }

  // ── Mode C: Natural text — detect and wrap math spans ────────────────────
  const processed = processMixedText(trimmed);
  const hasLatex  = processed.includes("$");

  return { text: processed, hasLatex };
}

// ─── Full processor with KaTeX validation ────────────────────────────────────

/**
 * Processes and validates text. Throws on invalid LaTeX.
 *
 * @param {string} input
 * @returns {{ text: string, hasLatex: boolean }}
 * @throws {Error} if converted LaTeX fails KaTeX validation
 */
function processAndValidateText(input) {
  if (!input || !input.trim()) return { text: input || "", hasLatex: false };

  const result = processText(input);

  // Validate every $...$ and $$...$$ fragment in the output
  const fragRe = /\$\$?([\s\S]+?)\$\$?/g;
  let m;
  while ((m = fragRe.exec(result.text)) !== null) {
    const frag = m[1];
    validateLatexFragment(frag, input);
  }

  return result;
}

// ─── processMathField ─────────────────────────────────────────────────────────

/**
 * Processes a single text field (question text, solution text, or an option's
 * text) through the math pipeline, with field-context added to any error.
 *
 * Shared by the single-question create/update flow AND the bulk-upload
 * pipeline so both paths validate LaTeX identically.
 *
 * @param {*}      value      Raw input (may be undefined/null/empty)
 * @param {string} fieldName  Used only to make thrown errors actionable
 * @returns {{ text: string, hasLatex: boolean }}
 */
function processMathField(value, fieldName) {
  if (!value && value !== 0) return { text: "", hasLatex: false };
  try {
    return processAndValidateText(String(value));
  } catch (err) {
    throw new AppError(
      `Invalid math in field "${fieldName}": ${err.message}`,
      400
    );
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  processText,
  processAndValidateText,
  convertMathSegment,
  validateLatex,
  validateLatexFragment,
  processMathField,
};
