/**
 * mathParser.test.js — Local test runner (no test framework needed)
 * Run: node utils/mathParser.test.js
 */

const { processText, convertMathSegment, validateLatex, processAndValidateText } = require("./mathParser");

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✔  ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✖  ${label}`);
    console.error(`     → ${e.message}`);
    failed++;
  }
}

function eq(a, b) {
  if (a !== b) throw new Error(`\nExpected: ${b}\n     Got: ${a}`);
}

function contains(a, sub) {
  if (!a.includes(sub)) throw new Error(`\nExpected "${a}" to contain "${sub}"`);
}

function hasLatexTrue(result) {
  if (!result.hasLatex) throw new Error(`Expected hasLatex=true but got false. Text: ${result.text}`);
}

function hasLatexFalse(result) {
  if (result.hasLatex) throw new Error(`Expected hasLatex=false but got true. Text: ${result.text}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── convertMathSegment() ─────────────────────────────────────────\n");

test("frac(1,2) → \\frac{1}{2}", () => {
  eq(convertMathSegment("frac(1,2)"), "\\frac{1}{2}");
});

test("frac(1,2)mv^2 → \\frac{1}{2}mv^2", () => {
  eq(convertMathSegment("frac(1,2)mv^2"), "\\frac{1}{2}mv^2");
});

test("sqrt(x) → \\sqrt{x}", () => {
  eq(convertMathSegment("sqrt(x)"), "\\sqrt{x}");
});

test("sqrt(b^2 - 4ac) → \\sqrt{b^2 - 4ac}", () => {
  eq(convertMathSegment("sqrt(b^2 - 4ac)"), "\\sqrt{b^2 - 4ac}");
});

test("root(3, 8) → \\sqrt[3]{...}", () => {
  // Space after comma in args is trimmed in numerator, may be present in root
  const result = convertMathSegment("root(3, 8)");
  contains(result, "\\sqrt[3]{");
  const { valid, error } = validateLatex(result);
  if (!valid) throw new Error(`KaTeX rejected: ${error}`);
});

test("vec(F) → \\vec{F}", () => {
  eq(convertMathSegment("vec(F)"), "\\vec{F}");
});

test("hat(x) → \\hat{x}", () => {
  eq(convertMathSegment("hat(x)"), "\\hat{x}");
});

test("abs(x-a) → \\left|x-a\\right|", () => {
  eq(convertMathSegment("abs(x-a)"), "\\left|x-a\\right|");
});

test("x^(n+1) → x^{n+1}", () => {
  eq(convertMathSegment("x^(n+1)"), "x^{n+1}");
});

test("x_(i+1) → x_{i+1}", () => {
  eq(convertMathSegment("x_(i+1)"), "x_{i+1}");
});

test("alpha → \\alpha", () => {
  eq(convertMathSegment("alpha"), "\\alpha");
});

test("theta → \\theta", () => {
  eq(convertMathSegment("theta"), "\\theta");
});

test("Omega → \\Omega (uppercase Greek)", () => {
  eq(convertMathSegment("Omega"), "\\Omega");
});

test("sin → \\sin", () => {
  eq(convertMathSegment("sin"), "\\sin");
});

test("<= → \\leq", () => {
  contains(convertMathSegment("a <= b"), "\\leq");
});

test(">= → \\geq", () => {
  contains(convertMathSegment("a >= b"), "\\geq");
});

test("!= → \\neq", () => {
  contains(convertMathSegment("a != b"), "\\neq");
});

test("-> → \\to", () => {
  contains(convertMathSegment("x -> 0"), "\\to");
});

test("+- → \\pm", () => {
  contains(convertMathSegment("x +- dx"), "\\pm");
});

test("... → \\ldots", () => {
  contains(convertMathSegment("1, 2, 3..."), "\\ldots");
});

test("30 deg → 30^{\\circ}", () => {
  // Parser produces 30^{\circ} (with braces) which is valid KaTeX
  const result = convertMathSegment("30 deg");
  const hasCirc = result.includes("^{\\circ}") || result.includes("^\\circ");
  if (!hasCirc) throw new Error(`Expected degree symbol, got: ${result}`);
  const { valid, error } = validateLatex(result);
  if (!valid) throw new Error(`KaTeX rejected: ${error}`);
});

test("infinity → \\infty", () => {
  contains(convertMathSegment("x -> infinity"), "\\infty");
});

test("partial → \\partial", () => {
  contains(convertMathSegment("partial f"), "\\partial");
});

test("int → \\int (in pure math context)", () => {
  // convertMathSegment converts int→\int; processText wraps in $
  const seg = convertMathSegment("int_0^inf f(x) dx");
  contains(seg, "\\int");
  const { valid, error } = validateLatex(seg);
  if (!valid) throw new Error(`KaTeX rejected: ${error}`);
});

test("sum → \\sum (in pure math context)", () => {
  const seg = convertMathSegment("sum_(i=1)^n i");
  contains(seg, "\\sum");
  const { valid, error } = validateLatex(seg);
  if (!valid) throw new Error(`KaTeX rejected: ${error}`);
});

test("(a)/(b) fraction shorthand", () => {
  eq(convertMathSegment("(1)/(2)"), "\\frac{1}{2}");
});

test("nested frac: frac(frac(a,b),c)", () => {
  const result = convertMathSegment("frac(frac(a,b),c)");
  contains(result, "\\frac");
  // Validate it with KaTeX
  const { valid, error } = validateLatex(result);
  if (!valid) throw new Error(`KaTeX rejected: ${error}`);
});

test("existing \\LaTeX commands preserved", () => {
  const input = "\\frac{1}{2}mv^2";
  const result = convertMathSegment(input);
  contains(result, "\\frac{1}{2}");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── validateLatex() ──────────────────────────────────────────────\n");

test("valid LaTeX passes", () => {
  const r = validateLatex("\\frac{1}{2}mv^2");
  if (!r.valid) throw new Error(r.error);
});

test("invalid LaTeX fails gracefully", () => {
  const r = validateLatex("\\frac{1}");
  if (r.valid) throw new Error("Expected invalid but got valid");
});

test("empty string is valid", () => {
  const r = validateLatex("");
  if (!r.valid) throw new Error(r.error);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── processText() — Mode A: already has $ delimiters ─────────────\n");

test("$F = ma$ passes through with shorthand converted", () => {
  const r = processText("The force is $F = ma$");
  hasLatexTrue(r);
  contains(r.text, "$F = ma$");
});

test("$frac(1,2)mv^2$ converts shorthand inside $", () => {
  const r = processText("KE = $frac(1,2)mv^2$");
  hasLatexTrue(r);
  contains(r.text, "\\frac{1}{2}");
});

test("$$E = mc^2$$ display math preserved", () => {
  const r = processText("Einstein: $$E = mc^2$$");
  hasLatexTrue(r);
  contains(r.text, "$$E = mc^2$$");
});

test("Already correct LaTeX is preserved", () => {
  const r = processText("$\\frac{1}{2}mv^2$");
  hasLatexTrue(r);
  contains(r.text, "\\frac{1}{2}");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── processText() — Mode B: pure math expression ─────────────────\n");

test("Pure: frac(1,2)mv^2 → $\\frac{1}{2}mv^2$", () => {
  const r = processText("frac(1,2)mv^2");
  hasLatexTrue(r);
  contains(r.text, "\\frac{1}{2}");
  contains(r.text, "$");
});

test("Pure: sqrt(b^2 - 4ac) → $\\sqrt{...}$", () => {
  const r = processText("sqrt(b^2 - 4ac)");
  hasLatexTrue(r);
  contains(r.text, "\\sqrt{");
});

test("Pure: v^2 = u^2 + 2as", () => {
  const r = processText("v^2 = u^2 + 2as");
  hasLatexTrue(r);
  contains(r.text, "$");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── processText() — Mode C: natural sentence ─────────────────────\n");

test("Sentence with subscript: 'body moves with v_0 = 10 m/s'", () => {
  const r = processText("A body moves with v_0 = 10 m/s and acceleration a = 2 m/s^2");
  hasLatexTrue(r);
  contains(r.text, "$");
});

test("Sentence with greek: 'angle theta = 30 deg'", () => {
  const r = processText("If the angle theta = 30 deg, find sin theta.");
  hasLatexTrue(r);
  contains(r.text, "\\theta");
});

test("Sentence with named function: 'KE = frac(1,2)mv^2'", () => {
  const r = processText("The kinetic energy KE = frac(1,2)mv^2 where m is mass.");
  hasLatexTrue(r);
  contains(r.text, "\\frac");
});

test("Pure plain text has no LaTeX", () => {
  const r = processText("Which of the following is correct?");
  hasLatexFalse(r);
});

test("Plain text with acronym not converted", () => {
  const r = processText("NEET is a medical entrance exam.");
  hasLatexFalse(r);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── processAndValidateText() — end-to-end with KaTeX validation ──\n");

test("E = mc^2 converts and validates", () => {
  const r = processAndValidateText("E = mc^2");
  hasLatexTrue(r);
});

test("Complex NEET physics question", () => {
  const input = "A particle moves with v^2 = u^2 + 2as. If u = 0 and a = 10 m/s^2, find v after s = 5 m.";
  const r = processAndValidateText(input);
  hasLatexTrue(r);
});

test("Chemical formula style (H2O type)", () => {
  const input = "Water molecule H_2O has molar mass 18 g/mol";
  const r = processAndValidateText(input);
  hasLatexTrue(r);
});

test("Invalid manual LaTeX throws error", () => {
  try {
    processAndValidateText("$\\frac{1}$");  // incomplete frac
    throw new Error("Should have thrown");
  } catch(e) {
    if (e.message === "Should have thrown") throw e;
    // Expected to throw — pass
  }
});

test("Empty string handled gracefully", () => {
  const r = processAndValidateText("");
  hasLatexFalse(r);
  eq(r.text, "");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── NEET-specific formula tests ──────────────────────────────────\n");

test("Ohm's law: V = IR", () => {
  const r = processText("V = IR");
  hasLatexTrue(r);
});

test("Coulomb's law with epsilon", () => {
  // Use $ delimiters for complex multi-token formulas — Mode A
  const r = processText("$F = frac(1, 4 pi epsilon_0) frac(q_1 q_2, r^2)$");
  hasLatexTrue(r);
  contains(r.text, "\\frac");
  contains(r.text, "\\epsilon");
});

test("Ideal gas law: PV = nRT", () => {
  const r = processText("PV = nRT");
  hasLatexTrue(r);
});

test("De Broglie wavelength", () => {
  const r = processText("lambda = frac(h, mv)");
  hasLatexTrue(r);
  contains(r.text, "\\lambda");
  contains(r.text, "\\frac");
});

test("Integration: $int_0^pi sin(x) dx = 2$", () => {
  // Use $ mode for integral with limits — most accurate
  const r = processText("$int_0^pi sin(x) dx = 2$");
  hasLatexTrue(r);
  contains(r.text, "\\int");
  contains(r.text, "\\sin");
});

test("Quadratic formula", () => {
  const r = processText("x = frac(-b +- sqrt(b^2 - 4ac), 2a)");
  hasLatexTrue(r);
  contains(r.text, "\\frac");
  contains(r.text, "\\pm");
  contains(r.text, "\\sqrt");
});

test("Nernst equation style", () => {
  const r = processText("E = E^0 - frac(RT, nF) ln Q");
  hasLatexTrue(r);
  contains(r.text, "\\frac");
  contains(r.text, "\\ln");
});

test("Torque: tau = r x F (cross product)", () => {
  const r = processText("tau = r xx F");
  hasLatexTrue(r);
  contains(r.text, "\\tau");
  contains(r.text, "\\times");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────────");
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed ✔\n");
}
