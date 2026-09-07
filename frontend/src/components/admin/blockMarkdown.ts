// Round-trips the block model of <BlogBlockEditor> to/from the exact Markdown
// subset that components/common/Markdown.tsx renders. The block editor is a
// pure front-end convenience — Blog.content stays Markdown, so the public
// /resources/[slug] page and StyledBlogBody never change.

export type CalloutVariant = "note" | "tip" | "warning";

export type Block =
  | { id: string; type: "heading"; level: 2 | 3 | 4; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "bulletList"; items: string[] }
  | { id: string; type: "numberList"; items: string[] }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "callout"; variant: CalloutVariant; text: string }
  | { id: string; type: "divider" };

let seq = 0;
export const uid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyBlock(type: Block["type"]): Block {
  switch (type) {
    case "heading": return { id: uid(), type: "heading", level: 2, text: "" };
    case "bulletList": return { id: uid(), type: "bulletList", items: [""] };
    case "numberList": return { id: uid(), type: "numberList", items: [""] };
    case "image": return { id: uid(), type: "image", url: "", alt: "" };
    case "quote": return { id: uid(), type: "quote", text: "" };
    case "callout": return { id: uid(), type: "callout", variant: "note", text: "" };
    case "divider": return { id: uid(), type: "divider" };
    default: return { id: uid(), type: "paragraph", text: "" };
  }
}

// ── blocks → markdown ──────────────────────────────────────────────────────
export function blocksToMarkdown(blocks: Block[]): string {
  const chunks = blocks.map((b) => {
    switch (b.type) {
      case "heading":
        return `${"#".repeat(b.level - 1)} ${b.text.trim()}`;
      case "paragraph":
        return b.text.trim();
      case "bulletList":
        return b.items.map((i) => `- ${i.trim()}`).filter((l) => l !== "- ").join("\n");
      case "numberList":
        return b.items.map((i, n) => `${n + 1}. ${i.trim()}`).filter((l) => !/^\d+\. $/.test(l)).join("\n");
      case "image":
        return b.url.trim() ? `![${b.alt.trim()}](${b.url.trim()})` : "";
      case "quote":
        return b.text.trim().split(/\n/).map((l) => `> ${l}`).join("\n");
      case "callout":
        return [`> [!${b.variant}]`, ...b.text.trim().split(/\n/).map((l) => `> ${l}`)].join("\n");
      case "divider":
        return "---";
      default:
        return "";
    }
  });
  return chunks.filter((c) => c.trim() !== "").join("\n\n") + "\n";
}

// ── markdown → blocks ──────────────────────────────────────────────────────
export function markdownToBlocks(md: string): Block[] {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "bulletList" | "numberList"; items: string[] } | null = null;
  let quote: string[] | null = null;
  let callout: { variant: CalloutVariant; body: string[] } | null = null;

  const flushPara = () => { if (para.length) { blocks.push({ id: uid(), type: "paragraph", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ id: uid(), type: list.kind, items: list.items } as Block); list = null; } };
  const flushQuote = () => {
    if (callout) { blocks.push({ id: uid(), type: "callout", variant: callout.variant, text: callout.body.join("\n") }); callout = null; }
    else if (quote) { blocks.push({ id: uid(), type: "quote", text: quote.join("\n") }); quote = null; }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushAll(); continue; }

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara(); flushList();
      const co = q[1].match(/^\[!(note|tip|warning)\]\s*(.*)$/i);
      if (co && !quote && !callout) callout = { variant: co[1].toLowerCase() as CalloutVariant, body: co[2] ? [co[2]] : [] };
      else if (callout) callout.body.push(q[1]);
      else (quote ||= []).push(q[1]);
      continue;
    }
    flushQuote();

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushPara(); flushList(); blocks.push({ id: uid(), type: "heading", level: (h[1].length + 1) as 2 | 3 | 4, text: h[2] }); continue; }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); flushList(); blocks.push({ id: uid(), type: "divider" }); continue; }

    const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) { flushPara(); flushList(); blocks.push({ id: uid(), type: "image", alt: img[1], url: img[2] }); continue; }

    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "bulletList" : "numberList";
      if (!list || list.kind !== kind) { flushList(); list = { kind, items: [] }; }
      list.items.push((ul || ol)![1]);
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushAll();
  return blocks.length ? blocks : [{ id: uid(), type: "paragraph", text: "" }];
}
