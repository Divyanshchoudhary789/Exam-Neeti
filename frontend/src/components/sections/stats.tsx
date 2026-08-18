"use client";

const IconChart = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconUsers = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconShieldCheck = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconSigma = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function Stats() {
  const stats = [
    { id: "tests", value: "50K+", label: "Tests Evaluated", icon: IconChart, colorClass: "text-[#5a4bfc]", bgColorClass: "bg-indigo-50 border border-indigo-100" },
    { id: "questions", value: "3+ Million", label: "Questions Tracked", icon: IconUsers, colorClass: "text-[#5a4bfc]", bgColorClass: "bg-indigo-50 border border-indigo-100" },
    { id: "accuracy", value: "94.8%", label: "Accuracy Optimization Rate", icon: IconShieldCheck, colorClass: "text-[#5a4bfc]", bgColorClass: "bg-indigo-50 border border-indigo-100" },
    { id: "engine", value: "100%", label: "Formula-Driven Engine", icon: IconSigma, colorClass: "text-[#5a4bfc]", bgColorClass: "bg-indigo-50 border border-indigo-100" }
  ];

  return (
    <div className="relative z-10 -mt-12 sm:-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12 w-full text-left bg-white">
      <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-8 sm:p-10 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:divide-x lg:divide-slate-200">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-4 ${idx > 0 ? "lg:pl-8" : ""} group transition-all duration-300`}
                id={`stat-${s.id}`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${s.bgColorClass} ${s.colorClass} transition-all duration-300 group-hover:scale-105`}>
                  <Icon />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
                    {s.value}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mt-1.5 leading-tight">
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
