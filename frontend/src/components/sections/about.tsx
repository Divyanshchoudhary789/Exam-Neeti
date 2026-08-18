"use client";

export function About() {
  return (
    <section id="about" className="relative bg-white py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200/60 overflow-hidden w-full text-left">
      <div className="absolute left-[-10%] top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[130px] pointer-events-none" />
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                ABOUT EXAM NEETI
              </span>
              <h2 className="font-display text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mt-3">
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
            
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200">
              <div>
                <span className="block text-[28px] font-black text-slate-900 tracking-tight">94.8%</span>
                <span className="text-xs text-slate-500 font-medium">Accuracy Growth Index</span>
              </div>
              <div>
                <span className="block text-[28px] font-black text-indigo-600 tracking-tight">3M+</span>
                <span className="text-xs text-slate-500 font-medium">Questions Monitored</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-[2.5rem] border border-slate-200/80 bg-slate-50 p-8 sm:p-10 shadow-sm overflow-hidden group">
              <div className="absolute right-[-10%] top-[-10%] w-48 h-48 bg-indigo-500/5 rounded-full blur-[50px] pointer-events-none" />
              <h3 className="font-display text-xl font-bold text-slate-900 mb-6">Our Mission</h3>
              <div className="space-y-6">
                {[
                  { title: "Avoidable Leakage Detection", desc: "Isolate careless mistakes from comprehension barriers." },
                  { title: "Pacing Efficiency Analysis", desc: "Optimize time management per questions block." },
                  { title: "Dynamic Score Projections", desc: "Formulate metrics based rank recommendations." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">
                      {idx + 1}
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
