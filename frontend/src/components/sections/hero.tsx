"use client";

import { useState, useEffect } from "react";

interface HeroProps {
  onOpenAuth: (type: "login" | "join") => void;
}

export function Hero({ onOpenAuth }: HeroProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slides = [
    {
      id: 0,
      heading: (
        <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
          Every mark has a <span className="text-[#5a4bfc]">strategy</span> —but <span className="text-[#5a4bfc]">not everyone</span> improves.
        </h1>
      ),
      description: "Most students don't need to stop losing marks, they need to stop losing them the same way every test.",
      bg: "#eeeafb",
      bgImage: "https://iili.io/CEwQC9R.png"
    },
    {
      id: 1,
      heading: (
        <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
          Hard work isn&apos;t <br className="hidden md:inline" /> enough.{" "}
          <span className="text-[#5a4bfc]">Plug the leaks.</span> <br />
          <span className="text-[#5a4bfc]">Reclaim every mark.</span>
        </h1>
      ),
      description: "Review test summaries driven by objective metrics to isolate avoidable careless mistakes.",
      bg: "#ffffff",
      bgImage: "https://iili.io/C1GeDMP.png"
    },
    {
      id: 2,
      heading: (
        <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
          What if your mock test <br className="hidden md:inline" /> could talk... <br />
          <span className="text-[#5a4bfc]">...and tell you exactly</span> <br />
          <span className="text-[#5a4bfc]">how to prepare next?</span>
        </h1>
      ),
      description: "Translate every single error into an actionable preparation checklist item.",
      bg: "#ece6fa",
      bgImage: "https://iili.io/C1GDWv4.png"
    },
    {
      id: 3,
      heading: (
        <h1 className="font-display text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-[1.15] text-slate-950 text-left">
          Not just analytics. <span className="text-[#5a4bfc]">Action.</span> <br />
          <span className="text-[#5a4bfc]">Consistent Improvement.</span>
        </h1>
      ),
      description: "Knowing where you slip is only the start. Fixing those parameters is what builds the rank.",
      bg: "#ece6fa",
      bgImage: "https://iili.io/C1V5hWQ.png"
    }
  ];

  return (
    <section
      id="home"
      className="relative text-slate-900 overflow-hidden border-b border-white/[0.04] h-[545px] sm:h-[585px] lg:h-[625px] flex flex-col justify-stretch pt-[75.6px] transition-colors duration-500 w-full max-w-full"
      style={{ marginTop: "-75.6px", backgroundColor: slides[activeSlide].bg }}
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] lg:w-[700px] h-[500px] lg:h-[700px] bg-indigo-50/70 rounded-full blur-[140px] pointer-events-none z-0 translate-x-1/4" />
      <div className="absolute left-0 top-0 w-[350px] h-[350px] bg-blue-50/40 rounded-full blur-[100px] pointer-events-none z-0 -translate-x-1/4 -translate-y-1/4" />

      {slides.map((s, idx) => (
        s.bgImage ? (
          <div
            key={s.id}
            className="absolute inset-0 z-0 transition-opacity duration-1000 pointer-events-none"
            style={{
              opacity: activeSlide === idx ? 1 : 0,
              backgroundImage: `url(${s.bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              transform: idx === 2 ? "translateY(37px)" : "none"
            }}
          />
        ) : null
      ))}

      {/* Light contrast overlay on mobile devices to ensure text readability */}
      <div className="absolute inset-0 bg-white/70 md:bg-white/20 lg:bg-transparent z-0 pointer-events-none" />

      <div className="relative flex-grow overflow-hidden flex flex-col justify-stretch h-full z-10">
        <div className="w-full flex flex-col flex-grow h-full bg-transparent">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12 flex flex-col justify-center items-start text-left flex-grow">
            <div className="flex flex-col items-start justify-center space-y-6 max-w-3xl">
              <div className="w-full flex flex-col items-start justify-start space-y-4">
                {slides[activeSlide].heading}
                <p className="max-w-2xl text-xs sm:text-sm md:text-base lg:text-lg text-slate-800 font-semibold leading-relaxed whitespace-pre-line text-left">
                  {slides[activeSlide].description}
                </p>
              </div>
              
              <div className="flex flex-col items-start gap-6 pt-2">
                <div className="flex flex-row items-center gap-3">
                  <button
                    onClick={() => onOpenAuth("login")}
                    className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-[#5a4bfc] hover:bg-[#6c5eff] text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 sm:px-8 sm:py-4 shadow-md sm:shadow-lg shadow-indigo-950/10 transition-all duration-200 active:scale-98 cursor-pointer group"
                    id="hero-carousel-dashboard-btn"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Dashboard</span>
                    <svg className="h-4 w-4 text-indigo-200 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onOpenAuth("join")}
                    className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-indigo-200/40 bg-white hover:bg-slate-50 text-[#5a4bfc] font-extrabold text-xs sm:text-sm px-4 py-2.5 sm:px-8 sm:py-4 shadow-sm transition-all duration-200 active:scale-98 cursor-pointer"
                    id="hero-carousel-analyzer-btn"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                    </svg>
                    <span>Analyze Test</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-2.5 px-1 py-1">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2 transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                        activeSlide === idx ? "w-8 bg-[#5a4bfc]" : "w-2 bg-slate-300 hover:bg-slate-400"
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
