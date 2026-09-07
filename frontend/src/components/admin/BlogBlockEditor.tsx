"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "../common/UIComponents";
import { promptDialog } from "../common/feedback";
import {
  type Block, type CalloutVariant,
  blocksToMarkdown, markdownToBlocks, emptyBlock, uid,
} from "./blockMarkdown";

/* ── tiny local glyphs (the shared icon set has no image/quote/list icons) ── */
const Svg = (d: string, extra = "") => ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{extra ? <path d={extra} /> : null}
  </svg>
);
const Ico = {
  plus: Svg("M12 5v14M5 12h14"),
  trash: Svg("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"),
  copy: Svg("M9 9h11v11H9zM5 15H4V4h11v1"),
  up: Svg("M18 15l-6-6-6 6"),
  down: Svg("M6 9l6 6 6-6"),
  grip: Svg("M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"),
  heading: Svg("M6 4v16M18 4v16M6 12h12"),
  paragraph: Svg("M13 4v16M17 4v16M8 9a4 4 0 0 1 0-8h9"),
  bullet: Svg("M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"),
  number: Svg("M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2"),
  image: Svg("M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6"),
  quote: Svg("M7 7h4v4a4 4 0 0 1-4 4M15 7h4v4a4 4 0 0 1-4 4"),
  callout: Svg("M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"),
  divider: Svg("M4 12h16"),
};

const BLOCK_META: Record<Block["type"], { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  paragraph:  { label: "Paragraph",     Icon: Ico.paragraph },
  heading:    { label: "Heading",       Icon: Ico.heading },
  bulletList: { label: "Bullet list",   Icon: Ico.bullet },
  numberList: { label: "Numbered list", Icon: Ico.number },
  image:      { label: "Image",         Icon: Ico.image },
  quote:      { label: "Quote",         Icon: Ico.quote },
  callout:    { label: "Callout",       Icon: Ico.callout },
  divider:    { label: "Divider",       Icon: Ico.divider },
};
const ADD_ORDER: Block["type"][] = ["paragraph", "heading", "bulletList", "numberList", "image", "quote", "callout", "divider"];

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  disabled?: boolean;
}

const fieldCls =
  "w-full bg-white border border-slate-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 transition-all font-medium resize-y placeholder:text-slate-400";

export function BlogBlockEditor({ value, onChange, onUploadImage, disabled }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => markdownToBlocks(value));
  const lastEmitted = useRef(value);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Re-seed only when the parent's markdown changes externally (async body load).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setBlocks(markdownToBlocks(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const commit = useCallback((next: Block[]) => {
    setBlocks(next);
    const md = blocksToMarkdown(next);
    lastEmitted.current = md;
    onChange(md);
  }, [onChange]);

  const patch = (id: string, fields: Partial<Block>) =>
    commit(blocks.map((b) => (b.id === id ? ({ ...b, ...fields } as Block) : b)));
  const removeBlock = (id: string) => commit(blocks.filter((b) => b.id !== id));
  const duplicate = (idx: number) => {
    const copy = { ...blocks[idx], id: uid() } as Block;
    commit([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)]);
    setFocusId(copy.id);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = blocks.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    commit(next);
  };
  const insertAt = (idx: number, type: Block["type"]) => {
    const nb = emptyBlock(type);
    commit([...blocks.slice(0, idx), nb, ...blocks.slice(idx)]);
    setMenuAt(null);
    setFocusId(nb.id);
  };

  // Focus the freshly-added/duplicated block's first field.
  useEffect(() => {
    if (!focusId) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-block="${focusId}"] textarea, [data-block="${focusId}"] input:not([type=file])`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setFocusId(null);
  }, [blocks, focusId]);

  const onDrop = (target: number) => {
    if (dragIdx === null) return;
    let to = target;
    if (dragIdx < target) to = target - 1;
    move(dragIdx, to);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div ref={rootRef} className={`space-y-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      {blocks.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center space-y-3">
          <p className="text-xs font-bold text-slate-500">Start your article</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {(["heading", "paragraph"] as Block["type"][]).map((t) => {
              const { label, Icon } = BLOCK_META[t];
              return (
                <button key={t} type="button" onClick={() => insertAt(0, t)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer transition-colors">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {blocks.map((b, i) => (
        <React.Fragment key={b.id}>
          <InsertRow isOpen={menuAt === i} onOpen={() => setMenuAt(i)} onClose={() => setMenuAt(null)} onPick={(t) => insertAt(i, t)} />
          {overIdx === i && dragIdx !== null && <div className="h-0.5 bg-indigo-500 rounded-full mx-2" />}
          <BlockCard
            block={b}
            index={i}
            total={blocks.length}
            onPatch={(f) => patch(b.id, f)}
            onRemove={() => removeBlock(b.id)}
            onDuplicate={() => duplicate(i)}
            onMove={(dir) => move(i, i + dir)}
            onUploadImage={onUploadImage}
            isDragging={dragIdx === i}
            onDragStart={() => setDragIdx(i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onDragOver={() => setOverIdx(i)}
            onDrop={() => onDrop(i)}
          />
        </React.Fragment>
      ))}
      {overIdx === blocks.length && dragIdx !== null && <div className="h-0.5 bg-indigo-500 rounded-full mx-2" />}

      <InsertRow
        isOpen={menuAt === blocks.length}
        onOpen={() => setMenuAt(blocks.length)}
        onClose={() => setMenuAt(null)}
        onPick={(t) => insertAt(blocks.length, t)}
        alwaysShow
        onDragOver={() => setOverIdx(blocks.length)}
        onDrop={() => onDrop(blocks.length)}
      />
    </div>
  );
}

/* ── portal-rendered block-type menu — escapes the modal's overflow clip ──── */
function AddBlockMenu({ anchor, onPick, onClose }: {
  anchor: DOMRect;
  onPick: (type: Block["type"]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    // Capture phase + stopPropagation so Escape closes only the menu, never the
    // surrounding CommonModal (which has its own bubble-phase Escape handler).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey, true);
    // Any scroll (the modal body, the window) invalidates our anchor — just close.
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const W = 260;
  const estH = 260;
  const openUp = window.innerHeight - anchor.bottom < estH && anchor.top > estH;
  const top = openUp ? anchor.top - 6 : anchor.bottom + 6;
  const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - W / 2), window.innerWidth - W - 8);

  return createPortal(
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div
        className="fixed grid grid-cols-2 gap-1 p-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl"
        style={{ width: W, left, top, transform: openUp ? "translateY(-100%)" : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {ADD_ORDER.map((t) => {
          const { label, Icon } = BLOCK_META[t];
          return (
            <button key={t} type="button" onClick={() => { onPick(t); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-left">
              <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

/* ── the "+ insert block here" affordance between/after blocks ─────────────── */
function InsertRow({
  isOpen, onOpen, onClose, onPick, alwaysShow, onDragOver, onDrop,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (type: Block["type"]) => void;
  alwaysShow?: boolean;
  onDragOver?: () => void;
  onDrop?: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => (isOpen ? onClose() : onOpen());
  return (
    <div
      className={`group relative flex items-center justify-center ${alwaysShow ? "py-1.5" : "h-1.5 hover:h-8"} transition-[height] duration-150`}
      onDragOver={onDragOver ? (e) => { e.preventDefault(); onDragOver(); } : undefined}
      onDrop={onDrop ? (e) => { e.preventDefault(); onDrop(); } : undefined}
    >
      {alwaysShow ? (
        <button ref={btnRef} type="button" onClick={toggle}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer bg-white ${isOpen ? "border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"}`}>
          <Ico.plus className="w-3.5 h-3.5" /> Add block
        </button>
      ) : (
        <button ref={btnRef} type="button" onClick={toggle}
          className={`transition-opacity inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border cursor-pointer shadow-sm ${isOpen ? "opacity-100 border-indigo-400 text-indigo-600" : "opacity-0 group-hover:opacity-100 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600"}`}
          title="Insert block here">
          <Ico.plus className="w-3 h-3" />
        </button>
      )}
      {isOpen && btnRef.current && (
        <AddBlockMenu anchor={btnRef.current.getBoundingClientRect()} onPick={onPick} onClose={onClose} />
      )}
    </div>
  );
}

/* ── one block card ──────────────────────────────────────────────────────── */
function BlockCard({
  block, index, total, onPatch, onRemove, onDuplicate, onMove, onUploadImage,
  isDragging, onDragStart, onDragEnd, onDragOver, onDrop,
}: {
  block: Block;
  index: number;
  total: number;
  onPatch: (fields: Partial<Block>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onUploadImage: (file: File) => Promise<string>;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const { label, Icon } = BLOCK_META[block.type];
  const [grabbable, setGrabbable] = useState(false);
  return (
    <div
      data-block={block.id}
      draggable={grabbable}
      onDragStart={onDragStart}
      onDragEnd={() => { setGrabbable(false); onDragEnd(); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={`rounded-xl border bg-slate-50/70 transition-shadow ${isDragging ? "opacity-40 border-indigo-300" : "border-slate-200"} focus-within:border-indigo-300 focus-within:shadow-sm focus-within:bg-white`}
    >
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            onMouseDown={() => setGrabbable(true)}
            onMouseUp={() => setGrabbable(false)}
            title="Drag to reorder"
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
          >
            <Ico.grip className="w-3.5 h-3.5" />
          </span>
          <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move up"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            <Ico.up className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Move down"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            <Ico.down className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate block"
            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer">
            <Ico.copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} title="Delete block"
            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
            <Ico.trash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-2.5 pb-2.5">
        <BlockBody block={block} patch={onPatch} onUploadImage={onUploadImage} />
      </div>
    </div>
  );
}

function BlockBody({
  block, patch, onUploadImage,
}: {
  block: Block;
  patch: (fields: Partial<Block>) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <select value={block.level} onChange={(e) => patch({ level: Number(e.target.value) as 2 | 3 | 4 })}
            className="bg-white border border-slate-200 rounded-lg text-xs px-2 py-2 font-bold text-slate-700 cursor-pointer">
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </select>
          <input value={block.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Heading text"
            className={`${fieldCls} font-bold`} />
        </div>
      );
    case "paragraph":
      return <RichText value={block.text} onChange={(t) => patch({ text: t })} rows={3} placeholder="Write a paragraph… select text to make it bold, italic, or a link." />;
    case "quote":
      return <RichText value={block.text} onChange={(t) => patch({ text: t })} rows={2} placeholder="Quote text" />;
    case "callout":
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {(["note", "tip", "warning"] as CalloutVariant[]).map((v) => (
              <button key={v} type="button" onClick={() => patch({ variant: v })}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all ${
                  block.variant === v
                    ? v === "warning" ? "bg-amber-500 text-white" : v === "tip" ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-300"
                }`}>
                {v}
              </button>
            ))}
          </div>
          <RichText value={block.text} onChange={(t) => patch({ text: t })} rows={2} placeholder="Callout body" />
        </div>
      );
    case "bulletList":
    case "numberList":
      return (
        <div>
          <textarea
            rows={Math.max(3, block.items.length)}
            value={block.items.join("\n")}
            onChange={(e) => patch({ items: e.target.value.split("\n") })}
            placeholder={"One item per line"}
            className={fieldCls}
          />
          <p className="text-[10px] font-semibold text-slate-400 mt-1">One list item per line.</p>
        </div>
      );
    case "image":
      return <ImageBlock block={block} patch={patch} onUploadImage={onUploadImage} />;
    case "divider":
      return <div className="flex items-center gap-2 py-1"><div className="h-px flex-1 bg-slate-300" /><span className="text-[9px] font-black uppercase text-slate-300">section break</span><div className="h-px flex-1 bg-slate-300" /></div>;
    default:
      return null;
  }
}

function ImageBlock({
  block, patch, onUploadImage,
}: {
  block: Extract<Block, { type: "image" }>;
  patch: (fields: Partial<Block>) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("That file is not an image"); return; }
    setErr("");
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) patch({ url });
      else setErr("Upload returned no URL");
    } catch (e: unknown) {
      setErr((e as { message?: string }).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onUploadImage, patch]);

  return (
    <div className="space-y-1.5">
      {block.url ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.alt} className="max-h-44 rounded-lg border border-slate-200 object-contain" />
          <button type="button" onClick={() => patch({ url: "" })}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 flex items-center justify-center shadow-sm cursor-pointer">
            <Ico.trash className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
          onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) upload(f); }}
          className={`flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? "border-indigo-400 bg-indigo-50/60" : "border-slate-300 bg-white hover:border-indigo-300"
          }`}>
          {uploading ? <Spinner className="w-5 h-5 text-indigo-600" /> : <Ico.image className="w-6 h-6 text-slate-400" />}
          <span className="text-[11px] font-bold text-slate-500">{uploading ? "Uploading…" : "Drop, paste or click to upload"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      )}
      <input value={block.url} onChange={(e) => patch({ url: e.target.value })} placeholder="…or paste an image URL" className={fieldCls} />
      <input value={block.alt} onChange={(e) => patch({ alt: e.target.value })} placeholder="Alt text (for accessibility & SEO)" className={fieldCls} />
      {err && <p className="text-[10px] font-bold text-red-600">{err}</p>}
    </div>
  );
}

function RichText({
  value, onChange, rows = 3, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (pre: string, post: string, ph: string) => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || ph;
    const next = value.slice(0, s) + pre + sel + post + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = s + pre.length;
      el.selectionEnd = s + pre.length + sel.length;
    });
  };

  const link = async () => {
    const url = await promptDialog({
      title: "Insert link",
      placeholder: "https://…  or  mailto:name@example.com",
      confirmText: "Insert link",
      requireValue: true,
    });
    if (!url) return;
    wrap("[", `](${url.trim()})`, "link text");
  };

  const onKey = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key.toLowerCase() === "b") { e.preventDefault(); wrap("**", "**", "bold text"); }
    if (e.key.toLowerCase() === "i") { e.preventDefault(); wrap("*", "*", "italic text"); }
    if (e.key.toLowerCase() === "k") { e.preventDefault(); void link(); }
  };

  const TBtn = ({ onClick, children, className = "" }: { onClick: () => void; children: React.ReactNode; className?: string }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer transition-colors ${className}`}>
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex gap-1 mb-1">
        <TBtn onClick={() => wrap("**", "**", "bold text")} className="font-black">B</TBtn>
        <TBtn onClick={() => wrap("*", "*", "italic text")} className="italic">I</TBtn>
        <TBtn onClick={link}>Link</TBtn>
        <span className="ml-auto text-[9px] font-semibold text-slate-300 self-center hidden sm:block">⌘B / ⌘I / ⌘K</span>
      </div>
      <textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} placeholder={placeholder} className={fieldCls} />
    </div>
  );
}
