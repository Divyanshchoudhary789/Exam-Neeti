"use client";

import React, { useMemo, useRef, useState } from "react";

// ==========================================
// SHARED CHART PRIMITIVES
//
// Dependency-free SVG charts (no charting library in this project). Every
// chart is viewBox-scaled so it stays responsive by CSS width alone, and
// every interactive chart carries its own hover/tooltip layer per the
// dataviz interaction spec — tooltips supplement (never gate) a value
// that's already visible via a direct label or the surrounding stat.
// ==========================================

// ─── Color helpers — reuse the app's existing status convention ─────────────
// (emerald = good, amber = watch, rose = risk) rather than inventing a new
// palette, so charts read consistently with every other stat card/badge.
export const bandColor = (pct: number, goodAt = 70, warnAt = 40) =>
  pct >= goodAt ? "#059669" /* emerald-600 */ : pct >= warnAt ? "#d97706" /* amber-600 */ : "#e11d48" /* rose-600 */;
const bandTrack = (pct: number, goodAt = 70, warnAt = 40) =>
  pct >= goodAt ? "#d1fae5" /* emerald-100 */ : pct >= warnAt ? "#fef3c7" /* amber-100 */ : "#ffe4e6" /* rose-100 */;

// ─── Radial Meter — a single ratio against an implicit 0-100 limit ──────────
// (accuracy vs. target, sprint coverage, etc.) Correct form per dataviz spec
// for "a single ratio against a limit": a meter, not a 2-slice pie.
export function RadialMeter({
  value,
  size = 96,
  strokeWidth = 10,
  label,
  sublabel,
  color,
  trackColor,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const fill = color || bandColor(pct);
  const track = trackColor || bandTrack(pct);

  return (
    <div className="inline-flex flex-col items-center gap-1 shrink-0">
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fill}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        {/* Percentage sits inside the ring only — a text label never fits the
            inner circle without clipping against the stroke, so it renders
            as a caption below the ring instead (see `label` block below). */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black tabular-nums leading-none text-slate-900" style={{ fontSize: size * 0.26 }}>
            {pct.toFixed(0)}
            <span style={{ fontSize: size * 0.16 }}>%</span>
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide text-center leading-tight max-w-[6rem]">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="sr-only">{sublabel}</span>
      )}
    </div>
  );
}

// ─── Sparkline — a 12-point-ish inline trend, no axes ────────────────────────
export function Sparkline({
  values,
  width = 88,
  height = 28,
  color = "#4f46e5",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-[9px] text-slate-300 font-semibold">—</div>;
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 3;
  const points = clean.map((v, i) => {
    const x = (i / (clean.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={areaPath} fill={color} opacity={0.1} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={4} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}

// ─── Area / Line Chart — with crosshair + tooltip on hover ──────────────────
export interface SeriesPoint {
  label: string;
  value: number;
  detail?: string;
}

export function AreaLineChart({
  data,
  height = 180,
  color = "#4f46e5",
  valueSuffix = "",
  valueFormatter,
  yMax,
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  valueSuffix?: string;
  valueFormatter?: (v: number) => string;
  yMax?: number;
}) {
  const width = 600; // viewBox units — scales fluidly via CSS width:100%
  const padL = 8, padR = 8, padT = 16, padB = 24;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const values = data.map((d) => d.value).filter((v) => Number.isFinite(v));
  const maxVal = yMax ?? Math.max(...values, 1);
  const minVal = Math.min(0, ...values);
  const span = maxVal - minVal || 1;

  const points = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - padL - padR) + padL;
      const y = padT + (height - padT - padB) * (1 - (d.value - minVal) / span);
      return { x, y, ...d };
    });
  }, [data, minVal, span, height]);

  if (data.length === 0 || points.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-xs font-semibold text-slate-400">
        Not enough data yet.
      </div>
    );
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const baseline = padT + (height - padT - padB) * (1 - (0 - minVal) / span);
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`;
  const fmt = valueFormatter || ((v: number) => `${v.toFixed(0)}${valueSuffix}`);

  const handlePointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverIdx(nearest);
  };

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  // Show at most ~6 x-axis labels so long timelines don't collide.
  const labelStride = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
        style={{ height }}
        onMouseMove={(e) => handlePointer(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => handlePointer(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointer(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {/* Gridline at baseline */}
        <line x1={padL} y1={baseline} x2={width - padR} y2={baseline} stroke="#e2e8f0" strokeWidth={1} />

        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* X-axis labels (sparse) */}
        {points.map((p, i) =>
          i % labelStride === 0 || i === points.length - 1 ? (
            <text key={`lbl-${i}`} x={p.x} y={height - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill="#94a3b8">
              {p.label}
            </text>
          ) : null
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3.5}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
            style={{ transition: "r 120ms ease" }}
          />
        ))}

        {/* Crosshair */}
        {hovered && (
          <line x1={hovered.x} y1={padT} x2={hovered.x} y2={baseline} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
        )}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-10 pointer-events-none bg-slate-900 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full whitespace-nowrap"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${Math.max(0, (hovered.y / height) * 100 - 4)}%`,
          }}
        >
          <div className="font-black tabular-nums">{fmt(hovered.value)}</div>
          <div className="text-slate-300 font-medium">{hovered.detail || hovered.label}</div>
        </div>
      )}
    </div>
  );
}

// ─── Horizontal Bar (with hover tooltip) — magnitude comparison across a
// short categorical list (subjects, difficulty bands, question types) ───────
export function HBarChart({
  data,
  color = "#4f46e5",
  valueSuffix = "%",
  max = 100,
}: {
  data: { label: string; value: number; detail?: string; color?: string }[];
  color?: string;
  valueSuffix?: string;
  max?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = Math.min(100, (d.value / Math.max(max, 1)) * 100);
        return (
          <div
            key={i}
            className="space-y-1 group cursor-default"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
              <span className="capitalize truncate">{d.label}</span>
              <span className="tabular-nums text-slate-500 shrink-0">
                {d.value.toFixed(0)}{valueSuffix}
                {hoverIdx === i && d.detail && <span className="ml-1.5 text-slate-400 font-semibold">({d.detail})</span>}
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 group-hover:brightness-110"
                style={{ width: `${pct}%`, backgroundColor: d.color || color, transitionDelay: `${i * 60}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
