"use client";

const IconSigma = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconScan = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
  </svg>
);

const IconChart = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export function Highlights() {
  const highlights = [
    { id: "strategy", title: "Data-Driven Strategy", description: "Every analytical insight is generated using predefined, rigorous business rules and mathematical formulas to optimize test-taking execution.", icon: IconSigma },
    { id: "engine", title: "Core Analytics Engine", description: "Instantly compute complex exam metrics including time utilization, guessing patterns, and error distribution without the need for manual review.", icon: IconScan },
    { id: "insights", title: "Granular Performance Insights", description: "Provide students with a personalized dashboard mapping subject, chapter, and topic accuracy alongside clear timeline trend graphs.", icon: IconChart }
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 w-full text-left">
      <div className="rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-[#14123c] via-[#201869] to-[#4832b8] p-8 sm:p-10 md:p-12 shadow-xl shadow-indigo-950/25">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 md:divide-x md:divide-white/10">
          {highlights.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`flex items-start text-left gap-5 ${idx > 0 ? "md:pl-10" : ""} ${idx < 2 ? "md:pr-10" : ""}`}
                id={`feature-highlight-${s.id}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-indigo-300 shadow-inner">
                  <Icon />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-extrabold text-white tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] leading-relaxed text-slate-300 font-normal">
                    {s.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
