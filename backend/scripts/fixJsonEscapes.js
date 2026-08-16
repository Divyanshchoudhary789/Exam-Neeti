/**
 * fixJsonEscapes.js — fixes bad LaTeX escape sequences in Gemini-generated JSON files.
 *
 * Problem: Gemini writes  \(  and  \)  inside JSON strings.
 *          In JSON, backslash must be escaped as \\, so it should be  \\(  and  \\)
 *          Same applies to \[  \]  \frac  \text  \vec  \hat etc.
 *
 * Usage:
 *   node scripts/fixJsonEscapes.js --file seedData/questions/chemistry_xii_minor1.json
 *   (overwrites the file in-place, keeps a .bak backup)
 */
const fs   = require("fs");
const path = require("path");

const args    = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1]
             || args[args.indexOf("--file") + 1];

if (!fileArg) {
  console.error("--file required");
  process.exit(1);
}

const filePath = path.resolve(__dirname, "..", fileArg);
const raw = fs.readFileSync(filePath, "utf-8");

// Keep backup
fs.writeFileSync(filePath + ".bak", raw, "utf-8");
console.log(`[Fix] Backup saved: ${filePath}.bak`);

/**
 * Fix bad escape sequences in a JSON file.
 *
 * Strategy: we scan character by character ONLY inside JSON string values
 * (between unescaped quotes). When we find a single backslash followed by
 * a character that is NOT a valid JSON escape, we double the backslash.
 *
 * Valid JSON single-char escapes: " \ / b f n r t
 * Valid JSON unicode escape:      uXXXX
 * Everything else (like \(  \)  \f  \v  \l  etc.) needs to become \\
 */
function fixEscapes(text) {
  const VALID_AFTER_BACKSLASH = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  let result = "";
  let inString = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (!inString) {
      // Toggle string mode on unescaped double-quote
      if (ch === '"') inString = true;
      result += ch;
      i++;
    } else {
      if (ch === '\\') {
        const next = text[i + 1];
        if (next === undefined) {
          result += ch;
          i++;
        } else if (VALID_AFTER_BACKSLASH.has(next)) {
          // Valid escape — keep as-is
          // Special case: \uXXXX — keep all 6 chars
          if (next === 'u') {
            result += text.slice(i, i + 6);
            i += 6;
          } else {
            result += ch + next;
            i += 2;
            // If this was \" that closes the string, we need to NOT flip inString
            // because \" is escaped quote inside string, not end of string
            // (already handled correctly — \" keeps inString=true)
          }
        } else {
          // Bad escape — double the backslash
          result += '\\\\' + next;
          i += 2;
        }
      } else if (ch === '"') {
        // End of string
        inString = false;
        result += ch;
        i++;
      } else {
        result += ch;
        i++;
      }
    }
  }
  return result;
}

const fixed = fixEscapes(raw);

// Verify it parses now
let parsed;
try {
  parsed = JSON.parse(fixed);
} catch (e) {
  console.error("[Fix] ✖  Still invalid JSON after fix:", e.message);
  // Show context
  const pos = parseInt(e.message.match(/position (\d+)/)?.[1]);
  if (!isNaN(pos)) {
    console.log("\n--- Context ---");
    console.log(fixed.slice(Math.max(0, pos - 150), pos + 150));
  }
  process.exit(1);
}

fs.writeFileSync(filePath, fixed, "utf-8");
console.log(`[Fix] ✔  Fixed and saved: ${filePath}`);
console.log(`[Fix] ✔  Questions in file: ${parsed.length}`);
