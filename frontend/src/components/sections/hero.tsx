"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";

interface HeroProps {
  onOpenAuth: (type: "login" | "join") => void;
}

interface HeroSlide {
  id: number;
  heading: ReactNode;
  description: ReactNode;
  /** Right-column visual. Local path or whitelisted remote host (see next.config.ts). */
  image: string;
  imageAlt: string;
  /** Desktop bleed-layer object-position. Defaults to "66% 16%". Override when a
   *  slide's artwork isn't centred in its frame (e.g. an illustration whose
   *  subject sits to one side). */
  imagePosition?: string;
  /** Optional CSS filter for the desktop bleed layer — used to keep pale
   *  line-art readable once it is blended into the page. */
  imageFilter?: string;
}

/**
 * Rotating hero narrative. The left copy (heading + description) and the
 * right-column visual advance together on an interval; everything else in the
 * hero (badge, CTAs, social proof, floating cards) stays fixed.
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 0,
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
    heading: (
      <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
        Every mark has a <span className="text-[#5a4bfc]">strategy</span> —but <span className="text-[#5a4bfc]">not everyone</span> improves.
      </h1>
    ),
    description:
      "Most students don't need to stop losing marks, they need to stop losing them the same way every test.",
    image: "/hero_image_04.png",
    imageAlt: "NEET aspirant overwhelmed by physics, chemistry, biology and mock-test papers",
  },
  {
    id: 2,
    heading: (
      <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
        Hard work isn&apos;t <br className="hidden md:inline" /> enough.{" "}
        <span className="text-[#5a4bfc]">Plug the leaks.</span> <br />
        <span className="text-[#5a4bfc]">Reclaim every mark.</span>
      </h1>
    ),
    description:
      "Review test summaries driven by objective metrics to isolate avoidable careless mistakes.",
    image: "/hero_image01.png",
    imageAlt: "Marks leaking from a vessel through silly mistakes, poor time management and weak revision",
    // The artwork lives in the right ~55% of the frame (left half is blank),
    // so anchor hard-right: fills the height with zero letterbox and keeps
    // every callout label in view. Pale glass line-art, so bump contrast a
    // little to survive being blended into the page.
    imagePosition: "100% 50%",
    imageFilter: "contrast(1.15) saturate(1.08)",
  },
  {
    id: 3,
    heading: (
      <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
        What if your mock test <br className="hidden md:inline" /> could talk... <br />
        <span className="text-[#5a4bfc]">...and tell you exactly</span> <br />
        <span className="text-[#5a4bfc]">how to prepare next?</span>
      </h1>
    ),
    description: "Translate every single error into an actionable preparation checklist item.",
    image: "/hero_image02.png",
    imageAlt: "Analytics dashboard turning mock-test data into weak topics and next steps",
  },
  {
    id: 4,
    heading: (
      <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
        Not just analytics. <span className="text-[#5a4bfc]">Action.</span> <br />
        <span className="text-[#5a4bfc]">Consistent Improvement.</span>
      </h1>
    ),
    description:
      "Knowing where you slip is only the start. Fixing those parameters is what builds the rank.",
    image: "/hero_image03.png",
    imageAlt: "Rocket climbing from mock test 1 to a dream score through consistent action",
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

function ScorePredictionCard({ score }: { score: number }) {
  return (
    <div className={`${HERO_CARD_SHELL} relative overflow-hidden`}>
      <p className={HERO_CARD_LABEL}>Score Prediction</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-sans text-[30px] font-extrabold leading-none tracking-tight text-slate-900">
          {score}
        </span>
        <span className="text-[13px] font-medium text-slate-400">/720</span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
        <UpTick className="h-3 w-3" />
        33 Marks
      </p>
      {/* Rising area chart, tucked into the lower-right corner */}
      <div className="pointer-events-none absolute bottom-3 right-3 h-[44px] w-[116px]">
        <svg viewBox="0 0 116 44" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="heroScoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 34 L14 30 L26 32 L40 22 L52 25 L66 15 L80 18 L94 8 L116 3 L116 44 L0 44 Z"
            fill="url(#heroScoreGrad)"
          />
          <path
            d="M0 34 L14 30 L26 32 L40 22 L52 25 L66 15 L80 18 L94 8 L116 3"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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

function WeakestChapterCard({ weakest }: { weakest: number }) {
  return (
    <div className={HERO_CARD_SHELL}>
      <p className={HERO_CARD_LABEL}>Weakest Chapter</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="leading-tight">
          <div className="font-sans text-[15px] font-extrabold text-slate-900">Physics</div>
          <div className="mt-0.5 text-[12px] font-normal text-slate-500">Mechanics</div>
        </div>
        <span className="text-[12px] font-bold text-rose-500">{weakest}%</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-1000 ease-out"
          style={{ width: `${weakest}%` }}
        />
      </div>
    </div>
  );
}

export function Hero({ onOpenAuth }: HeroProps) {
  const score = useCountUp(645, 1400);
  const accuracy = useCountUp(82, 1400);
  const weakest = useCountUp(58, 1400);

  const slideIndex = useHeroRotator(HERO_SLIDES.length, HERO_ROTATE_INTERVAL_MS);
  const slide = HERO_SLIDES[slideIndex];

  return (
    <section id="home" className="relative w-full max-w-full overflow-hidden bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white pt-4 sm:pt-6 lg:pt-8 pb-1 sm:pb-2">
      
      {/* Small Screen Background Image Layer (< lg) — crossfades with the active slide */}
      <div className="lg:hidden pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
        {HERO_SLIDES.map((s, i) => (
          <Image
            key={s.id}
            src={s.image}
            alt=""
            aria-hidden
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover object-[75%_20%] transition-opacity duration-700 ease-out"
            style={{ opacity: i === slideIndex ? (slideIndex === 0 ? 0.15 : 0.22) : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 via-transparent to-white" />
      </div>

      {/* Decorative dot matrix grid (Visible on large screens) */}
      <div className="pointer-events-none absolute left-[44%] top-6 hidden lg:grid grid-cols-4 gap-2 opacity-40 z-0" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        ))}
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8 min-h-[420px] lg:min-h-[470px]">
          
          {/* Left Column: Headline, subtext, CTAs, Social Proof */}
          <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
            
            {/* Pill Badge */}
            <div className="mb-3.5 sm:mb-4 inline-flex items-center gap-2 rounded-full bg-[#ede9fe] border border-indigo-200/70 px-3.5 sm:px-4 py-1.5 text-xs font-bold text-[#4338ca] shadow-xs">
              <span className="text-xs text-[#4338ca]">✦</span>
              <span>Data. Strategy. Better Scores.</span>
            </div>

            {/* Main Title — rotates with the active slide (exact responsive typography preserved) */}
            <div key={`heading-${slide.id}`} className="w-full animate-fadeIn">
              {slide.heading}
            </div>

            {/* Subtitle — rotates with the active slide */}
            <p
              key={`desc-${slide.id}`}
              className="mt-3.5 sm:mt-4 max-w-lg text-sm sm:text-base font-normal leading-relaxed text-slate-600 animate-fadeIn"
            >
              {slide.description}
            </p>

            {/* Action Buttons */}
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
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
                <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
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

            {/* Social Proof */}
            <div className="mt-5 sm:mt-6 flex items-center gap-3">
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

              <p className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-snug">
                Trusted by 50,000+ NEET Aspirants
                <br />
                <span className="text-slate-500 font-normal">across India</span>
              </p>
            </div>

            {/* Mobile / Tablet: Infinite Auto-Scrollable Row (< lg) — first slide only */}
            {slideIndex === 0 && (
              <div className="lg:hidden w-full overflow-hidden py-2.5 mt-6 -mx-4 sm:mx-0 select-none animate-fadeIn">
                <div className="animate-marquee-infinite flex items-center gap-3.5">
                  {/* Track Set 1 */}
                  <div className="flex items-center gap-3.5 shrink-0">
                    <ScorePredictionCard score={Number(score)} />
                    <AccuracyCard accuracy={Number(accuracy)} />
                    <WeakestChapterCard weakest={Number(weakest)} />
                  </div>
                  {/* Track Set 2 (Duplicated for infinite seamless loop) */}
                  <div className="flex items-center gap-3.5 shrink-0">
                    <ScorePredictionCard score={Number(score)} />
                    <AccuracyCard accuracy={Number(accuracy)} />
                    <WeakestChapterCard weakest={Number(weakest)} />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Visual + Floating Analytics Cards (Expansive layout on Desktop >= 1024px) */}
          <div className="hidden lg:flex lg:col-span-6 relative w-full h-[470px] xl:h-[510px] items-center">
            
            {/* Expansive Background NEET Aspirant Photo layer */}
            <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
              {/* Photo, dissolved into the page by a soft edgeless vignette. */}
              <div
                className="absolute inset-0"
                style={{ maskImage: HERO_IMAGE_MASK, WebkitMaskImage: HERO_IMAGE_MASK }}
              >
                {HERO_SLIDES.map((s, i) => (
                  <Image
                    key={s.id}
                    src={s.image}
                    alt={i === slideIndex ? s.imageAlt : ""}
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
                ))}
              </div>
              {/* Seam sealer — see HERO_IMAGE_SEAM. */}
              <div className="absolute inset-0" style={{ background: HERO_IMAGE_SEAM }} />
            </div>

            {/* 3 Floating Cards (Desktop) — shown only on the first slide; the
                later slides tell their story through the photo alone, so the
                cards fade out and pull left to keep the aspirant in full view. */}
            <div
              className={`relative z-20 flex flex-col justify-center gap-5 -ml-14 xl:-ml-24 transition-opacity duration-700 ease-out ${
                slideIndex === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={slideIndex !== 0}
            >
              <div className="animate-float" style={{ animationDelay: "0s" }}>
                <ScorePredictionCard score={Number(score)} />
              </div>

              <div className="animate-float" style={{ animationDelay: "0.8s" }}>
                <AccuracyCard accuracy={Number(accuracy)} />
              </div>

              <div className="animate-float" style={{ animationDelay: "1.6s" }}>
                <WeakestChapterCard weakest={Number(weakest)} />
              </div>
            </div>

          </div>

        </div>

        {/* Scroll Cue (Centered between hero content and stats banner with tight compact spacing) */}
        <div className="relative z-10 flex justify-center pt-2 pb-1">
          <button
            onClick={() => document.getElementById("stats-strip")?.scrollIntoView({ behavior: "smooth" })}
            className="group flex cursor-pointer flex-col items-center gap-1 text-slate-600 transition-colors hover:text-[#3238e8]"
          >
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
          </button>
        </div>

      </div>
    </section>
  );
}
