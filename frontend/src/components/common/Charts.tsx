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
  fluid = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** when true the svg fills its container width (viewBox stays at `width`) */
  fluid?: boolean;
}) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <div style={{ width: fluid ? "100%" : width, height }} className="flex items-center justify-center text-[9px] text-slate-300 font-semibold">—</div>;
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
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : "xMidYMid meet"}
      className="overflow-visible block"
    >
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={fluid ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round" vectorEffect={fluid ? "non-scaling-stroke" : undefined} />
      {!fluid && <circle cx={lastX} cy={lastY} r={4} fill={color} stroke="#fff" strokeWidth={2} />}
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

// ─── Donut Chart — categorical share of a whole (error mix, etc.) ───────────
// Correct form per dataviz spec for "parts of a whole" with ≤5 categories and
// a meaningful total to anchor in the center (vs. a bar, which has no center).
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  size = 140,
  strokeWidth = 20,
  centerLabel,
  centerSublabel,
}: {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-xs font-semibold text-slate-400 border-2 border-dashed border-slate-200 rounded-full"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const segments = data
    .filter((d) => d.value > 0)
    .reduce<Array<DonutSegment & { frac: number; dash: number; offset: number }>>((acc, d) => {
      const frac = d.value / total;
      const dash = frac * circumference;
      const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      acc.push({ ...d, frac, dash, offset });
      return acc;
    }, []);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset}
              style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {centerLabel && (
            <span className="font-black text-slate-900 leading-none tabular-nums" style={{ fontSize: size * 0.16 }}>
              {centerLabel}
            </span>
          )}
          {centerSublabel && (
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1 max-w-[6rem] leading-tight">
              {centerSublabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="truncate">{d.label}</span>
            <span className="text-slate-400 font-semibold tabular-nums shrink-0">
              {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
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

// ─── Gauge Arc — 180° semicircle meter with a percentile caption ────────────
export function GaugeArc({
  value,
  size = 200,
  strokeWidth = 16,
  caption,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  caption?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const w = size;
  const h = size / 2 + strokeWidth;
  const cx = w / 2;
  const cy = size / 2 + strokeWidth / 2;
  const r = (size - strokeWidth) / 2;
  const polar = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  const [sx, sy] = polar(0);
  const [ex, ey] = polar(1);
  const [vx, vy] = polar(pct / 100);
  const [dx, dy] = polar(pct / 100);
  const fill = color || bandColor(pct);
  // A gauge arc spans at most 180°, so the SVG large-arc-flag is always 0 —
  // setting it to 1 past the halfway mark makes the path sweep the long way
  // round and balloon past the semicircle.
  const gid = React.useId().replace(/:/g, "");

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <svg width={w} height={h + 6} viewBox={`0 0 ${w} ${h + 6}`} className="overflow-visible">
        <defs>
          <linearGradient id={`gauge-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={fill} stopOpacity={0.55} />
            <stop offset="100%" stopColor={fill} />
          </linearGradient>
        </defs>
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke="#eef0f6" strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* quarter ticks */}
        {[0.25, 0.5, 0.75].map((f) => {
          const [tx, ty] = polar(f);
          const [ix, iy] = [cx + (r - strokeWidth / 2 - 2) * Math.cos(Math.PI * (1 - f)), cy - (r - strokeWidth / 2 - 2) * Math.sin(Math.PI * (1 - f))];
          return <line key={f} x1={tx} y1={ty} x2={ix} y2={iy} stroke="#fff" strokeWidth={2} />;
        })}
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${vx} ${vy}`}
          fill="none" stroke={`url(#gauge-${gid})`} strokeWidth={strokeWidth} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
        <circle cx={dx} cy={dy} r={strokeWidth * 0.42} fill="#fff" stroke={fill} strokeWidth={3} />
        {/* endpoint scale labels */}
        <text x={sx} y={sy + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#cbd5e1">0</text>
        <text x={ex} y={ey + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#cbd5e1">100</text>
        {/* value, centred in the arc */}
        <text x={cx} y={cy - size * 0.10} textAnchor="middle" className="fill-slate-900" fontSize={size * 0.24} fontWeight={800}>
          {pct.toFixed(0)}<tspan fontSize={size * 0.12} dx={1}>%</tspan>
        </text>
      </svg>
      {caption && <span className="text-[11px] font-bold text-slate-500 text-center max-w-[16rem] leading-snug">{caption}</span>}
    </div>
  );
}

// ─── Stacked Bar — one row of proportional segments (Correct/Guess/… mix) ────
export function StackedBar({
  segments,
  height = 14,
  showLegend = true,
  rounded = true,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
  showLegend?: boolean;
  rounded?: boolean;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className="space-y-2 w-full">
      <div className={`flex w-full overflow-hidden ${rounded ? "rounded-full" : "rounded-md"}`} style={{ height }}>
        {total <= 0 ? (
          <div className="w-full bg-slate-100" />
        ) : (
          segments.filter((s) => s.value > 0).map((s, i) => (
            <div
              key={i}
              className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${s.value}`}
            />
          ))
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="text-slate-400 tabular-nums">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Radar Chart — multi-axis comparison, toggleable series ─────────────────
export interface RadarSeries {
  label: string;
  color: string;
  values: number[]; // one per axis, 0-100
}

export function RadarChart({
  axes,
  series,
  size = 300,
  max = 100,
  showScale = false,
  valueSuffix = "",
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
  max?: number;
  /** draw the 25/50/75/100 ring values along the top axis */
  showScale?: boolean;
  valueSuffix?: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;
  if (n < 3) return null;

  const point = (axisIdx: number, frac: number) => {
    const a = -Math.PI / 2 + (axisIdx / n) * Math.PI * 2;
    return [cx + r * frac * Math.cos(a), cy + r * frac * Math.sin(a)] as const;
  };
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full h-auto">
        {rings.map((rr, i) => (
          <polygon
            key={i}
            points={axes.map((_, ai) => point(ai, rr).join(",")).join(" ")}
            fill="none" stroke="#e7e8f2" strokeWidth={1}
          />
        ))}
        {showScale && rings.map((rr, i) => {
          const [lx, ly] = point(0, rr);
          return (
            <text key={`sc${i}`} x={lx + 4} y={ly} fontSize={8} fontWeight={700} fill="#cbd5e1" dominantBaseline="middle">
              {Math.round(rr * max)}{valueSuffix}
            </text>
          );
        })}
        {axes.map((ax, ai) => {
          const [x, y] = point(ai, 1);
          const [lx, ly] = point(ai, 1.16);
          return (
            <g key={ai}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e7e8f2" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#64748b">
                {ax}
              </text>
            </g>
          );
        })}
        {series.filter((s) => !hidden.has(s.label)).map((s) => {
          const pts = axes.map((_, ai) => point(ai, Math.max(0, Math.min(1, (s.values[ai] ?? 0) / max))));
          return (
            <polygon
              key={s.label}
              points={pts.map((p) => p.join(",")).join(" ")}
              fill={s.color} fillOpacity={0.14} stroke={s.color} strokeWidth={2} strokeLinejoin="round"
              style={{ transition: "all 500ms cubic-bezier(0.16,1,0.3,1)" }}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2">
        {series.map((s) => {
          const off = hidden.has(s.label);
          return (
            <button
              key={s.label}
              onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.label)) n.delete(s.label); else n.add(s.label); return n; })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${off ? "border-slate-200 text-slate-300 line-through" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: off ? "#cbd5e1" : s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Heatmap — rows × columns, value drives a green→amber→red tint ──────────
export function Heatmap({
  rows,
  columns,
  cell,
  onCellClick,
}: {
  rows: string[];
  columns: string[];
  /** returns null for "no data" (renders a dash) */
  cell: (row: string, col: string) => number | null;
  onCellClick?: (row: string, col: string) => void;
}) {
  const tint = (v: number) => {
    // 0 → risk, 50 → warn, 100 → good; blend toward white for readability
    const c = v >= 70 ? [209, 250, 229] : v >= 45 ? [254, 243, 199] : [255, 228, 230];
    const strength = 0.35 + (Math.abs(v - 50) / 50) * 0.4;
    return `rgba(${c[0]},${c[1]},${c[2]},${strength})`;
  };
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full border-separate" style={{ borderSpacing: 4, minWidth: columns.length * 76 + 120 }}>
        <thead>
          <tr>
            <th className="text-left" />
            {columns.map((c) => (
              <th key={c} className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 pb-1 text-center capitalize">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rw) => (
            <tr key={rw}>
              <td className="text-[11px] font-bold text-slate-600 pr-3 whitespace-nowrap max-w-[160px] truncate">{rw}</td>
              {columns.map((c) => {
                const v = cell(rw, c);
                return (
                  <td key={c} className="p-0">
                    <div
                      onClick={v != null && onCellClick ? () => onCellClick(rw, c) : undefined}
                      className={`h-9 rounded-lg flex items-center justify-center text-[11px] font-black tabular-nums ${v != null && onCellClick ? "cursor-pointer hover:ring-2 hover:ring-indigo-400" : ""}`}
                      style={{ backgroundColor: v == null ? "#f1f5f9" : tint(v), color: v == null ? "#cbd5e1" : "#0f172a" }}
                    >
                      {v == null ? "—" : `${Math.round(v)}%`}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Multi-Line Chart — 2-3 series on one 0-100 axis, toggleable legend ─────
// Reference "Score Trend" plots Score %, Accuracy % and Attempt Rate % together.
export interface LineSeries {
  label: string;
  color: string;
  values: number[]; // one per x tick, same length as `labels`
}

export function MultiLineChart({
  labels,
  series,
  height = 220,
  yMax = 100,
  valueSuffix = "%",
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  yMax?: number;
  valueSuffix?: string;
}) {
  const width = 640;
  const padL = 26, padR = 10, padT = 14, padB = 22;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const n = labels.length;
  if (n < 2) {
    return <div className="flex items-center justify-center py-10 text-xs font-semibold text-slate-400">Need 2+ tests for a trend.</div>;
  }
  const x = (i: number) => (i / (n - 1)) * (width - padL - padR) + padL;
  const y = (v: number) => padT + (height - padT - padB) * (1 - Math.max(0, Math.min(yMax, v)) / yMax);
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + (height - padT - padB) * (1 - f));

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const rel = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0, best = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - rel); if (d < best) { best = d; nearest = i; } }
    setHoverIdx(nearest);
  };
  const visible = series.filter((s) => !hidden.has(s.label));

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
        style={{ height }}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {gridY.map((gy, i) => (
          <g key={i}>
            <line x1={padL} y1={gy} x2={width - padR} y2={gy} stroke="#eef1f7" strokeWidth={1} />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize={9} fontWeight={700} fill="#cbd5e1">
              {Math.round((1 - (gy - padT) / (height - padT - padB)) * yMax)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % Math.max(1, Math.ceil(n / 8)) === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill="#94a3b8">{l}</text>
          ) : null,
        )}
        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} y1={padT} x2={x(hoverIdx)} y2={height - padB} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
        )}
        {visible.map((s) => {
          const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {visible.map((s) =>
          s.values.map((v, i) => (
            <circle key={`${s.label}-${i}`} cx={x(i)} cy={y(v)} r={hoverIdx === i ? 4 : 2.5} fill="#fff" stroke={s.color} strokeWidth={2} style={{ transition: "r 120ms ease" }} />
          )),
        )}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute z-10 pointer-events-none bg-slate-900 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full whitespace-nowrap"
          style={{ left: `${(x(hoverIdx) / width) * 100}%`, top: `${(padT / height) * 100}%` }}
        >
          <div className="font-black">{labels[hoverIdx]}</div>
          {visible.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: <span className="tabular-nums font-black">{s.values[hoverIdx]?.toFixed(0)}{valueSuffix}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {series.map((s) => {
          const off = hidden.has(s.label);
          return (
            <button
              key={s.label}
              onClick={() => setHidden((h) => { const nx = new Set(h); if (nx.has(s.label)) nx.delete(s.label); else nx.add(s.label); return nx; })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${off ? "border-slate-200 text-slate-300 line-through" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: off ? "#cbd5e1" : s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scatter Plot — X = question order, Y = seconds, with an "optimal zone" ──
export interface ScatterPoint {
  x: number;      // 1..N question index
  y: number;      // seconds
  correct?: boolean;
  label?: string;
}
export function ScatterPlot({
  points,
  zoneLow = 60,
  zoneHigh = 120,
  height = 260,
  yLabel = "seconds",
}: {
  points: ScatterPoint[];
  zoneLow?: number;
  zoneHigh?: number;
  height?: number;
  yLabel?: string;
}) {
  const width = 640;
  const padL = 34, padR = 12, padT = 14, padB = 26;
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <div className="py-10 text-center text-xs font-semibold text-slate-400">No timing data.</div>;

  const maxX = Math.max(...points.map((p) => p.x), 1);
  const maxY = Math.max(...points.map((p) => p.y), zoneHigh) * 1.1;
  const px = (x: number) => padL + (x / maxX) * (width - padL - padR);
  const py = (y: number) => padT + (height - padT - padB) * (1 - y / maxY);
  const colorOf = (p: ScatterPoint) => (p.y < zoneLow ? "#0ea5e9" : p.y <= zoneHigh ? "#059669" : "#f97316");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxY * f) / 30) * 30);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ height }}>
        {/* optimal zone band */}
        <rect x={padL} y={py(zoneHigh)} width={width - padL - padR} height={py(zoneLow) - py(zoneHigh)} fill="#ecfdf5" />
        <text x={padL + 6} y={py(zoneHigh) + 12} fontSize={9} fontWeight={800} fill="#10b981">optimal zone</text>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={py(t)} x2={width - padR} y2={py(t)} stroke="#eef1f7" strokeWidth={1} />
            <text x={padL - 6} y={py(t) + 3} textAnchor="end" fontSize={9} fontWeight={700} fill="#cbd5e1">{t}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={px(p.x)} cy={py(p.y)}
            r={hover === i ? 6 : 4}
            fill={p.correct === false ? "#fff" : colorOf(p)}
            stroke={colorOf(p)}
            strokeWidth={p.correct === false ? 2 : 1}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ transition: "r 120ms ease", cursor: "pointer" }}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 justify-center mt-1 text-[10px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />Fast (&lt;{zoneLow}s)</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" />Optimal</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Slow (&gt;{zoneHigh}s)</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-slate-400 bg-white" />Wrong</span>
      </div>
      {hover != null && points[hover] && (
        <div className="absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-[11px] font-semibold rounded-lg px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{ left: `${(px(points[hover].x) / width) * 100}%`, top: `${(py(points[hover].y) / height) * 100}%` }}>
          {points[hover].label || `Q${points[hover].x}`} · {points[hover].y}s{yLabel === "seconds" ? "" : ` ${yLabel}`}
        </div>
      )}
    </div>
  );
}

// ─── Scatter Strip — events on a single horizontal timeline (mistake map) ───
export function ScatterStrip({
  durationSeconds,
  points,
  height = 96,
  fatigueFromFrac = 0.66,
}: {
  durationSeconds: number;
  points: { at: number; label: string; color: string }[];
  height?: number;
  fatigueFromFrac?: number;
}) {
  const width = 600;
  const padX = 12;
  const total = Math.max(durationSeconds, 1);
  const [hover, setHover] = useState<number | null>(null);
  const rowY = height - 34;
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ height }}>
        <rect x={padX + (width - padX * 2) * fatigueFromFrac} y={8} width={(width - padX * 2) * (1 - fatigueFromFrac)} height={rowY} fill="#fff1f2" />
        <line x1={padX} y1={rowY} x2={width - padX} y2={rowY} stroke="#e2e8f0" strokeWidth={1.5} />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={padX + (width - padX * 2) * f} y={height - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill="#94a3b8">
            {Math.round((total * f) / 60)}m
          </text>
        ))}
        {points.map((p, i) => {
          const x = padX + (width - padX * 2) * Math.max(0, Math.min(1, p.at / total));
          return (
            <circle
              key={i} cx={x} cy={rowY} r={hover === i ? 7 : 5}
              fill={p.color} stroke="#fff" strokeWidth={2}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ transition: "r 120ms ease", cursor: "pointer" }}
            />
          );
        })}
      </svg>
      {hover != null && points[hover] && (
        <div className="absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-[11px] font-semibold rounded-lg px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{ left: `${(Math.max(0, Math.min(1, points[hover].at / total))) * 100}%`, top: `${(rowY / height) * 100}%` }}>
          {points[hover].label}
        </div>
      )}
    </div>
  );
}
