/**
 * mathTypeset.service.js
 *
 * Pure-Node LaTeX typesetting for document export — NO browser, NO LibreOffice.
 *
 *   latexToSvg(latex)   → { svg, widthPt, heightPt }   (for the PDF export, via svg-to-pdfkit)
 *   latexToOmml(latex)  → "<m:oMath …>…</m:oMath>"      (for the Word export, real editable equations)
 *   splitTextMath(text) → [{ type:"text"|"math", value, display }]
 *
 * MathJax is initialised once (module singleton). Results are memoised — a
 * question paper reuses the same symbols/fragments many times.
 */

"use strict";

const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");
const { SerializedMmlVisitor } = require("mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js");
const { STATE } = require("mathjax-full/js/core/MathItem.js");
const { mml2omml } = require("mathml2omml");
const { ImportedXmlComponent } = require("docx");

// bussproofs needs an output jax with getBBox(); the MathML-only doc has none.
const TEX_PACKAGES = AllPackages.filter((p) => p !== "bussproofs");

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// One doc for SVG output (PDF path), one for MathML output (Word path).
const svgDoc = mathjax.document("", {
  InputJax: new TeX({ packages: TEX_PACKAGES }),
  OutputJax: new SVG({ fontCache: "none" }), // inline every glyph path — needed so each SVG is self-contained
});
const mmlDoc = mathjax.document("", { InputJax: new TeX({ packages: TEX_PACKAGES }) });
const mmlVisitor = new SerializedMmlVisitor();

const svgCache = new Map();
const ommlCache = new Map();

/**
 * LaTeX → self-contained SVG + geometry (in `ex` units, caller multiplies by
 * its own font's x-height to get points, so inline math matches the text size).
 *   widthEx / heightEx — bounding box
 *   depthEx            — how far the box extends BELOW the text baseline
 *                        (from MathJax's `vertical-align`)
 */
function latexToSvg(latex, display = false) {
  const key = (display ? "D:" : "I:") + latex;
  if (svgCache.has(key)) return svgCache.get(key);

  let result;
  try {
    const node = svgDoc.convert(String(latex), { display });
    let svg = adaptor.outerHTML(node);
    const container = svg;
    const m = svg.match(/<svg[\s\S]*<\/svg>/);
    svg = m ? m[0] : svg;
    const widthEx = parseFloat((svg.match(/width="(-?[\d.]+)ex"/) || [])[1] || "2");
    const heightEx = parseFloat((svg.match(/height="(-?[\d.]+)ex"/) || [])[1] || "2");
    // MathJax puts the baseline offset on the <mjx-container> style, not the <svg>.
    const va = parseFloat((container.match(/vertical-align:\s*(-?[\d.]+)ex/) || [])[1] || "0");
    const depthEx = va < 0 ? -va : 0;
    result = { svg, widthEx, heightEx, depthEx, ok: true };
  } catch (err) {
    result = { svg: null, widthEx: 0, heightEx: 0, depthEx: 0, ok: false, error: err.message, raw: latex };
  }
  svgCache.set(key, result);
  return result;
}

/**
 * LaTeX → OMML component ready to drop into a docx Paragraph's `children`.
 * Returns null on failure (caller falls back to plain "$latex$" text).
 */
function latexToOmmlComponent(latex) {
  const key = String(latex);
  let xml;
  if (ommlCache.has(key)) {
    xml = ommlCache.get(key);
  } else {
    xml = null;
    try {
      const node = mmlDoc.convert(String(latex), { display: false, end: STATE.CONVERT });
      const mml = mmlVisitor.visitTree(node, mmlDoc);
      const omml = mml2omml(mml); // <m:oMath xmlns:m=… xmlns:w=…>…</m:oMath>
      if (typeof omml === "string" && /^<m:oMath[\s>]/.test(omml)) xml = omml;
    } catch {
      xml = null;
    }
    ommlCache.set(key, xml);
  }
  // fromXmlString can still throw on a subtly malformed fragment — never let
  // that abort the whole document; fall back to null (caller prints text).
  if (!xml) return null;
  try {
    return ImportedXmlComponent.fromXmlString(xml).root[0] || null;
  } catch {
    return null;
  }
}

// ─── LaTeX → Unicode text ────────────────────────────────────────────────────
// Most inline math in this bank is simple (single vars, greek, sub/super-
// scripts, vectors, simple fractions). Rendering those as Unicode text lets
// pdfkit lay them out with the surrounding prose — no baseline/size fighting.
// Anything this can't fully resolve (leftover `\` or unbalanced braces) is
// reported as not-plain, and the caller renders it as an SVG block instead.

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "µ", nu: "ν", xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ",
  varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "φ",
  varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const OPS = {
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓", ast: "∗", star: "⋆",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈",
  equiv: "≡", sim: "∼", simeq: "≃", cong: "≅", propto: "∝", ll: "≪", gg: "≫",
  to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
  Rightarrow: "⇒", Leftarrow: "⇐", implies: "⇒", iff: "⇔", mapsto: "↦",
  infty: "∞", partial: "∂", nabla: "∇", forall: "∀", exists: "∃",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", subseteq: "⊆", cup: "∪",
  cap: "∩", emptyset: "∅", angle: "∠", perp: "⊥", parallel: "∥",
  circ: "∘", bullet: "•", cdots: "⋯", ldots: "…", dots: "…", vdots: "⋮",
  Re: "ℜ", Im: "ℑ", hbar: "ℏ", ell: "ℓ", degree: "°", prime: "′",
  langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
  sum: "Σ", prod: "∏", int: "∫", oint: "∮", pm2: "±",
  Leftrightarrow: "⇔", neg: "¬", land: "∧", lor: "∨", oplus: "⊕", otimes: "⊗",
};
const FUNCS = ["sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh",
  "log", "ln", "lg", "exp", "lim", "max", "min", "det", "gcd", "arg", "deg",
  "arcsin", "arccos", "arctan", "sgn", "Tr"];
const SUP = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹",
  "+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ","a":"ᵃ","b":"ᵇ","c":"ᶜ","d":"ᵈ",
  "e":"ᵉ","f":"ᶠ","g":"ᵍ","h":"ʰ","j":"ʲ","k":"ᵏ","l":"ˡ","m":"ᵐ","o":"ᵒ","p":"ᵖ","r":"ʳ",
  "s":"ˢ","t":"ᵗ","u":"ᵘ","v":"ᵛ","w":"ʷ","x":"ˣ","y":"ʸ","z":"ᶻ","T":"ᵀ" };
const SUB = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉",
  "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","e":"ₑ","o":"ₒ","x":"ₓ","h":"ₕ","k":"ₖ",
  "l":"ₗ","m":"ₘ","n":"ₙ","p":"ₚ","s":"ₛ","t":"ₜ","i":"ᵢ","j":"ⱼ","r":"ᵣ","u":"ᵤ","v":"ᵥ" };

const mapScript = (str, table) => {
  const chars = [...str];
  if (chars.every((c) => table[c] !== undefined)) return chars.map((c) => table[c]).join("");
  return null;
};

/** Consumes one `{...}` group (balanced) starting at i (which points at `{`). */
const readGroup = (s, i) => {
  if (s[i] !== "{") {
    // single token
    if (s[i] === "\\") {
      const mm = s.slice(i).match(/^\\[a-zA-Z]+/);
      return mm ? { body: mm[0], next: i + mm[0].length } : { body: s[i], next: i + 1 };
    }
    return { body: s[i] ?? "", next: i + 1 };
  }
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") { depth--; if (depth === 0) return { body: s.slice(i + 1, j), next: j + 1 }; }
  }
  return { body: s.slice(i + 1), next: s.length };
};

/**
 * @returns {{ text: string, plain: boolean }} — `plain:false` when the result
 * still contains LaTeX control sequences or unbalanced braces (caller should
 * fall back to a rendered block).
 */
function latexToText(input) {
  let s = normalizeLatex(String(input || ""));
  // spacing / sizing / styling commands that carry no glyph
  s = s.replace(/\\(left|right|big|Big|bigg|Bigg|mathrm|mathbf|mathit|mathsf|mathcal|boldsymbol|operatorname|displaystyle|textstyle|nolimits|limits)\b/g, "");
  s = s.replace(/\\(,|;|:|!|quad|qquad| \s|\s)/g, " ");
  s = s.replace(/\\\\/g, " ");            // row breaks → space (single-line context)
  s = s.replace(/[{}]\s*$/g, "").trim();

  let out = "";
  let i = 0;
  let guard = 0;
  while (i < s.length && guard++ < 5000) {
    const ch = s[i];

    if (ch === "\\") {
      const m = s.slice(i).match(/^\\([a-zA-Z]+)/);
      if (!m) {                            // escaped punctuation like \{ \} \% \&
        out += s[i + 1] ?? "";
        i += 2;
        continue;
      }
      const cmd = m[1];
      i += m[0].length;
      if (GREEK[cmd] !== undefined) { out += GREEK[cmd]; continue; }
      if (OPS[cmd] !== undefined) { out += (out && !/\s$/.test(out) ? " " : "") + OPS[cmd] + " "; continue; }
      if (FUNCS.includes(cmd)) {
        // no trailing space if a superscript follows (tan^{-1} → tan⁻¹)
        const supNext = s[i] === "^";
        out += (out && !/\s$/.test(out) ? " " : "") + cmd + (supNext ? "" : " ");
        continue;
      }
      if (cmd === "text" || cmd === "mbox") { const g = readGroup(s, i); out += g.body; i = g.next; continue; }
      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
        const a = readGroup(s, s[i] === " " ? i + 1 : i);
        const b = readGroup(s, s[a.next] === " " ? a.next + 1 : a.next);
        const ta = latexToText(a.body), tb = latexToText(b.body);
        const wrap = (t) => (/[\s+\-×·/=]/.test(t.text.trim()) ? `(${t.text.trim()})` : t.text.trim());
        out += `${wrap(ta)}/${wrap(tb)}`;
        i = b.next;
        if (!ta.plain || !tb.plain) return { text: out, plain: false };
        continue;
      }
      if (cmd === "sqrt") {
        // optional [n]
        let n = "";
        if (s[i] === "[") { const e = s.indexOf("]", i); n = s.slice(i + 1, e); i = e + 1; }
        const g = readGroup(s, i);
        const t = latexToText(g.body);
        out += (n ? `${n}√` : "√") + (/[\s+\-×·/=]/.test(t.text.trim()) ? `(${t.text.trim()})` : t.text.trim());
        i = g.next;
        if (!t.plain) return { text: out, plain: false };
        continue;
      }
      const COMBINING = { vec: "⃗", overrightarrow: "⃗", hat: "̂", widehat: "̂",
        bar: "̄", overline: "̄", dot: "̇", ddot: "̈", tilde: "̃", underline: "̲" };
      if (COMBINING[cmd] !== undefined) {
        const g = readGroup(s, i);
        const t = latexToText(g.body);
        const chars = [...t.text];
        // put the accent on the base symbol only, not on a following subscript
        out += chars.length ? chars[0] + COMBINING[cmd] + chars.slice(1).join("") : "";
        i = g.next;
        if (!t.plain) return { text: out, plain: false };
        continue;
      }
      // unknown command — bail to block rendering
      return { text: out.trim(), plain: false };
    }

    if (ch === "^" || ch === "_") {
      const table = ch === "^" ? SUP : SUB;
      const g = readGroup(s, i + 1);
      const inner = latexToText(g.body);
      const mapped = inner.plain ? mapScript(inner.text, table) : null;
      if (mapped !== null) out += mapped;
      else return { text: (out + (ch === "^" ? "^(" : "_(") + inner.text.trim() + ")").trim(), plain: false };
      i = g.next;
      continue;
    }

    if (ch === "{" || ch === "}") { i += 1; continue; }  // stray grouping
    if (ch === "&") { out += "  "; i += 1; continue; }
    if (ch === "~") { out += " "; i += 1; continue; }

    out += ch;
    i += 1;
  }

  out = out.replace(/\s{2,}/g, " ").replace(/\s+([)\].,;])/g, "$1").trim();
  return { text: out, plain: !/[\\{}]/.test(out) };
}

/**
 * Cleans up LaTeX pulled from stored question data before typesetting:
 *  • `\\theta` → `\theta`  — some bulk-uploaded rows double-escaped every
 *    command. A real `\\` line/row break is always followed by whitespace,
 *    a newline or `[`, never a letter, so the lookahead keeps those intact.
 */
function normalizeLatex(s) {
  return String(s || "").replace(/\\\\(?=[a-zA-Z])/g, "\\").trim();
}

/**
 * Splits stored question text into alternating text / math runs. Recognises
 * every delimiter that shows up in this bank's data:
 *   \( … \)   inline      \[ … \]   display
 *   $ … $     inline      $$ … $$   display
 * A lone unmatched `$` is left as literal text.
 */
function splitTextMath(text) {
  const src = String(text || "").replace(/\r\n/g, "\n");
  if (!src) return [];
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ type: "text", value: src.slice(last, m.index) });
    const display = m[1] !== undefined || m[2] !== undefined;
    const latex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    out.push({ type: "math", value: normalizeLatex(latex), display });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ type: "text", value: src.slice(last) });
  return out.length ? out : [{ type: "text", value: src }];
}

module.exports = { latexToSvg, latexToOmmlComponent, latexToText, splitTextMath };
