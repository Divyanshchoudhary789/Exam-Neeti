"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

/**
 * Normalizes escaped backslashes, formats step-by-step lines, and renders mixed text + LaTeX formulas using KaTeX.
 * Handles \(\), \[\], $$, $, and un-delimited math expressions seamlessly.
 */
export function MathRenderer({ text, className = "", inline = false }: MathRendererProps) {
  const renderedElements = useMemo(() => {
    if (!text || typeof text !== "string") return null;

    // 1. Clean up double-escaped backslashes and escaped newlines
    let cleaned = text.replace(/\\\\/g, "\\").replace(/\\n/g, "\n");

    // 2. If single paragraph with concatenated step markers, auto-break into steps
    if (!cleaned.includes("\n") && !inline) {
      cleaned = cleaned
        .replace(/(\s+)(Step\s*\d+:?)/gi, "\n\n$2")
        .replace(/(\s+)(Now:?)/gi, "\n$2")
        .replace(/(\s+)(Force on [^:]+:?)/gi, "\n$2")
        .replace(/(\s+)(Both forces[^:]*:?)/gi, "\n$2")
        .replace(/(\s+)(Net force\s*[:=])/gi, "\n$2")
        .replace(/(\s+)(Therefore,?:?)/gi, "\n$2")
        .replace(/(\s+)(Hence,?:?)/gi, "\n$2")
        .replace(/(\s+)(Given:?)/gi, "\n$2")
        .replace(/(\s+)(Formula:?)/gi, "\n$2")
        .trim();
    }

    // 3. Check if string has no math delimiters but contains raw LaTeX math tokens
    const hasDelimiters = /\\\(|\\\[|\$|\$\$/.test(cleaned);
    const looksLikeLatex = /\\[a-zA-Z]+|\{|\}|\^|_/.test(cleaned);

    if (!hasDelimiters && looksLikeLatex) {
      cleaned = `\\(${cleaned}\\)`;
    }

    // 4. Regex pattern matching LaTeX math delimiters
    const pattern = /(\$\$.*?\$\$|\\\[.*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$.*?(?<!\\)\$)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(cleaned)) !== null) {
      // Text preceding match
      if (match.index > lastIndex) {
        const plainText = cleaned.slice(lastIndex, match.index);
        parts.push(<span key={`text-${lastIndex}`}>{plainText}</span>);
      }

      const rawFormula = match[0];
      let formula = rawFormula;
      let displayMode = false;

      if (formula.startsWith("$$") && formula.endsWith("$$")) {
        formula = formula.slice(2, -2);
        displayMode = true;
      } else if (formula.startsWith("\\[") && formula.endsWith("\\]")) {
        formula = formula.slice(2, -2);
        displayMode = true;
      } else if (formula.startsWith("\\(") && formula.endsWith("\\)")) {
        formula = formula.slice(2, -2);
        displayMode = false;
      } else if (formula.startsWith("$") && formula.endsWith("$")) {
        formula = formula.slice(1, -1);
        displayMode = false;
      }

      try {
        const html = katex.renderToString(formula.trim(), {
          displayMode: displayMode && !inline,
          throwOnError: false,
        });

        parts.push(
          <span
            key={`math-${match.index}`}
            className={displayMode && !inline ? "my-2 block text-center" : "inline-block px-0.5 align-middle"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch (err) {
        console.warn("KaTeX render error:", err);
        parts.push(<code key={`err-${match.index}`} className="text-red-500 font-mono text-xs">{rawFormula}</code>);
      }

      lastIndex = pattern.lastIndex;
    }

    // Trailing plain text
    if (lastIndex < cleaned.length) {
      parts.push(<span key={`text-${lastIndex}`}>{cleaned.slice(lastIndex)}</span>);
    }

    return parts;
  }, [text, inline]);

  if (!renderedElements) return null;

  return (
    <span className={`math-renderer-container whitespace-pre-wrap ${className}`}>
      {renderedElements}
    </span>
  );
}

export default MathRenderer;
