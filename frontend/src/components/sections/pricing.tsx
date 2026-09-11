"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconTarget,
  IconChart,
  IconUsers,
  IconShield,
  IconArrowRight,
  IconRocket,
  IconGraduationCap,
} from "../common/UIComponents";
import { planService, type Plan } from "../../services/apiServices";

interface PricingProps {
  onOpenAuth: (type: "login" | "join", planKey?: string) => void;
}

const IconSprout = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V12M12 12C12 8 9 5 4 5c0 5 3 7 8 7zM12 12c0-3 2-6 8-6 0 4-3 6-8 6z" />
  </svg>
);

const IconTrophy = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 5H4a1 1 0 00-1 1v1a4 4 0 004 4M17 5h3a1 1 0 011 1v1a4 4 0 01-4 4" />
  </svg>
);

/**
 * Default feature list — used when a plan carries no bullets of its own.
 * Kept in sync with the backend seed (`backend/scripts/seedPublicPlansAndBatches.js`
 * → `PLAN_FEATURES`) so the static fallback and the live catalog render the same
 * bullets and the cards don't visibly re-flow once the request resolves.
 */
const PLAN_FEATURES = [
  "NCERT-Aligned Coverage",
  "Filtered Practice at NEET Level",
  "Gradual Syllabus Coverage",
  "Recoverable Marks Identified",
  "Detailed Analytics for Every Test",
  "Self-Reflective Tests to Improve",
];

/** The value row under the cards. */
const VALUE_PROPS = [
  { icon: IconTarget, title: "Exam-focused", sub: "Designed for real results." },
  { icon: IconChart, title: "Actionable insights", sub: "Know where you stand. Improve faster." },
  { icon: IconUsers, title: "Trusted by aspirants", sub: "Join thousands on their NEET journey." },
  { icon: IconShield, title: "Flexible & hassle-free", sub: "Upgrade anytime." },
];

type PlanTheme = {
  name: string;
  iconWrap: string;
  badge: string;
  check: string;
  price: string;
  cta: string;
  ring: string;
  statBar: string;
};
type PlanIcon = typeof IconRocket;

type PlanCard = {
  key: string;
  name: string;
  eyebrow: string;
  badge: string;
  tagline: string;
  icon: PlanIcon;
  priceRupees: number;
  mrpRupees: number | null;
  isAnnual: boolean;
  stats: { minor: number; semi: number; major: number; total: number } | null;
  features: string[];
  theme: PlanTheme;
  highlighted: boolean;
};

const THEME_SLATE: PlanTheme = {
  name: "text-slate-900", iconWrap: "bg-slate-100 text-slate-500", badge: "bg-slate-100 text-slate-600",
  check: "text-slate-400", price: "text-slate-900", cta: "bg-slate-900 hover:bg-slate-800",
  ring: "ring-slate-200", statBar: "bg-slate-50/70",
};
const THEME_EMERALD: PlanTheme = {
  name: "text-emerald-600", iconWrap: "bg-emerald-50 text-emerald-600", badge: "bg-emerald-50 text-emerald-700",
  check: "text-emerald-500", price: "text-emerald-600", cta: "bg-emerald-600 hover:bg-emerald-700",
  ring: "ring-emerald-300", statBar: "bg-emerald-50/60",
};
const THEME_BLUE: PlanTheme = {
  name: "text-blue-600", iconWrap: "bg-blue-50 text-blue-600", badge: "bg-blue-50 text-blue-700",
  check: "text-blue-500", price: "text-blue-600", cta: "bg-blue-600 hover:bg-blue-700",
  ring: "ring-blue-300", statBar: "bg-blue-50/60",
};
const THEME_VIOLET: PlanTheme = {
  name: "text-violet-600", iconWrap: "bg-violet-50 text-violet-600", badge: "bg-violet-50 text-violet-700",
  check: "text-violet-500", price: "text-violet-600", cta: "bg-violet-600 hover:bg-violet-700",
  ring: "ring-violet-300", statBar: "bg-violet-50/60",
};

const PROGRAM_META: Record<string, { icon: PlanIcon; badge: string; eyebrow: string; theme: PlanTheme }> = {
  class_xi:  { icon: IconSprout,        badge: "For Class 11",  eyebrow: "Core",   theme: THEME_EMERALD },
  class_xii: { icon: IconChart,         badge: "For Class 12",  eyebrow: "Prime",  theme: THEME_BLUE },
  dropper:   { icon: IconGraduationCap, badge: "For Droppers",  eyebrow: "Elite",  theme: THEME_VIOLET },
};

const FALLBACK_META = [
  { icon: IconRocket, theme: THEME_EMERALD },
  { icon: IconTrophy, theme: THEME_BLUE },
  { icon: IconChart, theme: THEME_VIOLET },
];

const inr = (n: number) => n.toLocaleString("en-IN");
const perMonth = (yearly: number) => Math.round(yearly / 12);

/** Turn the live plan catalog into ordered pricing cards (cheapest first). */
function shapeCatalog(raw: Plan[]): PlanCard[] {
  return raw
    .filter((p) => p.priceRupees > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.priceRupees - b.priceRupees)
    .map((p, i) => {
      const meta = (p.programType && PROGRAM_META[p.programType]) || null;
      const fb = FALLBACK_META[i % FALLBACK_META.length];
      const bk = p.examBreakdown;
      const bkTotal = bk ? bk.minor + bk.semiMajor + bk.major : 0;
      const isEntry = i === 0 && !meta;
      return {
        key: p.key,
        name: p.name.toUpperCase(),
        eyebrow: (meta?.eyebrow || (isEntry ? "Starter" : "Signature")).toUpperCase(),
        badge: meta?.badge || (isEntry ? "Get Started" : p.tagline || "SIGNATURE"),
        tagline: isEntry ? "Experience the Exam Neeti difference." : p.tagline || "",
        icon: meta?.icon || fb.icon,
        priceRupees: p.priceRupees,
        mrpRupees: p.mrpRupees && p.mrpRupees > p.priceRupees ? p.mrpRupees : null,
        isAnnual: p.durationDays != null && p.durationDays >= 300,
        stats: bkTotal > 0
          ? { minor: bk!.minor, semi: bk!.semiMajor, major: bk!.major, total: bkTotal }
          : p.testsIncluded > 0
            ? { minor: 0, semi: 0, major: 0, total: p.testsIncluded }
            : null,
        features: p.features?.length ? p.features : PLAN_FEATURES,
        theme: meta?.theme || (isEntry ? THEME_SLATE : fb.theme),
        highlighted: Boolean(p.featured),
      };
    });
}

// Static fallback shown while the catalog loads or if the request fails.
const FALLBACK = shapeCatalog([
  { key: "signature_entry", name: "Signature Entry", priceRupees: 149, durationDays: null, testsIncluded: 2, tagline: "Experience the Exam Neeti difference.", featured: false, sortOrder: 1,
    features: ["2 Full-length Tests", "NEET-level practice", "Basic performance report", "Lifetime access — never expires", "Upgrade anytime"] },
  { key: "core",  name: "Core",  priceRupees: 1999, mrpRupees: 3588, durationDays: 365, testsIncluded: 16, programType: "class_xi",  tagline: "Build the strongest base.",            featured: false, sortOrder: 2, examBreakdown: { minor: 10, semiMajor: 2, major: 4 },  features: PLAN_FEATURES },
  { key: "prime", name: "Prime", priceRupees: 2599, mrpRupees: 4788, durationDays: 365, testsIncluded: 18, programType: "class_xii", tagline: "Strengthen concepts. Perform smarter.", featured: true,  sortOrder: 3, examBreakdown: { minor: 10, semiMajor: 2, major: 6 },  features: PLAN_FEATURES },
  { key: "elite", name: "Elite", priceRupees: 2999, mrpRupees: 5988, durationDays: 365, testsIncluded: 24, programType: "dropper",   tagline: "Maximize your potential.",              featured: false, sortOrder: 4, examBreakdown: { minor: 10, semiMajor: 2, major: 12 }, features: PLAN_FEATURES },
]);

export function Pricing({ onOpenAuth }: PricingProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollFrame = useRef<number | null>(null);

  const [PLANS, setPlans] = useState<PlanCard[]>(FALLBACK);
  const defaultIndex = useMemo(() => {
    const i = PLANS.findIndex((p) => p.highlighted);
    return i >= 0 ? i : Math.min(1, Math.max(0, PLANS.length - 1));
  }, [PLANS]);
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  // Load the live catalog; the static FALLBACK renders until it arrives.
  useEffect(() => {
    let cancelled = false;
    planService
      .listPlans()
      .then((res) => {
        const raw: Plan[] = res?.data?.plans || res?.plans || [];
        if (!cancelled && Array.isArray(raw) && raw.length) {
          const shaped = shapeCatalog(raw);
          if (shaped.length) setPlans(shaped);
        }
      })
      .catch(() => { /* keep FALLBACK */ });
    return () => { cancelled = true; };
  }, []);

  // Small screens: centre the highlighted plan in the carousel on mount.
  useEffect(() => {
    const track = trackRef.current;
    const defaultCard = cardRefs.current[defaultIndex];
    if (!track || !defaultCard) return;
    track.scrollLeft = defaultCard.offsetLeft + defaultCard.offsetWidth / 2 - track.clientWidth / 2;
    setActiveIndex(defaultIndex);
  }, [defaultIndex, PLANS.length]);

  const handleTrackScroll = () => {
    if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const trackCenter = track.scrollLeft + track.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Infinity;
      cardRefs.current.forEach((card, idx) => {
        if (!card) return;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - trackCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });
      setActiveIndex(closestIdx);
    });
  };

  const scrollToPlan = (idx: number) => {
    const track = trackRef.current;
    const card = cardRefs.current[idx];
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2, behavior: "smooth" });
  };

  return (
    <section id="pricing" className="relative bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white py-20 sm:py-24 px-4 sm:px-6 lg:px-8 w-full max-w-full">
      {/* Soft brand glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.28em] text-indigo-500">
          Our Signature Program
        </span>
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mt-4">
          Find your <span className="text-indigo-600">preparation path</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-500 leading-relaxed mt-4">
          Structured tests. Deeper insights. A stronger you.
        </p>
      </div>

      {/* Plan cards */}
      <div className="relative mx-auto max-w-7xl mt-12 sm:mt-14 xl:mt-28">
        {/* Hand-drawn margin notes (desktop only) */}
        <span className="pointer-events-none absolute -top-20 left-0 hidden xl:flex items-end gap-1.5 -rotate-6 text-[#6b5cf6]">
          <span className="font-script text-xl font-bold leading-tight">Start small.<br />Upgrade anytime.</span>
          <svg viewBox="0 0 40 48" className="h-11 w-8" fill="none">
            <path d="M22 4 C 10 14 8 30 14 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M6 34 L14 45 L24 38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="pointer-events-none absolute -top-24 right-0 hidden xl:flex items-end gap-1.5 rotate-6 text-[#6b5cf6]">
          <svg viewBox="0 0 40 48" className="h-11 w-8" fill="none">
            <path d="M18 4 C 30 14 32 30 26 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M34 34 L26 45 L16 38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-script text-xl font-bold leading-tight text-right">Same great value.<br />Pay less per month<br />over the year!</span>
        </span>

        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          style={{ ["--pcols" as string]: Math.min(Math.max(PLANS.length, 1), 4) }}
          className="flex overflow-x-auto scrollbar-none snap-x snap-mandatory gap-4 px-[9%] sm:px-[18%] -mx-4 sm:mx-0 lg:mx-0 lg:px-0 lg:grid lg:[grid-template-columns:repeat(var(--pcols),minmax(0,1fr))] lg:gap-5 xl:gap-6 lg:overflow-visible lg:snap-none"
        >
          {PLANS.map((plan, idx) => {
            const monthly = plan.isAnnual ? perMonth(plan.priceRupees) : plan.priceRupees;
            const mrpMonthly = plan.mrpRupees ? (plan.isAnnual ? perMonth(plan.mrpRupees) : plan.mrpRupees) : null;
            const pctOff = plan.mrpRupees ? Math.round((1 - plan.priceRupees / plan.mrpRupees) * 100) : null;
            const titleCase = plan.name.charAt(0) + plan.name.slice(1).toLowerCase();
            const isEntry = idx === 0;

            return (
              <div
                key={plan.key}
                ref={(el) => { cardRefs.current[idx] = el; }}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden shrink-0 w-[82%] sm:w-[64%] snap-center lg:w-auto lg:shrink lg:snap-align-none"
              >
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {/* <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{plan.eyebrow}</span> */}
                      <h3 className={`${plan.name.length > 9 ? "text-2xl sm:text-[26px] leading-tight" : "text-3xl sm:text-[32px] leading-none"} font-black tracking-tight mt-1.5 ${plan.theme.name}`}>
                        {plan.name}
                      </h3>
                      <span className={`inline-flex w-fit items-center mt-3 px-3 py-1 rounded-full text-[11px] font-bold ${plan.theme.badge}`}>
                        {plan.badge}
                      </span>
                    </div>
                    <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0 ${plan.theme.iconWrap}`}>
                      <plan.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mt-6">
                    {mrpMonthly && pctOff ? (
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold text-slate-400 line-through">₹{inr(mrpMonthly)}</span>
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-extrabold text-rose-600">
                          {pctOff}% OFF
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-end gap-1.5 mt-1">
                      <span className={`text-4xl sm:text-[42px] font-black tracking-tight leading-none ${plan.theme.price}`}>
                        ₹{inr(monthly)}
                      </span>
                      <span className="text-sm font-medium text-slate-400 pb-1">
                        {plan.isAnnual ? "/ month" : "one-time"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {plan.isAnnual ? `₹ ${inr(plan.priceRupees)} per year` : plan.tagline}
                    </p>
                  </div>

                  <div className="h-px bg-slate-100 my-5" />

                  {/* Features */}
                  <div className="space-y-3">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2.5 text-[13px] text-slate-600 leading-snug">
                        <IconCheck className={`w-4 h-4 mt-px shrink-0 ${plan.theme.check}`} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-7">
                    <button
                      onClick={() => onOpenAuth("join", plan.key)}
                      className={`w-full inline-flex items-center justify-center gap-2 text-sm font-bold px-5 py-3 rounded-xl transition-all cursor-pointer ${
                        isEntry
                          ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          : `text-white ${plan.theme.cta}`
                      }`}
                    >
                      <span>{isEntry ? "Start Now" : `Choose ${titleCase}`}</span>
                      <IconArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {plan.stats && (plan.stats.minor || plan.stats.semi || plan.stats.major) ? (
                  <div className={`grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100 ${plan.theme.statBar}`}>
                    {([
                      ["Minor Tests", plan.stats.minor],
                      ["Semi-Major", plan.stats.semi],
                      ["Major Tests", plan.stats.major],
                      ["Total Tests", plan.stats.total],
                    ] as [string, number][]).map(([label, value]) => (
                      <div key={label} className="text-center py-3 sm:py-4 px-1">
                        <div className="text-sm sm:text-base font-extrabold text-slate-900">{value}</div>
                        <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-semibold mt-0.5 leading-tight">{label}</div>
                      </div>
                    ))}
                  </div>
                ) : plan.stats ? (
                  <div className={`border-t border-slate-100 text-center py-4 px-1 ${plan.theme.statBar}`}>
                    <span className="text-base font-extrabold text-slate-900">{plan.stats.total}</span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-1.5">Total Tests</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Mobile-only: dot indicators for the carousel */}
        <div className="lg:hidden flex flex-col items-center gap-3 mt-6">
          <div className="flex items-center gap-2">
            {PLANS.map((plan, idx) => (
              <button
                key={plan.key}
                onClick={() => scrollToPlan(idx)}
                aria-label={`Show ${plan.name} plan`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activeIndex === idx ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <IconArrowRight className="w-3 h-3 rotate-180" />
            Swipe to see all plans
            <IconArrowRight className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* Value row */}
      <div className="relative mx-auto max-w-6xl mt-14 sm:mt-16 border-t border-slate-200/70 pt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUE_PROPS.map((v) => (
            <div key={v.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <v.icon className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-900">{v.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{v.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
