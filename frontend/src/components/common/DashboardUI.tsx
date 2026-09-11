"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronRight, IconChevronDown, IconCross, IconInfo } from "./UIComponents";
import { Sparkline } from "./Charts";

/* ============================================================================
   Shared dashboard building blocks — one visual system for every student panel.
   ========================================================================== */

// ─── Section card + header ──────────────────────────────────────────────────
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`dash-card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-[15px] font-black text-slate-900 flex items-center gap-2 leading-tight">
              {Icon && <Icon className="w-4 h-4 text-indigo-600 shrink-0" />}
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`px-4 sm:px-5 pb-4 sm:pb-5 ${title ? "" : "pt-4 sm:pt-5"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// ─── Delta chip (+6% vs last mo) ────────────────────────────────────────────
export function DeltaChip({ value, suffix = "%", unit = "vs last month", hideZero = true }: { value: number | null; suffix?: string; unit?: string; hideZero?: boolean }) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = parseFloat(Number(value).toFixed(1));
  if (hideZero && rounded === 0) return null;
  const up = rounded > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      <svg className={`w-2.5 h-2.5 ${up ? "" : "rotate-180"}`} viewBox="0 0 12 12" fill="none">
        <path d="M6 2.5 10 8H2z" fill="currentColor" />
      </svg>
      {up ? "+" : ""}{rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}{suffix}
      <span className="hidden sm:inline text-slate-400 font-semibold">{unit}</span>
    </span>
  );
}

// ─── KPI card (Overview) — value + sparkline + delta + status, clickable ────
export function KpiCard({
  label,
  value,
  sub,
  spark,
  delta,
  status,
  icon: Icon,
  onClick,
  accent = "#4f46e5",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  spark?: number[];
  delta?: number | null;
  status?: { label: string; tone: "good" | "warn" | "risk" | "neutral" };
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  accent?: string;
}) {
  const toneCls =
    status?.tone === "good" ? "bg-emerald-50 text-emerald-700"
    : status?.tone === "warn" ? "bg-amber-50 text-amber-700"
    : status?.tone === "risk" ? "bg-rose-50 text-rose-700"
    : "bg-slate-100 text-slate-600";
  const hasSpark = !!spark && spark.filter((n) => Number.isFinite(n)).length >= 2;
  const hasDelta = delta != null && !Number.isNaN(delta);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`dash-card-flat relative text-left w-full overflow-hidden flex flex-col ${onClick ? "dash-clickable group" : ""} disabled:cursor-default`}
    >
      {onClick && (
        <IconChevronRight className="absolute top-3 right-2.5 w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      )}
      <div className="p-3.5 sm:p-4 pb-2.5 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-2 min-w-0 pr-5">
          {Icon && (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}14`, color: accent }}>
              <Icon className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide text-slate-400 truncate">{label}</span>
        </div>

        <div className="min-w-0 mt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[22px] sm:text-[26px] font-black text-slate-900 tabular-nums leading-none">{value}</p>
            {hasDelta && <DeltaChip value={delta ?? null} unit="vs last mo" />}
            {status && <span className={`text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${toneCls}`}>{status.label}</span>}
          </div>
          {sub && <p className="text-[11px] font-semibold text-slate-400 mt-1 line-clamp-1">{sub}</p>}
        </div>
      </div>

      {hasSpark && (
        <div className="px-0.5 -mb-px">
          <Sparkline values={spark!} width={240} height={22} color={accent} fluid />
        </div>
      )}
    </button>
  );
}

// ─── Clickable stat tile — compact, used across Analytics tabs ──────────────
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  onClick,
  formula,
  calc,
  note,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "risk" | "brand";
  onClick?: () => void;
  formula?: string;
  calc?: string;
  note?: string;
}) {
  const valueCls =
    tone === "good" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "risk" ? "text-rose-600"
    : tone === "brand" ? "text-indigo-600"
    : "text-slate-900";
  return (
    <div
      onClick={onClick}
      className={`dash-inset relative p-3 sm:p-3.5 flex flex-col gap-0.5 ${onClick ? "dash-clickable group" : ""}`}
    >
      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-slate-400 pr-4">
        <span className="truncate">{label}</span>
        {formula && <InlineFormula formula={formula} calc={calc} note={note} />}
      </div>
      <p className={`text-lg sm:text-xl font-black tabular-nums leading-tight ${valueCls}`}>{value}</p>
      {sub && <p className="text-[10px] font-semibold text-slate-400 leading-snug line-clamp-2">{sub}</p>}
      {onClick && (
        <IconChevronRight className="absolute top-3 right-2.5 w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      )}
    </div>
  );
}

// ─── Inline formula popover (lighter sibling of FormulaInfo, portal-based) ───
export function InlineFormula({ formula, calc, note }: { formula: string; calc?: string; note?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 20);
    setPos({ left: Math.min(Math.max(r.left + r.width / 2 - w / 2, 10), window.innerWidth - w - 10), top: r.bottom + 6 });

    const close = () => setOpen(false);
    // Any click that isn't on the trigger or inside the popover dismisses it.
    const onPointerDown = (e: Event) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("touchstart", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("touchstart", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
        className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${open ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 hover:bg-indigo-500 hover:text-white"}`}
        aria-label="How this is calculated"
        aria-expanded={open}
      >
        <IconInfo className="w-2.5 h-2.5" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: pos.left, top: pos.top, width: Math.min(280, window.innerWidth - 20) }}
          className="z-[210] p-3 rounded-xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10"
        >
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-300 mb-1">Formula</p>
          <p className="text-[11px] font-mono leading-snug text-slate-100 break-words">{formula}</p>
          {calc && (
            <p className="text-[11px] font-mono leading-snug text-emerald-50 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5 mt-2 break-words">{calc}</p>
          )}
          {note && <p className="text-[10px] leading-snug text-slate-400 mt-2 pt-2 border-t border-white/10">{note}</p>}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Segmented control (1M / 3M / 6M / All) ─────────────────────────────────
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5 ${size === "md" ? "text-xs" : "text-[11px]"}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 ${size === "md" ? "py-1.5" : "py-1"} rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
            value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Filter pills (horizontal scroll on mobile) ────────────────────────────
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer shrink-0 inline-flex items-center gap-1.5 ${
            value === o.value ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {o.label}
          {o.count != null && (
            <span className={`tabular-nums text-[10px] px-1 rounded ${value === o.value ? "bg-white/25" : "bg-white"}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Sortable table ────────────────────────────────────────────────────────
export interface Column<Row> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sortValue?: (row: Row) => number | string;
  render: (row: Row) => React.ReactNode;
  className?: string;
}

export function SortableTable<Row>({
  columns,
  rows,
  initialSort,
  rowKey,
  onRowClick,
  emptyLabel = "No rows",
}: {
  columns: Column<Row>[];
  rows: Row[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowKey: (row: Row, i: number) => string;
  onRowClick?: (row: Row) => void;
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a); const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={c.sortable ? () => toggle(c.key) : undefined}
                className={`py-2 px-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.sortable ? "cursor-pointer hover:text-slate-700 select-none" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortable && sort?.key === c.key && (
                    <IconChevronDown className={`w-3 h-3 ${sort.dir === "asc" ? "rotate-180" : ""}`} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-xs font-semibold text-slate-400">{emptyLabel}</td></tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""} transition-colors`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`py-2.5 px-2 text-xs font-semibold text-slate-700 ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""} ${c.className || ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sheet — right drawer (desktop) / bottom sheet (mobile) ────────────────
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = "sm:max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const labelId = useId();
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute bg-white shadow-2xl flex flex-col
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl animate-sheet-up
          sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:max-h-none sm:h-full sm:w-full ${widthClass} sm:rounded-none sm:animate-sheet-right`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 id={labelId} className="text-base font-black text-slate-900 leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0">
            <IconCross className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-grow px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Percentage → performance label badge ─────────────────────────────────
export function StatusBadge2({ pct }: { pct: number }) {
  const { label, cls } =
    pct >= 80 ? { label: "Excellent", cls: "bg-emerald-50 text-emerald-700" }
    : pct >= 65 ? { label: "Good", cls: "bg-teal-50 text-teal-700" }
    : pct >= 45 ? { label: "Average", cls: "bg-amber-50 text-amber-700" }
    : { label: "Needs Work", cls: "bg-rose-50 text-rose-700" };
  return <span className={`inline-block text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md ${cls}`}>{label}</span>;
}

// ─── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-5 gap-2">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-0.5">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {desc && <p className="text-xs text-slate-400 font-medium max-w-sm leading-relaxed">{desc}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ─── Small helpers shared by tabs ──────────────────────────────────────────
export const SUBJECT_TINT: Record<string, string> = {
  physics: "#6366f1",
  chemistry: "#8b5cf6",
  biology: "#14b8a6",
  mathematics: "#0ea5e9",
  maths: "#0ea5e9",
  math: "#0ea5e9",
};
export const subjectColor = (s?: string) => SUBJECT_TINT[String(s || "").toLowerCase()] || "#64748b";

/** Gradient pair for a subject's icon tile / accent bar. */
export const subjectGradient = (s?: string): string => {
  const base = subjectColor(s);
  return `linear-gradient(135deg, ${base}, ${base}cc)`;
};

// ─── Gradient icon tile — the reference's coloured rounded-square icon ──────
export function GradientIconTile({
  icon: Icon,
  gradient,
  size = "md",
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  gradient?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "w-12 h-12" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const ic = size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span
      className={`dash-icon-tile shrink-0 ${box} ${className}`}
      style={gradient ? ({ "--tile": gradient } as React.CSSProperties) : undefined}
    >
      <Icon className={ic} />
    </span>
  );
}

// ─── Pivot tabs — the Subject / Chapter / Topic / Difficulty selector row ──
export function PivotTabs<T extends string>({
  options,
  value,
  onChange,
  variant = "solid",
}: {
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
  variant?: "solid" | "pill";
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              active
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : variant === "pill"
                  ? "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── "Chapters covered by weightage" — High / Medium / Low covered/total ───
export interface WeightageBand { covered: number; total: number }
export function WeightageCoverageRow({ data }: { data?: Record<string, WeightageBand> | null }) {
  if (!data) return null;
  const bands: { key: "high" | "medium" | "low"; label: string; cls: string }[] = [
    { key: "high", label: "High", cls: "bg-rose-50 text-rose-700 border-rose-100" },
    { key: "medium", label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-100" },
    { key: "low", label: "Low", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  ];
  const anything = bands.some((b) => (data[b.key]?.total ?? 0) > 0);
  if (!anything) return null;
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
        Chapters covered by weightage
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {bands.map((b) => {
          const band = data[b.key] || { covered: 0, total: 0 };
          return (
            <div key={b.key} className={`rounded-xl border px-2 py-1.5 text-center ${b.cls}`}>
              <p className="text-[9px] font-black uppercase tracking-wide opacity-80">{b.label}</p>
              <p className="text-sm font-black tabular-nums">
                {band.covered}<span className="opacity-50 text-[11px]"> / {band.total}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Strip LaTeX delimiters / markup for a plain one-line preview of question text. */
export const previewText = (t?: string) =>
  (t || "")
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, "")
    .replace(/\\[a-zA-Z]+\{?|[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const fmtSecs = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};

export const bandTone = (pct: number): "good" | "warn" | "risk" =>
  pct >= 70 ? "good" : pct >= 40 ? "warn" : "risk";
