"use client";

const IconTest = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconUsers = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconShield = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconGraduation = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-4.5" />
  </svg>
);

export function Stats() {
  const stats = [
    {
      id: "tests",
      value: "50K+",
      label: "Tests Evaluated Across India",
      icon: IconTest,
    },
    {
      id: "questions",
      value: "3+ Million",
      label: "Questions Tracked With Precision",
      icon: IconUsers,
    },
    {
      id: "accuracy",
      value: "94.8%",
      label: "Accuracy Optimization Rate",
      icon: IconShield,
    },
    {
      id: "engine",
      value: "100%",
      label: "Formula-Driven Engine",
      icon: IconGraduation,
    },
  ];

  return (
    <div id="stats-strip" className="relative z-10 w-full max-w-full px-4 sm:px-6 lg:px-8 pt-1 pb-8 sm:pb-10 bg-transparent">
      <div className="mx-auto max-w-7xl">
        {/* Floating Dark Pill Card Container */}
        <div className="rounded-[26px] sm:rounded-[28px] bg-[#050508] border border-white/10 p-5 sm:p-6 lg:py-5 lg:px-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="group flex items-center gap-3.5 transition-all duration-300"
                  id={`stat-${s.id}`}
                >
                  {/* Purple Rounded Square Icon Box */}
                  <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-2xl bg-[#1d1338] border border-purple-900/40 text-[#a855f7] shadow-inner transition-transform group-hover:scale-105 group-hover:text-purple-300">
                    <Icon />
                  </div>

                  {/* Content */}
                  <div className="flex flex-col text-left">
                    <span className="font-sans text-2xl sm:text-[26px] font-black tracking-tight text-white leading-none">
                      {s.value}
                    </span>
                    <span className="mt-1 text-xs font-medium text-slate-400 leading-snug">
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
