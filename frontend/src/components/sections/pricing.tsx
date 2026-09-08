"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconTarget,
  IconShield,
  IconChart,
  IconArrowRight,
  IconRocket,
} from "../common/UIComponents";
import { planService, type Plan } from "../../services/apiServices";

interface PricingProps {
  onOpenAuth: (type: "login" | "join", planKey?: string) => void;
}

const IconTrophy = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 5H4a1 1 0 00-1 1v1a4 4 0 004 4M17 5h3a1 1 0 011 1v1a4 4 0 01-4 4" />
  </svg>
);

const IconDiamond = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l3 5-9 13L3 8l3-5zM3 8h18M9 3l3 5-3 13M15 3l-3 5 3 13" />
  </svg>
);

const HERO_FEATURES = [
  { icon: IconShield, label: "NCERT-Aligned Tests" },
  { icon: IconChart, label: "Behavioral Analysis" },
  { icon: IconRocket, label: "Performance Analytics" },
  { icon: IconTarget, label: "Error Pattern Analysis" },
];

const ENTRY_FEATURES = [
  "1 Diagnostic Test",
  "Detailed Performance Analysis",
  "Subject & Chapter-wise Insights",
  "Actionable Improvement Areas",
];

const PLAN_FEATURES = [
  "NCERT-Aligned Coverage",
  "Filtered Practice at NEET Level",
  "Gradual Syllabus Coverage",
  "Recoverable Marks Identified",
  "Detailed Analytics for Every Test",
  "Self-Reflective Tests to Improve",
];

type PlanTheme = {
  name: string; iconWrap: string; badge: string; check: string; price: string; cta: string;
};
type PlanIcon = typeof IconRocket;
type PlanCard = {
  key: string;
  name: string;
  icon: PlanIcon;
  badge: string;
  tagline: string;
  price: string;
  stats: { minor: number; semi: number; major: number; total: number } | null;
  features: string[];
  theme: PlanTheme;
  highlighted: boolean;
};

const THEMES: PlanTheme[] = [
  { name: "text-emerald-600", iconWrap: "bg-emerald-50 text-emerald-600", badge: "bg-emerald-50 text-emerald-700", check: "text-emerald-500", price: "text-emerald-600", cta: "bg-emerald-600 hover:bg-emerald-700" },
  { name: "text-blue-600",    iconWrap: "bg-blue-50 text-blue-600",       badge: "bg-blue-50 text-blue-700",       check: "text-blue-500",    price: "text-blue-600",    cta: "bg-blue-600 hover:bg-blue-700" },
  { name: "text-violet-600",  iconWrap: "bg-violet-50 text-violet-600",   badge: "bg-violet-50 text-violet-700",   check: "text-violet-500",  price: "text-violet-600",  cta: "bg-violet-600 hover:bg-violet-700" },
];

const PROGRAM_META: Record<string, { icon: PlanIcon; badge: string; theme: PlanTheme }> = {
  class_xi:  { icon: IconRocket,  badge: "For Class 11th",  theme: THEMES[0] },
  class_xii: { icon: IconTrophy,  badge: "For Class 12th",  theme: THEMES[1] },
  dropper:   { icon: IconDiamond, badge: "For Droppers",    theme: THEMES[2] },
};

const inr = (n: number) => n.toLocaleString("en-IN");

const THEMES_ICON: PlanIcon[] = [IconRocket, IconTrophy, IconDiamond];

/** Turn the live plan catalog into the pricing-page shape, preserving the design. */
function shapeCatalog(raw: Plan[]): { cards: PlanCard[]; entry: { key: string; price: number; tagline: string; features: string[] } | null } {
  const paid = raw.filter((p) => p.priceRupees > 0);
  // "entry" = cheapest one-time paid plan (Signature Entry today) → the dark banner.
  const oneTime = paid
    .filter((p) => p.durationDays == null)
    .sort((a, b) => a.priceRupees - b.priceRupees);
  const entryPlan = oneTime[0] || null;
  const entrySlugs = new Set(oneTime.slice(0, 1).map((p) => p.key));

  const cards: PlanCard[] = paid
    .filter((p) => !entrySlugs.has(p.key))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.priceRupees - b.priceRupees)
    .map((p, i) => {
      const meta = (p.programType && PROGRAM_META[p.programType]) || null;
      const bk = p.examBreakdown;
      const bkTotal = bk ? bk.minor + bk.semiMajor + bk.major : 0;
      return {
        key: p.key,
        name: p.name.toUpperCase(),
        icon: meta?.icon || THEMES_ICON[i % 3],
        badge: meta?.badge || p.tagline || "SIGNATURE Plan",
        tagline: p.tagline || "",
        price: inr(p.priceRupees),
        stats: bkTotal > 0
          ? { minor: bk!.minor, semi: bk!.semiMajor, major: bk!.major, total: bkTotal }
          : p.testsIncluded > 0
            ? { minor: 0, semi: 0, major: 0, total: p.testsIncluded }
            : null,
        features: p.features?.length ? p.features : PLAN_FEATURES,
        theme: meta?.theme || THEMES[i % 3],
        highlighted: Boolean(p.featured),
      };
    });

  if (cards.length && !cards.some((c) => c.highlighted)) {
    cards[Math.min(1, cards.length - 1)].highlighted = true;
  }

  return {
    cards,
    entry: entryPlan
      ? {
          key: entryPlan.key,
          price: entryPlan.priceRupees,
          tagline: entryPlan.tagline || "Your first step into SIGNATURE.",
          features: entryPlan.features?.length ? entryPlan.features : ENTRY_FEATURES,
        }
      : null,
  };
}

// Static fallback shown while the catalog loads or if the request fails.
const FALLBACK = shapeCatalog([
  { key: "core",  name: "Core",  priceRupees: 1999, durationDays: 365, testsIncluded: 16, programType: "class_xi",  tagline: "Build the strongest base.",            featured: false, sortOrder: 2, examBreakdown: { minor: 10, semiMajor: 2, major: 4 },  features: PLAN_FEATURES },
  { key: "prime", name: "Prime", priceRupees: 2599, durationDays: 365, testsIncluded: 18, programType: "class_xii", tagline: "Strengthen concepts. Perform smarter.", featured: true,  sortOrder: 3, examBreakdown: { minor: 10, semiMajor: 2, major: 6 },  features: PLAN_FEATURES },
  { key: "elite", name: "Elite", priceRupees: 2999, durationDays: 365, testsIncluded: 24, programType: "dropper",   tagline: "Maximize your potential.",              featured: false, sortOrder: 4, examBreakdown: { minor: 10, semiMajor: 2, major: 12 }, features: PLAN_FEATURES },
  { key: "signature_entry", name: "Signature Entry", priceRupees: 149, durationDays: null, testsIncluded: 1, tagline: "Your first step into SIGNATURE.", featured: false, sortOrder: 1, features: ENTRY_FEATURES },
]);

export function Pricing({ onOpenAuth }: PricingProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollFrame = useRef<number | null>(null);

  const [catalog, setCatalog] = useState(FALLBACK);
  const PLANS = catalog.cards;
  const ENTRY = catalog.entry;
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
          if (shaped.cards.length) setCatalog(shaped);
        }
      })
      .catch(() => { /* keep FALLBACK */ });
    return () => { cancelled = true; };
  }, []);

  // Default view on small screens: center the highlighted plan, with the
  // others reachable by scrolling left/right. Sets the carousel's own
  // scrollLeft directly (never scrollIntoView) so mounting this section
  // can't drag the whole page's scroll position with it.
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
    const targetLeft = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
    track.scrollTo({ left: targetLeft, behavior: "smooth" });
  };

  return (
    <section id="pricing" className="relative bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden w-full max-w-full">
      {/* Soft brand glow — matches the hero and the standalone pages */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />

      {/* Decorative dot grid + plus (desktop only) */}
      <div className="hidden lg:grid absolute left-8 top-28 grid-cols-6 gap-2.5 opacity-60 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-200" />
        ))}
      </div>
      <svg className="hidden lg:block absolute right-10 top-16 w-14 h-14 text-indigo-100 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11 2h2v9h9v2h-9v9h-2v-9H2v-2h9V2z" />
      </svg>

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-600 text-[11px] sm:text-xs font-bold uppercase tracking-wide px-4 py-2">
          <span className="text-indigo-400">✦</span>
          SIGNATURE – The Complete NEET Prep System
        </span>
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mt-6">
          One Journey. <span className="text-indigo-600">SIGNATURE</span> Plans.
        </h2>
        <p className="text-sm sm:text-base text-slate-500 leading-relaxed mt-4">
          Structured prep. Smarter practice. Higher scores.
          <br className="hidden sm:block" />
          Pick the plan built for where you are in your NEET journey.
        </p>

        <div className="flex flex-wrap items-center justify-center border-b pb-10 gap-2.5 sm:gap-3.5 mt-8">
          {HERO_FEATURES.map((f) => (
            <div
              key={f.label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-sm"
            >
              <f.icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Signature Entry banner */}
      {ENTRY && (
      <div className="relative mx-auto max-w-6xl mt-12 sm:mt-14">
        <div className="bg-slate-950 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <IconTarget className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-[10.5px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Just want to know where you stand?
                </p>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                  SIGNATURE ENTRY
                </h3>
                <p className="text-xs text-slate-400 mt-1">{ENTRY.tagline}</p>
              </div>
            </div>

            <div className="hidden lg:block w-px self-stretch bg-white/10" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 flex-1">
              {ENTRY.features.map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-slate-200">
                  <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="hidden lg:block w-px self-stretch bg-white/10" />

            <div className="flex items-center justify-between lg:justify-end gap-5 sm:gap-6">
              <div className="text-left lg:text-right shrink-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-red-500 leading-none">₹{inr(ENTRY.price)}</div>
                <div className="text-[11px] text-slate-400 mt-1.5">One-time Access</div>
              </div>
              <button
                onClick={() => onOpenAuth("join", ENTRY.key)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all shrink-0 cursor-pointer"
              >
                <span>Start Now</span>
                <IconArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Plan cards — horizontal snap-scroll carousel below lg, N-col grid from lg up */}
      <div className="relative mx-auto max-w-7xl mt-8 sm:mt-10">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          style={{ ["--pcols" as string]: Math.min(Math.max(PLANS.length, 1), 4) }}
          className="flex overflow-x-auto scrollbar-none snap-x snap-mandatory gap-4 px-[9%] sm:px-[18%] -mx-4 sm:mx-0 lg:mx-0 lg:px-0 lg:grid lg:[grid-template-columns:repeat(var(--pcols),minmax(0,1fr))] lg:gap-6 xl:gap-8 lg:overflow-visible lg:snap-none"
        >
          {PLANS.map((plan, idx) => (
            <div
              key={plan.key}
              ref={(el) => { cardRefs.current[idx] = el; }}
              className={`flex flex-col rounded-3xl border bg-white shadow-sm hover:shadow-lg transition-all overflow-hidden shrink-0 w-[82%] sm:w-[64%] snap-center lg:w-auto lg:shrink lg:snap-align-none ${
                plan.highlighted ? "border-blue-200 ring-2 ring-blue-500/70 lg:scale-[1.02] lg:z-10" : "border-slate-200"
              }`}
            >
            <div className="p-6 sm:p-7 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Signature</span>
                  <h3 className={`text-3xl sm:text-4xl font-black tracking-tight leading-none mt-1.5 ${plan.theme.name}`}>
                    {plan.name}
                  </h3>
                </div>
                <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0 ${plan.theme.iconWrap}`}>
                  <plan.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
              </div>

              <span className={`inline-flex w-fit items-center mt-4 px-3 py-1 rounded-full text-[11px] font-bold ${plan.theme.badge}`}>
                {plan.badge}
              </span>
              <p className="text-sm text-slate-500 mt-3">{plan.tagline}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-600 leading-snug">
                    <IconCheck className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.theme.check}`} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-7">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <span className={`text-2xl sm:text-3xl font-black tracking-tight ${plan.theme.price}`}>₹{plan.price}</span>
                    <span className="text-xs text-slate-400 font-medium ml-1.5">/year + GST</span>
                  </div>
                  <button
                    onClick={() => onOpenAuth("join", plan.key)}
                    className={`inline-flex items-center gap-1.5 text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-xl transition-all shrink-0 cursor-pointer ${plan.theme.cta}`}
                  >
                    <span>Choose {plan.name.charAt(0) + plan.name.slice(1).toLowerCase()}</span>
                    <IconArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {plan.stats && (plan.stats.minor || plan.stats.semi || plan.stats.major) ? (
              <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/60">
                {([
                  ["Minor Tests", plan.stats.minor],
                  ["Semi Major Tests", plan.stats.semi],
                  ["Major Tests", plan.stats.major],
                  ["Total Tests", plan.stats.total],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label as string} className="text-center py-3 sm:py-4 px-1">
                    <div className="text-sm sm:text-lg font-extrabold text-slate-900">{value}</div>
                    <div className="text-[8.5px] sm:text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            ) : plan.stats ? (
              <div className="border-t border-slate-100 bg-slate-50/60 text-center py-3.5 px-1">
                <span className="text-sm sm:text-lg font-extrabold text-slate-900">{plan.stats.total}</span>
                <span className="text-[10px] text-slate-400 font-semibold ml-1.5">Tests Included</span>
              </div>
            ) : null}
            </div>
          ))}
        </div>

        {/* Mobile-only: swipe hint + dot indicators for the carousel */}
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
    </section>
  );
}
