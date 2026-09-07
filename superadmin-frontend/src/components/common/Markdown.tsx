"use client";

import React from "react";

/**
 * Tiny, dependency-free, XSS-safe markdown renderer for blog content authored
 * in the admin dashboard. Supports: #/##/### headings, **bold**, *italic*,
 * `code`, [links](url) (http/https/mailto only), - and 1. lists, > quotes,
 * --- rules, images ![alt](url), and paragraphs. All raw HTML in the source is
 * escaped, never rendered.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (u: string) => {
  const t = u.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(t) ? t : "#";
};

function inline(text: string): string {
  let t = esc(text);
  // images first, then links
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
    `<img src="${safeUrl(url)}" alt="${esc(alt)}" class="my-3 rounded-xl max-w-full" />`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) =>
    `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="underline" style="color:var(--md-accent)">${esc(label).replace(/&amp;/g, "&")}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 text-[0.9em]">$1</code>');
  return t;
}

const CALLOUT_META: Record<string, { label: string; cls: string }> = {
  note: { label: "Note", cls: "md-callout-note" },
  tip: { label: "Tip", cls: "md-callout-tip" },
  warning: { label: "Warning", cls: "md-callout-warning" },
};

function toHtml(md: string): string {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let para: string[] = [];
  let quote: string[] | null = null;
  let callout: { type: string; body: string[] } | null = null;

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
  };
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const flushQuote = () => {
    if (callout) {
      const meta = CALLOUT_META[callout.type] || CALLOUT_META.note;
      out.push(`<div class="md-callout ${meta.cls}"><p class="md-callout-title">${meta.label}</p><p>${inline(callout.body.join(" "))}</p></div>`);
      callout = null;
    } else if (quote) {
      out.push(`<blockquote class="border-l-4 pl-4 my-3 italic" style="border-color:var(--md-accent)">${inline(quote.join(" "))}</blockquote>`);
      quote = null;
    }
  };
  const flushBlocks = () => { flushPara(); flushQuote(); closeList(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushBlocks(); continue; }

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara(); closeList();
      const co = q[1].match(/^\[!(note|tip|warning)\]\s*(.*)$/i);
      if (co && !quote && !callout) {
        callout = { type: co[1].toLowerCase(), body: co[2] ? [co[2]] : [] };
      } else if (callout) {
        callout.body.push(q[1]);
      } else {
        (quote ||= []).push(q[1]);
      }
      continue;
    }
    flushQuote();

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const lvl = h[1].length + 1; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); closeList(); out.push('<hr class="my-6 border-slate-200" />'); continue; }

    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const want = ul ? "ul" : "ol";
      if (listType !== want) { closeList(); listType = want; out.push(`<${want} class="${want === "ul" ? "list-disc" : "list-decimal"} pl-6 my-3 space-y-1">`); }
      out.push(`<li>${inline((ul || ol)![1])}</li>`);
      continue;
    }

    closeList();
    para.push(line.trim());
  }
  flushBlocks();
  return out.join("\n");
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const html = React.useMemo(() => toHtml(source), [source]);
  return <div className={`md-body ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export type BlogFontKey = "sans" | "serif" | "mono" | "inter" | "poppins" | "lora";

/** The curated blog typefaces. `web:true` means the family is pulled from
 *  Google Fonts (see the <link> in each app's root layout). */
export const BLOG_FONTS: { key: BlogFontKey; label: string; stack: string; web?: boolean }[] = [
  { key: "sans",    label: "System",  stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { key: "inter",   label: "Inter",   stack: '"Inter", ui-sans-serif, system-ui, sans-serif', web: true },
  { key: "poppins", label: "Poppins", stack: '"Poppins", ui-sans-serif, system-ui, sans-serif', web: true },
  { key: "serif",   label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { key: "lora",    label: "Lora",    stack: '"Lora", Georgia, "Times New Roman", serif', web: true },
  { key: "mono",    label: "Mono",    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];

export const blogFontStack = (key?: string) =>
  BLOG_FONTS.find((f) => f.key === key)?.stack || BLOG_FONTS[0].stack;

export interface BlogStyleLike {
  fontFamily?: BlogFontKey | string;
  fontSizePx?: number;
  lineHeight?: number;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  align?: "left" | "center" | "justify";
}

/** Renders blog markdown with the author's per-article typography applied. */
export function StyledBlogBody({ content, style, className = "" }: { content: string; style?: BlogStyleLike | null; className?: string }) {
  const s = style || {};
  const cssVars = {
    "--md-font": blogFontStack(s.fontFamily),
    "--md-text": s.textColor || "#1f2937",
    "--md-heading": s.headingColor || "#111827",
    "--md-accent": s.accentColor || "#4338ca",
    "--md-size": `${s.fontSizePx || 16}px`,
    "--md-lh": String(s.lineHeight || 1.7),
    "--md-align": s.align || "left",
  } as React.CSSProperties;
  return (
    <div style={cssVars}>
      <Markdown source={content} className={className} />
    </div>
  );
}
