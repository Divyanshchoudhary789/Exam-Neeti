"use client";

interface ResourcesProps {
  onOpenAuth: (type: "login" | "join") => void;
}

const IconChart = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

export function Resources({ onOpenAuth }: ResourcesProps) {
  const resources = [
    { id: "res-1", title: "Study Plan Template", description: "Plan your week the smart way.", action: "DOWNLOAD", isDownload: true, icon: IconSigma },
    { id: "res-2", title: "Previous Year Papers", description: "Practice high-yield questions.", action: "DOWNLOAD", isDownload: true, icon: IconSigma },
    { id: "res-3", title: "Strategy Guides", description: "Insights from AIR toppers.", action: "EXPLORE", isDownload: false, icon: IconChart },
    { id: "res-4", title: "Mindset & Motivation", description: "Stay focused. Stay calm.", action: "EXPLORE", isDownload: false, icon: IconShieldCheck }
  ];

  return (
    <section id="resources" className="relative bg-white text-slate-800 w-full">
      <div className="relative bg-white py-10 px-4 sm:px-6 lg:px-8 border-t border-slate-200" id="resources-hero">
        <div className="mx-auto max-w-7xl">
          <div className="bg-slate-50 border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-8 sm:p-12 lg:p-14 shadow-sm max-w-6xl mx-auto min-h-[500px] flex items-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center w-full">
              
              <div className="lg:col-span-4 text-left space-y-3.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                  CURRICULUM ARCHIVE
                </span>
                <h2 className="text-[2.25rem] sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                  Free Resources to Fuel Your Preparation
                </h2>
                <p className="text-slate-500 text-xs sm:text-[13px] font-normal leading-relaxed max-w-md">
                  We frequently release custom planners and toppers logsheets completely open-source to maximize rank opportunities.
                </p>
              </div>

              <div className="lg:col-span-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {resources.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md hover:border-slate-300"
                        id={item.id}
                      >
                        <div className="text-left">
                          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
                            <Icon />
                          </div>
                          <h3 className="text-[14px] font-bold text-slate-900 tracking-tight mt-5">
                            {item.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium mt-2 leading-normal">
                            {item.description}
                          </p>
                        </div>
                        <div className="pt-4 mt-4 border-t border-slate-100 text-left">
                          <button
                            onClick={() => {
                              if (item.isDownload) {
                                alert(`Downloading ${item.title}...`);
                              } else {
                                onOpenAuth("login");
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
                          >
                            <span>{item.action}</span>
                            <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
