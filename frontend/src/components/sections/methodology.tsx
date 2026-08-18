"use client";

import { Highlights } from "./highlights";
import { Telemetry } from "./telemetry";

export function Methodology() {
  return (
    <div id="methodology" className="w-full bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-2 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          OUR METHODOLOGY
        </span>
        <h2 className="font-sans text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mt-3">
          How We Optimize Your Performance
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto mt-4 font-normal leading-relaxed">
          We break down mock examinations into granular variables, isolating careless mistakes from conceptual gaps.
        </p>
      </div>

      <Highlights />
      <Telemetry />
    </div>
  );
}
