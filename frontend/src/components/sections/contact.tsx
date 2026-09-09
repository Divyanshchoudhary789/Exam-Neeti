"use client";

import { useState } from "react";
import { newsletterService } from "../../services/apiServices";
import { toast } from "../common/feedback";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Contact() {
  const [emailInput, setEmailInput] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
  const [newsletterMsg, setNewsletterMsg] = useState("");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const email = emailInput.trim();
    if (!email) {
      setNewsletterStatus("error");
      setNewsletterMsg("Please enter an email address.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setNewsletterStatus("error");
      setNewsletterMsg("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setNewsletterStatus("idle");
    setNewsletterMsg("");
    try {
      const res = await newsletterService.subscribe({ email, source: "contact_section", company });
      setNewsletterStatus("success");
      setNewsletterMsg(res?.message || "You're subscribed. Watch your inbox for the next briefing.");
      setEmailInput("");
      toast.success("Subscribed to Strategy Briefings");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0] ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Couldn't subscribe right now. Please try again.";
      setNewsletterStatus("error");
      setNewsletterMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
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
                <span>-</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-indigo-600 font-extrabold">LOCATION:</span>
                <span>India</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <h3 className="font-display text-xl font-bold text-slate-900">Subscribe to Strategy Briefings</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Join 5,000+ educators and students receiving weekly checklist recommendations.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
              {/* Honeypot — hidden from real users, catches bots. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <input
                type="email"
                placeholder="Enter email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={submitting}
                className="flex-grow rounded-xl bg-white border border-slate-300 focus:border-[#5a4bfc] focus:outline-none text-slate-900 text-xs px-4 py-3 shadow-sm disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#5a4bfc] hover:bg-[#6c5eff] text-white text-xs font-extrabold px-5 py-3 rounded-xl transition-all cursor-pointer shrink-0 text-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Subscribing…" : "Subscribe"}
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
