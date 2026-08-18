"use client";

import { useState } from "react";

export function Contact() {
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
    <section id="footer" className="relative bg-slate-50 border-t border-slate-200 py-20 px-4 sm:px-6 lg:px-8 text-left text-slate-600 w-full max-w-full overflow-hidden">
      <div className="absolute right-0 bottom-0 w-[350px] h-[350px] bg-indigo-500/[0.01] rounded-full blur-[100px] pointer-events-none translate-x-1/4" />
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Get in Touch with Our Strategists
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Have questions about batch analytics setup, mock integration plans, or licensing features? Reach out directly and optimize your cohort index.
            </p>
            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-indigo-600 font-extrabold">EMAIL:</span>
                <span>support@examneeti.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-indigo-600 font-extrabold">LOCATION:</span>
                <span>New Delhi, India</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-display text-xl font-bold text-slate-900">Subscribe to Strategy Briefings</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Join 5,000+ educators and students receiving weekly checklist recommendations.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
              <input
                type="email"
                placeholder="Enter email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-grow rounded-xl bg-white border border-slate-300 focus:border-[#5a4bfc] focus:outline-none text-slate-900 text-xs px-4 py-3 shadow-sm"
              />
              <button
                type="submit"
                className="bg-[#5a4bfc] hover:bg-[#6c5eff] text-white text-xs font-extrabold px-5 py-3 rounded-xl transition-all cursor-pointer shrink-0 text-center"
              >
                Subscribe
              </button>
            </form>
            {newsletterStatus !== "idle" && (
              <p className={`text-[11px] font-bold ${newsletterStatus === "success" ? "text-emerald-600" : "text-rose-500"}`}>
                {newsletterMsg}
              </p>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
