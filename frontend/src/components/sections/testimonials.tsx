"use client";

import { useState } from "react";

const IconQuote = () => (
  <svg className="h-6 w-6 transform rotate-180 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14.017 21v-7.391c0-5.704 3.748-9.791 9-10.156v2.734c-2.893.08-4.32 1.455-4.594 4.09h4.594v10.723h-9zm-14 0v-7.391c0-5.704 3.748-9.791 9-10.156v2.734c-2.893.08-4.32 1.455-4.594 4.09h4.594v10.723h-9z" />
  </svg>
);

export function Testimonials() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const testimonials = [
    { id: "u1", quote: "The strategy I got from Exam Neeti changed the way I prepared. From confused to confident — the difference is real.", author: "AIR 152, UPSC Aspirant", avatar: "RS" },
    { id: "u2", quote: "Mentorship and test series helped me identify my weak areas and improve consistently. Best decision I made!", author: "AIR 98, JEE Aspirant", avatar: "AK" },
    { id: "u3", quote: "The personalized plan and regular doubt sessions kept me ahead of everyone. Highly recommended!", author: "AIR 215, NEET Aspirant", avatar: "PM" }
  ];

  return (
    <section id="testimonials" className="bg-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200 w-full text-center">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-slate-900 mb-10">
          Real <span className="text-indigo-600">Aspirants.</span> Real Results.
        </h2>

        <div className="relative rounded-[2rem] md:rounded-[2.5rem] bg-slate-50 border border-slate-200 p-8 sm:p-12 lg:p-14 max-w-6xl mx-auto shadow-sm">
          
          <button
            onClick={() => setActiveTestimonial((prev) => (prev === 0 ? 2 : prev - 1))}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-[#5a4bfc] text-white shadow-lg hover:bg-[#6c5eff] transition-all cursor-pointer active:scale-95 border border-indigo-200"
            aria-label="Previous testimonial"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setActiveTestimonial((prev) => (prev + 1) % 3)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-[#5a4bfc] text-white shadow-lg hover:bg-[#6c5eff] transition-all cursor-pointer active:scale-95 border border-indigo-200"
            aria-label="Next testimonial"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}
            >
              {testimonials.map((t) => (
                <div key={t.id} className="w-full shrink-0 px-4 sm:px-12 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <div className="text-indigo-600">
                      <IconQuote />
                    </div>
                    <p className="text-base sm:text-lg md:text-xl leading-relaxed text-slate-700 font-medium italic">
                      &quot;{t.quote}&quot;
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-200">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-black text-indigo-600 shadow-sm">
                      {t.avatar}
                    </div>
                    <span className="text-[12px] font-bold text-slate-800 tracking-tight">
                      {t.author}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTestimonial(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activeTestimonial === idx ? "w-6 bg-[#5a4bfc]" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
