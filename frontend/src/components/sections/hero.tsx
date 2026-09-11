"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";

interface HeroProps {
  onOpenAuth: (type: "login" | "join") => void;
}

interface HeroFeature {
  icon: ReactNode;
  title: string;
  sub: string;
}

interface HeroSlide {
  id: number;
  /** Slide composition. "split" = left copy + right bleed photo (slide 1).
   *  "centered" = single centred column with hand-drawn annotations. */
  layout: "split" | "centered";
  heading: ReactNode;
  description: ReactNode;
  /** Right-column visual (split slides only). Local path or whitelisted
   *  remote host (see next.config.ts). */
  image?: string;
  imageAlt?: string;
  /** Desktop bleed-layer object-position. Defaults to "66% 16%". Override when a
   *  slide's artwork isn't centred in its frame (e.g. an illustration whose
   *  subject sits to one side). */
  imagePosition?: string;
  /** Optional CSS filter for the desktop bleed layer — used to keep pale
   *  line-art readable once it is blended into the page. */
  imageFilter?: string;
  /** Three-up icon row under the copy (centered slides only). */
  features?: HeroFeature[];
  /** Render the "Better Analysis" / "Higher Scores" margin doodles. */
  annotations?: boolean;
}

/* ── Hand-drawn decorations (centered slides) ─────────────────────────────── */

/** Sketchy burst of strokes that flanks a centered headline. */
function SparkBurst({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M6 22 H20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M9 9 L21 18" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M9 35 L21 26" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Two-pass hand-drawn underline that sits beneath the highlighted phrase. */
function UnderlineSwoosh({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 20" preserveAspectRatio="none" fill="none" aria-hidden className={className}>
      <path
        d="M3 13 C 55 3 110 3 150 8 C 200 14 250 15 297 6"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M12 18 C 70 11 140 11 190 14 C 240 17 275 17 293 13"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/** Margin note in a handwritten face with a curved arrow toward the copy. */
function Annotation({ text, side }: { text: string; side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-[32%] hidden xl:flex flex-col items-center gap-1 ${
        isLeft ? "-left-12 -rotate-6" : "-right-12 rotate-6"
      }`}
    >
      <span className="font-script whitespace-nowrap text-2xl font-bold text-[#6b5cf6]">{text}</span>
      <svg
        viewBox="0 0 90 62"
        className="h-11 w-16 text-[#6b5cf6]"
        fill="none"
        style={isLeft ? undefined : { transform: "scaleX(-1)" }}
      >
        <path d="M10 6 C 18 34 44 50 78 46" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M63 37 L80 46 L67 59"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ── Feature-row icons (centered "analytics" slide) ───────────────────────── */

function IconInsight({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M8 16v2M13 11v7M18 6v12" />
    </svg>
  );
}

function IconFocus({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconRise({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
    </svg>
  );
}

/**
 * Rotating hero narrative. Slide 1 keeps the split composition (left copy +
 * right bleed photo + floating stat cards); slides 2–3 switch to a centred
 * column with margin doodles. Fixed chrome (badge, CTAs, social proof, scroll
 * cue) is shared across every slide.
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 0,
    layout: "split",
    heading: (
      <h1 className="font-sans text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black leading-[1.08] tracking-tight text-slate-950">
        Same books.
        <br />
        Same syllabus.
        <br />
        <span className="text-[#3238e8]">Different scores.</span>
        <br />
        <span className="text-[#3238e8]">Why?</span>
      </h1>
    ),
    description: (
      <>
        Every year, thousands of aspirants work just as hard—but not everyone improves.{" "}
        <br className="hidden sm:inline" />
        The difference is not in effort. <span className="font-bold text-[#3238e8]">It&apos;s in strategy.</span>
      </>
    ),
    image: "/hero_image.png",
    imageAlt: "NEET aspirant strategizing with mock test papers",
  },
  {
    id: 1,
    layout: "centered",
    annotations: true,
    heading: (
      <h1 className="font-sans text-center text-3xl sm:text-4xl md:text-5xl lg:text-[44px] font-black leading-[1.12] tracking-tight text-slate-950">
        Hard work isn&apos;t enough.
        <br />
        <span className="relative inline-block text-[#5a4bfc]">
          Plug the leaks.
          <UnderlineSwoosh className="absolute left-0 -bottom-2 sm:-bottom-3 h-3 w-full text-[#8b7bfd] sm:h-4" />
        </span>
      </h1>
    ),
    description: (
      <span className="block text-lg sm:text-xl md:text-2xl font-bold leading-snug text-slate-800">
        Every mock test has a message.
        <br />
        <span className="text-[#5a4bfc]">Are you listening?</span>
      </span>
    ),
  },
  {
    id: 2,
    layout: "centered",
    heading: (
      <h1 className="font-sans text-center text-3xl sm:text-4xl md:text-5xl lg:text-[44px] font-black leading-[1.12] tracking-tight text-slate-950">
        Not just analytics.
        <br />
        <span className="relative inline-block text-[#5a4bfc]">
          Action. Consistent Improvement.
          <UnderlineSwoosh className="absolute left-0 -bottom-2 sm:-bottom-3 h-3 w-full text-[#8b7bfd] sm:h-4" />
        </span>
      </h1>
    ),
    description: (
      <span className="block text-sm sm:text-base leading-relaxed text-slate-600">
        Know exactly where you slip, why it happens, and what to do next.
        <br className="hidden sm:inline" />
        Turn insights into a clear plan for higher scores.
      </span>
    ),
    features: [
      { icon: <IconInsight />, title: "Clear Insights", sub: "Know where you stand." },
      { icon: <IconFocus />, title: "Focused Action", sub: "Fix what matters." },
      { icon: <IconRise />, title: "Real Improvement", sub: "Turn effort into results." },
    ],
  },
];

const HERO_ROTATE_INTERVAL_MS = 6000;

/**
 * Elliptical vignette applied to the desktop visual. The subject and most of
 * the frame stay fully opaque and crisp — only the outer rim ramps down to
 * nothing before the container edge, so the photo has no visible boundary but
 * is never dimmed or hazed.
 */
const HERO_IMAGE_MASK =
  "radial-gradient(118% 122% at 64% 41%, #000 52%, rgba(0,0,0,0.85) 72%, rgba(0,0,0,0.4) 85%, transparent 96%)";

/**
 * Page tone feathered back over the outermost rim only (transparent through
 * the whole body of the photo), so the very edge lands in the site's
 * `indigo-50 → white` background and the seam disappears.
 */
const HERO_IMAGE_SEAM =
  "radial-gradient(88% 92% at 62% 42%, rgba(243,244,252,0) 70%, rgba(244,245,252,0.45) 90%, rgba(245,246,252,0.9) 100%)," +
  "linear-gradient(to right, #eef2ff 0%, rgba(238,242,255,0.28) 10%, rgba(238,242,255,0) 26%)," +
  "linear-gradient(to bottom, rgba(255,255,255,0) 74%, #ffffff 100%)";

/** Shared shell + label style for the three floating stat cards. */
const HERO_CARD_SHELL =
  "w-[212px] rounded-2xl bg-white p-4 shadow-[0_16px_40px_-10px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.04] transition-transform duration-300 hover:-translate-y-1";
/** Same shell with tighter vertical padding — used by the two slimmer cards. */
const HERO_CARD_SHELL_COMPACT = `${HERO_CARD_SHELL} !py-3`;
const HERO_CARD_LABEL = "text-[11px] font-semibold text-slate-500";

/**
 * Advances through the hero slides on a fixed interval. Pauses while the tab is
 * hidden (so the sequence doesn't jump on return) and stays on the first slide
 * for visitors who prefer reduced motion.
 */
function useHeroRotator(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count <= 1) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [count, intervalMs]);

  return index;
}

/**
 * Counts a number up to `target` for a lively feel.
 *
 * The state is seeded with `target`, not 0, on purpose. The hero unmounts and
 * remounts on client-side navigation back to the home route, and
 * `requestAnimationFrame` is paused in a backgrounded tab — so a count-up that
 * started at 0 and never got a frame to run would leave the cards sitting empty
 * until a hard refresh (the bug this guards against). The animation only
 * rewinds to 0 when it can actually play (visible tab, motion allowed); a
 * `setTimeout` still lands the final value if rAF is throttled mid-run.
 */
function useCountUp(target: number, durationMs = 1400, decimals = 0) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    const canAnimate =
      !document.hidden &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!canAnimate) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    // First tick runs at progress ~0, so the count-up visibly starts from 0.
    frame = requestAnimationFrame(tick);
    const settle = window.setTimeout(() => setValue(target), durationMs + 400);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, durationMs]);

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value);
}

/** Small upward chevron used by the "improvement" lines. */
function UpTick({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

/** Faint circled "i" that sits beside a card label, mirroring the product UI. */
function InfoDot({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={`${className} text-slate-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5v4.5M12 8h.01" />
    </svg>
  );
}

/** Descending trend glyph used by the "weakest chapter" marker. */
function TrendDown({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8m0 0h-5m5 0v-5" />
    </svg>
  );
}

/** Score-trajectory across the aspirant's last four mock tests. */
function ScoreTrendCard({ delta }: { delta: number }) {
  // Four most-recent scaled scores; the card reads as a steady climb.
  const marks = [548, 571, 604, 637];
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  const pts = marks.map((m, i) => ({
    x: 14 + (i * 152) / (marks.length - 1),
    y: 30 - ((m - min) / (max - min)) * 24,
    m,
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    `M${pts[0].x},36 ` +
    pts.map((p) => `L${p.x},${p.y} `).join("") +
    `L${pts[pts.length - 1].x},36 Z`;

  return (
    <div className={`${HERO_CARD_SHELL_COMPACT} relative overflow-hidden`}>
      <div className="flex items-center gap-1">
        <p className={HERO_CARD_LABEL}>Score Trend</p>
        <InfoDot />
      </div>
      <p className="mt-0.5 flex items-center gap-1 font-sans text-[18px] font-extrabold leading-none tracking-tight text-emerald-600">
        <UpTick className="h-3.5 w-3.5" />+{delta} Marks
      </p>
      <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">Over last 3 tests</p>
      <div className="pointer-events-none mt-1 h-[26px] w-full">
        <svg viewBox="0 0 180 38" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="heroTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#heroTrendGrad)" />
          <polyline
            points={line}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => {
            const last = i === pts.length - 1;
            return (
              <g key={p.m}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={last ? 3 : 2.2}
                  fill="#fff"
                  stroke={last ? "#4338ca" : "#818cf8"}
                  strokeWidth="1.6"
                />
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight={last ? 800 : 600}
                  fill={last ? "#4338ca" : "#94a3b8"}
                >
                  {p.m}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function AccuracyCard({ accuracy }: { accuracy: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (accuracy / 100) * circumference;

  return (
    <div className={HERO_CARD_SHELL}>
      <p className={HERO_CARD_LABEL}>Accuracy</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div>
          <span className="font-sans text-[30px] font-extrabold leading-none tracking-tight text-slate-900">
            {accuracy}%
          </span>
          <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
            <UpTick className="h-3 w-3" />
            12% Improvement
          </p>
        </div>
        {/* Open ring gauge */}
        <div className="relative h-[46px] w-[46px] shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="#ede9fe" strokeWidth="5" />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function WeakestChapterCard({ marksLost }: { marksLost: number }) {
  return (
    <div className={HERO_CARD_SHELL_COMPACT}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1">
          <p className={HERO_CARD_LABEL}>Weakest Chapter</p>
          <InfoDot />
        </div>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
          <TrendDown className="h-2.5 w-2.5" />
        </span>
      </div>
      <div className="mt-0.5 font-sans text-[13px] font-extrabold leading-[1.05] text-slate-900">
        Physics
        <br />
        Kinematics
      </div>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-[11px] font-semibold text-rose-500">Marks Lost</span>
        <span className="font-sans text-[17px] font-extrabold leading-none text-rose-500">{marksLost}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-1000 ease-out"
          style={{ width: "76%" }}
        />
      </div>
    </div>
  );
}

/* ── Shared hero chrome (identical across every slide) ────────────────────── */

function HeroBadge() {
  return (
    <div className="mb-3.5 sm:mb-4 inline-flex items-center gap-2 rounded-full bg-[#ede9fe] border border-indigo-200/70 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-[#4338ca] shadow-xs">
      <span className="text-xs text-[#4338ca]">✦</span>
      <span>Data. Strategy. Better Scores.</span>
    </div>
  );
}

function HeroCtas({
  onOpenAuth,
  className = "",
}: {
  onOpenAuth: HeroProps["onOpenAuth"];
  className?: string;
}) {
  return (
    <div
      className={`mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto ${className}`}
    >
      <button
        onClick={() => onOpenAuth("login")}
        className="group flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#2e26cf] hover:bg-[#251eb8] bg-gradient-to-r from-[#3b32e6] to-[#2e26cf] px-5 sm:px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 active:scale-[0.98]"
        id="hero-dashboard-btn"
      >
        {/* 4-square grid icon */}
        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
        </svg>
        <span>View Your Dashboard</span>
        <svg
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>

      <button
        onClick={() => onOpenAuth("join")}
        className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 sm:px-6 py-3 text-sm font-bold text-slate-900 shadow-xs transition-all duration-200 active:scale-[0.98]"
        id="hero-analyze-btn"
      >
        {/* Scan / viewfinder icon */}
        <svg className="h-4 w-4 text-slate-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
        </svg>
        <span>Analyze Your Last Test</span>
      </button>
    </div>
  );
}

function HeroSocialProof({ className = "" }: { className?: string }) {
  return (
    <div className={`mt-5 sm:mt-6 flex items-center gap-3 ${className}`}>
      <div className="flex -space-x-2.5 shrink-0">
        {/* Avatar 1 */}
        <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full border-2 border-white shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
            alt="Student"
            className="h-full w-full object-cover"
          />
        </div>
        {/* Avatar 2 */}
        <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full border-2 border-white shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&h=120&q=80"
            alt="Student"
            className="h-full w-full object-cover"
          />
        </div>
        {/* Avatar 3 */}
        <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full border-2 border-white shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80"
            alt="Student"
            className="h-full w-full object-cover"
          />
        </div>
        {/* 50K+ Badge */}
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-white bg-[#ede9fe] text-[10px] sm:text-[10.5px] font-black text-[#4338ca] shadow-xs">
          50K+
        </div>
      </div>

      <p className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-snug text-left">
        Trusted by 50,000+ NEET Aspirants
        <br />
        <span className="text-slate-500 font-normal">across India</span>
      </p>
    </div>
  );
}

/* ── Slide compositions ──────────────────────────────────────────────────── */

function SplitHero({
  slide,
  slideIndex,
  onOpenAuth,
  trendDelta,
  accuracy,
  marksLost,
}: {
  slide: HeroSlide;
  slideIndex: number;
  onOpenAuth: HeroProps["onOpenAuth"];
  trendDelta: number;
  accuracy: number;
  marksLost: number;
}) {
  return (
    <div className="grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8 min-h-[420px] lg:min-h-[470px]">
      {/* Left Column: Headline, subtext, CTAs, Social Proof */}
      <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
        <HeroBadge />

        {/* Main Title — rotates with the active slide */}
        <div key={`heading-${slide.id}`} className="w-full animate-hero-rise">
          {slide.heading}
        </div>

        {/* Subtitle — rotates with the active slide */}
        <p
          key={`desc-${slide.id}`}
          className="mt-3.5 sm:mt-4 max-w-lg text-sm sm:text-base font-normal leading-relaxed text-slate-600 animate-hero-rise"
          style={{ animationDelay: "60ms" }}
        >
          {slide.description}
        </p>

        <HeroCtas onOpenAuth={onOpenAuth} />
        <HeroSocialProof />

        {/* Mobile / Tablet: Infinite Auto-Scrollable Row (< lg) — first slide only */}
        {slideIndex === 0 && (
          <div className="lg:hidden w-full overflow-hidden py-2.5 mt-6 -mx-4 sm:mx-0 select-none animate-fadeIn">
            <div className="animate-marquee-infinite flex items-center gap-3.5">
              {/* Track Set 1 */}
              <div className="flex items-center gap-3.5 shrink-0">
                <ScoreTrendCard delta={trendDelta} />
                <AccuracyCard accuracy={accuracy} />
                <WeakestChapterCard marksLost={marksLost} />
              </div>
              {/* Track Set 2 (Duplicated for infinite seamless loop) */}
              <div className="flex items-center gap-3.5 shrink-0">
                <ScoreTrendCard delta={trendDelta} />
                <AccuracyCard accuracy={accuracy} />
                <WeakestChapterCard marksLost={marksLost} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Visual + Floating Analytics Cards (Desktop >= 1024px) */}
      <div className="hidden lg:flex lg:col-span-6 relative w-full h-[470px] xl:h-[510px] items-center">
        {/* Expansive Background NEET Aspirant Photo layer */}
        <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ maskImage: HERO_IMAGE_MASK, WebkitMaskImage: HERO_IMAGE_MASK }}
          >
            {HERO_SLIDES.map((s, i) =>
              s.image ? (
                <Image
                  key={s.id}
                  src={s.image}
                  alt={i === slideIndex ? s.imageAlt ?? "" : ""}
                  fill
                  priority={i === 0}
                  sizes="55vw"
                  className="object-cover transition-opacity duration-700 ease-out"
                  style={{
                    opacity: i === slideIndex ? 1 : 0,
                    objectPosition: s.imagePosition ?? "66% 16%",
                    filter: s.imageFilter,
                  }}
                />
              ) : null,
            )}
          </div>
          {/* Seam sealer — see HERO_IMAGE_SEAM. */}
          <div className="absolute inset-0" style={{ background: HERO_IMAGE_SEAM }} />
        </div>

        {/* 3 Floating Cards (Desktop) — shown only on the first slide. */}
        <div
          className={`relative z-20 flex flex-col justify-center gap-5 -ml-14 xl:-ml-24 transition-opacity duration-700 ease-out ${
            slideIndex === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={slideIndex !== 0}
        >
          <div className="animate-float" style={{ animationDelay: "0s" }}>
            <ScoreTrendCard delta={trendDelta} />
          </div>

          <div className="animate-float" style={{ animationDelay: "0.8s" }}>
            <AccuracyCard accuracy={accuracy} />
          </div>

          <div className="animate-float" style={{ animationDelay: "1.6s" }}>
            <WeakestChapterCard marksLost={marksLost} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CenteredHero({
  slide,
  onOpenAuth,
}: {
  slide: HeroSlide;
  onOpenAuth: HeroProps["onOpenAuth"];
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center py-4 text-center min-h-[420px] lg:min-h-[470px] justify-center">
      <HeroBadge />

      {/* Headline — rotates with the active slide, flanked by spark marks */}
      <div key={`heading-${slide.id}`} className="relative mt-3 w-full animate-hero-rise">
        <SparkBurst className="absolute -left-9 top-0 hidden h-8 w-8 text-[#8b7bfd] md:block lg:-left-14" />
        <SparkBurst flip className="absolute -right-9 top-0 hidden h-8 w-8 text-[#8b7bfd] md:block lg:-right-14" />
        {slide.heading}
      </div>

      {/* Sub-copy — rotates with the active slide */}
      <div key={`desc-${slide.id}`} className="mt-4 max-w-xl animate-hero-rise" style={{ animationDelay: "60ms" }}>
        {slide.description}
      </div>

      <HeroCtas onOpenAuth={onOpenAuth} className="sm:justify-center" />

      {slide.features && (
        <div
          key={`features-${slide.id}`}
          className="mt-7 hidden w-full items-stretch justify-center divide-x divide-slate-200 sm:flex animate-hero-rise"
          style={{ animationDelay: "120ms" }}
        >
          {slide.features.map((f) => (
            <div key={f.title} className="flex items-center gap-3 px-5 lg:px-7">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-[#4338ca]">
                {f.icon}
              </span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900">{f.title}</div>
                <div className="text-xs font-normal text-slate-500">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <HeroSocialProof className="justify-center" />

      {slide.annotations && (
        <>
          <Annotation text="Better Analysis" side="left" />
          <Annotation text="Higher Scores" side="right" />
        </>
      )}
    </div>
  );
}

/** Fade the outgoing slide down and out, swap under cover of opacity 0, then
 *  ease the incoming slide back up. Keeps the structural split↔centered change
 *  invisible and gives the rotation a calm, production-grade crossfade. */
const HERO_FADE_OUT_MS = 240;

function useSlideCrossfade(rawIndex: number) {
  const [shownIndex, setShownIndex] = useState(rawIndex);
  const [targetIndex, setTargetIndex] = useState(rawIndex);
  const [fadingOut, setFadingOut] = useState(false);

  // Adjust state during render (not in an effect) the moment the rotator
  // advances — this starts the fade-out before the browser paints.
  if (rawIndex !== targetIndex) {
    setTargetIndex(rawIndex);
    setFadingOut(true);
  }

  useEffect(() => {
    if (!fadingOut) return;
    const swap = setTimeout(() => {
      setShownIndex(targetIndex);
      setFadingOut(false);
    }, HERO_FADE_OUT_MS);
    return () => clearTimeout(swap);
  }, [fadingOut, targetIndex]);

  return { shownIndex, fadingOut };
}

export function Hero({ onOpenAuth }: HeroProps) {
  const trendDelta = useCountUp(33, 1400);
  const accuracy = useCountUp(82, 1400);
  const marksLost = useCountUp(18, 1400);

  const rawIndex = useHeroRotator(HERO_SLIDES.length, HERO_ROTATE_INTERVAL_MS);
  const { shownIndex: slideIndex, fadingOut } = useSlideCrossfade(rawIndex);
  const slide = HERO_SLIDES[slideIndex];
  const isCentered = slide.layout === "centered";

  const rotatorStyle: CSSProperties = {
    opacity: fadingOut ? 0 : 1,
    transform: fadingOut ? "translate3d(0,6px,0) scale(0.992)" : "translate3d(0,0,0) scale(1)",
    transition: fadingOut
      ? `opacity ${HERO_FADE_OUT_MS}ms cubic-bezier(0.4,0,1,1), transform ${HERO_FADE_OUT_MS}ms cubic-bezier(0.4,0,1,1)`
      : "opacity 520ms cubic-bezier(0.22,1,0.36,1), transform 520ms cubic-bezier(0.22,1,0.36,1)",
    willChange: "opacity, transform",
  };
  const decorStyle: CSSProperties = {
    opacity: fadingOut ? 0 : 0.4,
    transition: "opacity 300ms ease",
  };

  return (
    <section id="home" className="relative w-full max-w-full overflow-hidden bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white pt-4 sm:pt-6 lg:pt-8 pb-1 sm:pb-2">

      {/* Below lg the hero is copy-only — no photo — so the headline and CTAs
          carry the section on small screens. The desktop visual lives inside
          SplitHero's right column (hidden below lg). */}

      {/* Decorative dot matrix — split slide keeps the single centre-top block;
          centered slides get a matched pair tucked into opposite corners. */}
      {isCentered ? (
        <>
          <div
            className="pointer-events-none absolute left-6 top-10 hidden lg:grid grid-cols-5 gap-2.5 z-0"
            style={decorStyle}
            aria-hidden="true"
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            ))}
          </div>
          <div
            className="pointer-events-none absolute right-6 bottom-10 hidden lg:grid grid-cols-5 gap-2.5 z-0"
            style={decorStyle}
            aria-hidden="true"
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            ))}
          </div>
        </>
      ) : (
        <div
          className="pointer-events-none absolute left-[44%] top-6 hidden lg:grid grid-cols-4 gap-2 z-0"
          style={decorStyle}
          aria-hidden="true"
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div style={rotatorStyle}>
          {isCentered ? (
            <CenteredHero slide={slide} onOpenAuth={onOpenAuth} />
          ) : (
            <SplitHero
              slide={slide}
              slideIndex={slideIndex}
              onOpenAuth={onOpenAuth}
              trendDelta={Number(trendDelta)}
              accuracy={Number(accuracy)}
              marksLost={Number(marksLost)}
            />
          )}
        </div>

        {/* Scroll Cue (Centered between hero content and stats banner) */}
        <div className="relative z-10 flex justify-center pt-2 pb-1">
          <button
            onClick={() => document.getElementById("stats-strip")?.scrollIntoView({ behavior: "smooth" })}
            className="group flex cursor-pointer flex-col items-center gap-1 text-slate-600 transition-colors hover:text-[#3238e8]"
          >
            <span className="flex flex-col items-center gap-1" style={{ opacity: fadingOut ? 0 : 1, transition: "opacity 300ms ease" }}>
            {isCentered ? (
              <>
                <svg className="h-4 w-4 text-[#3238e8] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[11.5px] font-semibold text-slate-700 transition-colors group-hover:text-[#3238e8]">
                  Scroll down to explore
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-700 group-hover:text-[#3238e8] transition-colors">
                  {/* Mouse Icon */}
                  <svg className="h-3.5 w-3.5 text-slate-700 group-hover:text-[#3238e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="6" y="3" width="12" height="18" rx="6" strokeLinecap="round" />
                    <line x1="12" y1="7" x2="12" y2="10" strokeLinecap="round" />
                  </svg>
                  <span>Scroll down to discover the strategy</span>
                </div>
                <svg className="h-3.5 w-3.5 text-[#3238e8] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
            </span>
          </button>
        </div>

      </div>
    </section>
  );
}
