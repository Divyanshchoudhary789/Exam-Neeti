"use client";

import {
  IconTarget,
  IconClock,
  IconTrendingUp,
  IconShield,
  IconTrendingUp as IconGrowth,
  IconBook,
} from "../common/UIComponents";

const MISSION_ITEMS = [
  {
    icon: IconTarget,
    title: "Avoidable Leakage Detection",
    desc: "Isolate careless mistakes from genuine comprehension barriers.",
  },
  {
    icon: IconClock,
    title: "Pacing Efficiency Analysis",
    desc: "Optimize time management across every question block.",
  },
  {
    icon: IconTrendingUp,
    title: "Dynamic Score Projections",
    desc: "Formulate metrics-based rank recommendations that update every attempt.",
  },
];

export function About() {
  return (
    <section id="about" className="relative bg-white py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200/60 overflow-hidden w-full max-w-full text-left">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/3 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-[380px] h-[380px] bg-violet-500/[0.03] rounded-full blur-[120px] pointer-events-none translate-x-1/4 translate-y-1/4" />

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          <div className="lg:col-span-6 space-y-7">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                <IconShield className="w-3.5 h-3.5" />
                About Exam Neeti
              </span>
              <h2 className="font-display text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Every Score Has a Strategy. <br />
                <span className="text-indigo-600">Not Everyone Plugs the Leaks.</span>
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
              At Exam Neeti, we don&apos;t just provide practice questions. We analyze mock test data using advanced mathematical algorithms to pinpoint exactly where students lose marks.
            </p>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
              Whether you are preparing for NEET, JEE, or UPSC, our analytics engine monitors pacing profiles, guess attempts, and chapter accuracy thresholds to build a personalized pathway for consistent score improvement.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-5 border-t border-slate-200">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <IconGrowth className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="block text-[26px] font-black text-slate-900 tracking-tight leading-none">94.8%</span>
                  <span className="text-xs text-slate-500 font-medium">Accuracy Growth Index</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <IconBook className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="block text-[26px] font-black text-indigo-600 tracking-tight leading-none">3M+</span>
                  <span className="text-xs text-slate-500 font-medium">Questions Monitored</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-[2.5rem] border border-slate-200/80 bg-slate-50 p-8 sm:p-10 shadow-sm overflow-hidden group hover:shadow-xl hover:border-indigo-200/80 transition-all duration-300">
              <div className="absolute right-[-10%] top-[-10%] w-48 h-48 bg-indigo-500/5 rounded-full blur-[50px] pointer-events-none" />
              <div className="absolute left-[-8%] bottom-[-12%] w-40 h-40 bg-violet-500/5 rounded-full blur-[50px] pointer-events-none" />

              <div className="relative flex items-center gap-3 mb-7">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                  <IconTarget className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">Our Mission</h3>
              </div>

              <div className="relative space-y-6">
                {MISSION_ITEMS.map((item) => (
                  <div key={item.title} className="flex gap-4 items-start">
                    <div className="h-10 w-10 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                      <item.icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-none">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
