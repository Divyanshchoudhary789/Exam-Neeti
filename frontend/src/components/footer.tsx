"use client";

import { useState } from "react";

export function Footer() {
  const [emailInput, setEmailInput] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
  const [newsletterMsg, setNewsletterMsg] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setNewsletterStatus("error");
      setNewsletterMsg("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setNewsletterStatus("error");
      setNewsletterMsg("Please enter a valid email address.");
      return;
    }
    setNewsletterStatus("success");
    setNewsletterMsg("Thank you! You have subscribed successfully.");
    setEmailInput("");
  };

  return (
    <footer id="footer" className="bg-slate-950 border-t border-slate-900 py-16 px-4 sm:px-6 lg:px-8 text-left text-slate-400">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        <div className="lg:col-span-4 space-y-6">
          <a href="#home" className="flex items-center gap-3.5 group" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 overflow-hidden shrink-0 border border-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://iili.io/Clw9yIj.png" alt="Exam Neeti Logo" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-sans text-[20px] font-black tracking-tight text-white leading-none">
                Exam <span className="text-[#5a4bfc]">Neeti</span>
              </span>
              <span className="text-[10px] font-medium tracking-wide text-slate-500 mt-1">Every Score Has a Strategy</span>
            </div>
          </a>
          <p className="text-xs sm:text-[13px] leading-relaxed max-w-sm text-slate-400">
            We translate mock test metadata into strategic action plans, helping aspirants optimize speed, eliminate negatives, and optimize overall percentile ranks.
          </p>
        </div>

        <div className="lg:col-span-4 grid grid-cols-2 gap-8 text-xs font-bold">
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-white">Features</h4>
            <ul className="space-y-2.5">
              <li><a href="#diagnostics" className="hover:text-white transition-colors text-slate-400">Performance Diagnostics</a></li>
              <li><a href="#telemetry" className="hover:text-white transition-colors text-slate-400">Telemetry Matrix</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2.5">
              <li><a href="#about" className="hover:text-white transition-colors text-slate-400">About Us</a></li>
              <li><a href="#testimonials" className="hover:text-white transition-colors text-slate-400">Success Stories</a></li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4 text-left">
          <h4 className="text-xs font-black uppercase tracking-wider text-white">Stay Updated</h4>
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
            <input
              type="email"
              placeholder="Enter email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-grow rounded-xl bg-slate-900 border border-slate-800 focus:border-[#5a4bfc] focus:outline-none text-white text-xs px-4 py-3"
            />
            <button
              type="submit"
              className="bg-[#5a4bfc] hover:bg-[#6c5eff] text-white text-xs font-extrabold px-5 py-3 rounded-xl transition-all cursor-pointer text-center shrink-0"
            >
              Subscribe
            </button>
          </form>
          {newsletterStatus !== "idle" && (
            <p className={`text-[11px] font-bold ${newsletterStatus === "success" ? "text-emerald-500" : "text-rose-500"}`}>
              {newsletterMsg}
            </p>
          )}
        </div>

      </div>

      <div className="mx-auto max-w-7xl border-t border-slate-900 pt-8 mt-12 text-center text-[10px] font-semibold text-slate-500">
        <p>© {new Date().getFullYear()} Exam Neeti. All rights reserved. Every Score Has a Strategy.</p>
      </div>
    </footer>
  );
}