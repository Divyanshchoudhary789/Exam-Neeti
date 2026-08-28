/**
 * ommlToLatex.js
 *
 * Converts Word's NATIVE math markup — OMML, `<m:oMath>...</m:oMath>` — into
 * KaTeX-compatible LaTeX.
 *
 * This is a DIFFERENT equation source than the legacy MathType OLE objects
 * questionDocxParser.js also handles: OMML is structured XML (fraction,
 * radical, superscript, accent... as real elements), not a picture. That
 * means it converts deterministically, with NO OCR / no AI call and NO
 * accuracy ceiling — discovered mid-implementation by testing the rich
 * parser against the real reference document, whose SOLUTION equations turn
 * out to be authored as native OMML while the QUESTION/OPTION equations are
 * legacy MathType OLE objects. Both are real, both need handling.
 *
 * Coverage is scoped to what actually appears in school-level
 * physics/chemistry/biology exam content: fractions, radicals, super/sub
 * script, accents (vector arrow, hat, bar, dot), n-ary operators (sum,
 * integral, product), delimiters, named functions, overline/underline, and
 * plain text runs (with a Unicode→LaTeX symbol table for the Greek letters
 * and operators Word stores as literal Unicode characters). Anything
 * genuinely unrecognised degrades to "concatenate the children's text"
 * rather than throwing — the result then goes through the same KaTeX
 * validation as everything else, and a validation failure flags that one
 * equation for manual review (see conversionReview on Question.model.js)
 * instead of silently producing wrong content.
 */

"use strict";

// ─── Minimal nested-XML child splitter (OMML-scoped, not a general parser) ──

/**
 * Splits `xml` into its immediate child elements, respecting nesting depth
 * so e.g. an <m:e> inside an <m:acc> inside another <m:e> is attributed to
 * the right parent. Ignores everything that isn't a tag (text nodes aren't
 * expected directly under OMML container elements — leaf text always lives
 * inside <m:t>).
 * @returns {Array<{ tag: string, inner: string }>}
 */
function splitTopLevelElements(xml) {
  const tagRe = /<(\/?)([\w.]+:[\w.]+)([^>]*?)(\/?)>/g;
  const children = [];
  const stack = [];
  let currentStart = null;
  let currentTag = null;
  let m;

  while ((m = tagRe.exec(xml)) !== null) {
    const [full, closing, tagName, , selfClose] = m;

    if (stack.length === 0 && !closing && currentStart === null) {
      currentStart = m.index;
      currentTag = tagName;
    }

    if (selfClose) {
      if (stack.length === 0 && currentTag === tagName) {
        children.push({ tag: tagName, inner: "" });
        currentStart = null;
        currentTag = null;
      }
      continue;
    }

    if (!closing) {
      stack.push(tagName);
    } else {
      const idx = stack.lastIndexOf(tagName);
      if (idx !== -1) stack.length = idx;
      if (stack.length === 0 && tagName === currentTag) {
        const end = m.index + full.length;
        const whole = xml.slice(currentStart, end);
        const innerStart = whole.indexOf(">") + 1;
        const innerEnd = whole.lastIndexOf(`</${tagName}`);
        children.push({ tag: tagName, inner: whole.slice(innerStart, innerEnd) });
        currentStart = null;
        currentTag = null;
      }
    }
  }
  return children;
}

/** First child matching `tag`, or null. */
function child(children, tag) {
  return children.find((c) => c.tag === tag) || null;
}

// ─── Unicode → LaTeX symbol table (Word stores these as literal characters
//     inside <m:t>, not as LaTeX commands) ──────────────────────────────────

const SYMBOL_MAP = {
  "×": "\\times", "÷": "\\div", "±": "\\pm", "∓": "\\mp", "·": "\\cdot",
  "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "≈": "\\approx", "≡": "\\equiv",
  "→": "\\to", "←": "\\leftarrow", "↔": "\\leftrightarrow",
  "⇒": "\\Rightarrow", "⇐": "\\Leftarrow", "⇔": "\\Leftrightarrow",
  "∞": "\\infty", "∂": "\\partial", "∇": "\\nabla", "∴": "\\therefore", "∵": "\\because",
  "√": "\\sqrt", "°": "^{\\circ}", "∠": "\\angle", "⊥": "\\perp", "∥": "\\parallel",
  "∈": "\\in", "∉": "\\notin", "⊂": "\\subset", "∪": "\\cup", "∩": "\\cap",
  "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\epsilon",
  "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta", "ι": "\\iota", "κ": "\\kappa",
  "λ": "\\lambda", "μ": "\\mu", "ν": "\\nu", "ξ": "\\xi", "π": "\\pi",
  "ρ": "\\rho", "σ": "\\sigma", "τ": "\\tau", "υ": "\\upsilon", "φ": "\\phi",
  "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega",
  "Γ": "\\Gamma", "Δ": "\\Delta", "∆": "\\Delta", "Θ": "\\Theta", "Λ": "\\Lambda", "Ξ": "\\Xi",
  "Π": "\\Pi", "Σ": "\\Sigma", "Φ": "\\Phi", "Ψ": "\\Psi", "Ω": "\\Omega",
};

// LaTeX-reserved characters that must be escaped when they appear as literal
// text (not already one of the symbols above).
const LATEX_ESCAPE_MAP = { "%": "\\%", "#": "\\#", "&": "\\&", "_": "\\_", "{": "\\{", "}": "\\}" };

// Some authors type "cos90" etc as plain text runs instead of using OMML's
// <m:func> wrapper — still valid KaTeX either way, but backslash the known
// function names so they render upright ("cos") instead of as multiplied
// italic variables ("c·o·s"). Safe to do here (unlike in the Gemini path)
// because this text is guaranteed not to be LaTeX-escaped yet at this point.
const BARE_FUNC_RE = /\b(sin|cos|tan|cot|sec|csc|log|ln|lim|exp)\b/g;

function textToLatex(text) {
  const withFuncs = text.replace(BARE_FUNC_RE, "\\$1");
  let out = "";
  for (const ch of withFuncs) {
    if (SYMBOL_MAP[ch]) out += SYMBOL_MAP[ch] + " ";
    else if (LATEX_ESCAPE_MAP[ch]) out += LATEX_ESCAPE_MAP[ch];
    else out += ch;
  }
  return out;
}

// Accent characters used in <m:accPr><m:chr m:val="..."/> — combining marks
// and standalone chars Word uses for vector/hat/bar/dot notation.
const ACCENT_COMMANDS = {
  "⃗": "vec",   // combining right arrow above
  "̂": "hat",   // combining circumflex
  "^": "hat",
  "̄": "bar",   // combining macron
  "¯": "bar",
  "-": "bar",
  "̇": "dot",   // combining dot above
  ".": "dot",
  "̃": "tilde", // combining tilde
  "~": "tilde",
};

function attrVal(innerXml, tagLocal, attrLocal) {
  const re = new RegExp(`<[\\w.]*:?${tagLocal}[^>]*\\b${attrLocal}="([^"]*)"`);
  const m = re.exec(innerXml);
  return m ? m[1] : null;
}

// ─── Core recursive converter ────────────────────────────────────────────────

function convertChildren(children) {
  return children.map(convertNode).join("");
}

function convertNode({ tag, inner }) {
  const local = tag.split(":").pop();
  const kids = splitTopLevelElements(inner);

  switch (local) {
    case "oMathPara":
    case "oMath":
      return convertChildren(kids);

    case "r": {
      // A run: skip <w:rPr>/<m:rPr> formatting, take <m:t> text.
      const t = child(kids, "m:t");
      return t ? textToLatex(t.inner) : "";
    }

    case "t":
      return textToLatex(inner);

    case "f": {
      const num = child(kids, "m:num");
      const den = child(kids, "m:den");
      return `\\frac{${num ? convertChildren(splitTopLevelElements(num.inner)) : ""}}{${den ? convertChildren(splitTopLevelElements(den.inner)) : ""}}`;
    }

    case "rad": {
      const deg = child(kids, "m:deg");
      const e   = child(kids, "m:e");
      const eLatex = e ? convertChildren(splitTopLevelElements(e.inner)) : "";
      const degInner = deg ? deg.inner.trim() : "";
      // A hidden/empty degree means plain square root.
      if (!degInner || /<m:degHide/.test(inner)) return `\\sqrt{${eLatex}}`;
      return `\\sqrt[${convertChildren(splitTopLevelElements(degInner))}]{${eLatex}}`;
    }

    case "sSup": {
      const e = child(kids, "m:e"), sup = child(kids, "m:sup");
      return `{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}^{${sup ? convertChildren(splitTopLevelElements(sup.inner)) : ""}}`;
    }

    case "sSub": {
      const e = child(kids, "m:e"), sub = child(kids, "m:sub");
      return `{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}_{${sub ? convertChildren(splitTopLevelElements(sub.inner)) : ""}}`;
    }

    case "sSubSup": {
      const e = child(kids, "m:e"), sub = child(kids, "m:sub"), sup = child(kids, "m:sup");
      return `{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}_{${sub ? convertChildren(splitTopLevelElements(sub.inner)) : ""}}^{${sup ? convertChildren(splitTopLevelElements(sup.inner)) : ""}}`;
    }

    case "acc": {
      const accPr = child(kids, "m:accPr");
      const e = child(kids, "m:e");
      const chr = accPr ? attrVal(accPr.inner, "chr", "m:val") : null;
      const cmd = (chr && ACCENT_COMMANDS[chr]) || "vec"; // vector arrow is by far the common case here
      return `\\${cmd}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }

    case "bar": {
      const barPr = child(kids, "m:barPr");
      const pos = barPr ? attrVal(barPr.inner, "pos", "m:val") : "top";
      const e = child(kids, "m:e");
      const cmd = pos === "bot" ? "underline" : "overline";
      return `\\${cmd}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }

    case "d": {
      const dPr = child(kids, "m:dPr");
      const beg = dPr ? attrVal(dPr.inner, "begChr", "m:val") : null;
      const end = dPr ? attrVal(dPr.inner, "endChr", "m:val") : null;
      const es = kids.filter((k) => k.tag === "m:e");
      const inside = es.map((e) => convertChildren(splitTopLevelElements(e.inner))).join(", ");
      const openCmd  = beg === "|" ? "\\left|" : beg === "[" ? "\\left[" : beg === "{" ? "\\left\\{" : beg === "" ? "" : "\\left(";
      const closeCmd = end === "|" ? "\\right|" : end === "]" ? "\\right]" : end === "}" ? "\\right\\}" : end === "" ? "" : "\\right)";
      return `${openCmd}${inside}${closeCmd}`;
    }

    case "nary": {
      const naryPr = child(kids, "m:naryPr");
      const chr = naryPr ? attrVal(naryPr.inner, "chr", "m:val") : "∑";
      const cmd = chr === "∫" ? "\\int" : chr === "∏" ? "\\prod" : chr === "∮" ? "\\oint" : "\\sum";
      const sub = child(kids, "m:sub"), sup = child(kids, "m:sup"), e = child(kids, "m:e");
      const subL = sub ? `_{${convertChildren(splitTopLevelElements(sub.inner))}}` : "";
      const supL = sup ? `^{${convertChildren(splitTopLevelElements(sup.inner))}}` : "";
      return `${cmd}${subL}${supL}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }

    case "func": {
      const fName = child(kids, "m:fName");
      const e = child(kids, "m:e");
      const name = fName ? convertChildren(splitTopLevelElements(fName.inner)).trim() : "";
      const KNOWN = ["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lim", "exp"];
      const nameLatex = KNOWN.includes(name) ? `\\${name}` : name;
      return `${nameLatex}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }

    case "limLow": {
      const e = child(kids, "m:e"), lim = child(kids, "m:lim");
      return `\\underset{${lim ? convertChildren(splitTopLevelElements(lim.inner)) : ""}}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }
    case "limUpp": {
      const e = child(kids, "m:e"), lim = child(kids, "m:lim");
      return `\\overset{${lim ? convertChildren(splitTopLevelElements(lim.inner)) : ""}}{${e ? convertChildren(splitTopLevelElements(e.inner)) : ""}}`;
    }

    case "eqArr": {
      const es = kids.filter((k) => k.tag === "m:e");
      return es.map((e) => convertChildren(splitTopLevelElements(e.inner))).join(" \\\\ ");
    }

    case "m": {
      // Matrix: sequence of <m:mr> rows, each a sequence of <m:e> cells.
      const rows = kids.filter((k) => k.tag === "m:mr");
      const body = rows
        .map((row) => splitTopLevelElements(row.inner)
          .filter((c) => c.tag === "m:e")
          .map((c) => convertChildren(splitTopLevelElements(c.inner)))
          .join(" & "))
        .join(" \\\\ ");
      return `\\begin{matrix}${body}\\end{matrix}`;
    }

    // Property/container elements that carry no math content of their own —
    // recurse into whatever's left (keeps unknown-but-nested content from
    // being silently dropped).
    case "e":
    case "num":
    case "den":
    case "sub":
    case "sup":
    case "deg":
    case "lim":
    default:
      return convertChildren(kids);
  }
}

/**
 * @param {string} oMathXml  The full `<m:oMath>...</m:oMath>` (or
 *                           `<m:oMathPara>...</m:oMathPara>`) fragment.
 * @returns {string} LaTeX (without surrounding $ delimiters).
 */
function convertOmmlToLatex(oMathXml) {
  const nodes = splitTopLevelElements(oMathXml);
  return convertChildren(nodes).replace(/\s+/g, " ").trim();
}

module.exports = { convertOmmlToLatex };
