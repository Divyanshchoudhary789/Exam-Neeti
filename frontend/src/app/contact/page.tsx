"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import {
  IconMail,
  IconPhone,
  IconTarget,
  IconClock,
  IconGraduationCap,
  IconBuilding,
  IconArrowRight,
  IconArrowLeft,
} from "../../components/common/UIComponents";

const INFO_CARDS = [
  { icon: IconMail, label: "Email Us", value: "hello@examneeti.in", sub: "Replies within 24 hours" },
  { icon: IconPhone, label: "Call Us", value: "+91 98765 40000", sub: "Mon–Sat · 9 AM – 7 PM IST" },
  { icon: IconTarget, label: "Visit Us", value: "HSR Layout, Bengaluru", sub: "Karnataka, India 560102" },
  { icon: IconClock, label: "Support Hours", value: "9 AM – 7 PM IST", sub: "Monday to Saturday" },
];

const REASONS = ["Student Support", "Institute Partnership", "Demo Request", "Billing", "Other"];

export default function ContactPage() {
  const router = useRouter();
  const [reason, setReason] = useState(REASONS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleOpenAuth = (type: "login" | "join") => {
    router.push(type === "login" ? "/login" : "/register");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      setStatus("error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("success");
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased overflow-x-hidden w-full max-w-full">
      <Navbar onOpenAuth={handleOpenAuth} />

      {/* Hero */}
      <section className="relative bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Contact</span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mt-4">
            Let&apos;s talk <span className="text-indigo-600">strategy.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Questions about your dashboard, institute onboarding, or a demo for your batch — we respond to every message within one working day.
          </p>
        </div>
      </section>

      {/* Info cards */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {INFO_CARDS.map((c) => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <c.icon className="w-4.5 h-4.5" />
              </div>
              <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-4">{c.label}</span>
              <span className="block text-sm font-bold text-slate-900 mt-1">{c.value}</span>
              <span className="block text-[11px] text-slate-500 mt-1">{c.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form + sidebar */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-3xl p-7 sm:p-9">
            <h2 className="font-display text-xl font-bold text-slate-900">Send us a message</h2>
            <p className="text-xs text-slate-500 mt-1.5">Tell us what you need — we read every one.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">I&apos;m reaching out about</label>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        reason === r
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aarav Sharma"
                    className="w-full rounded-xl bg-white border border-slate-300 focus:border-indigo-500 focus:outline-none text-sm px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-2 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl bg-white border border-slate-300 focus:border-indigo-500 focus:outline-none text-sm px-4 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="How can we help?"
                  className="w-full rounded-xl bg-white border border-slate-300 focus:border-indigo-500 focus:outline-none text-sm px-4 py-2.5 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold px-6 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md cursor-pointer"
              >
                Send Message
              </button>

              {status === "success" && (
                <p className="text-xs font-bold text-emerald-600">Thanks — your message has been sent. We&apos;ll reply within a working day.</p>
              )}
              {status === "error" && (
                <p className="text-xs font-bold text-rose-500">Please fill in your name, a valid email, and a message.</p>
              )}
            </form>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center">
                <IconGraduationCap className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-4">Students</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Dashboard questions, report issues or account help — mention your registered email and batch for the fastest resolution.
              </p>
              <button
                onClick={() => handleOpenAuth("login")}
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
              >
                <span>Log in to your dashboard</span>
                <IconArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-sm">
                <IconBuilding className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-4">Institutes</h3>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Batch onboarding, admin console demos and bulk pricing — pick &quot;Institute Partnership&quot; in the form and we&apos;ll schedule a walkthrough.
              </p>
              <button
                onClick={() => handleOpenAuth("join")}
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
              >
                <span>Request a demo</span>
                <IconArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        <p className="mx-auto max-w-6xl text-center text-xs text-slate-400 mt-10">
          Average first response: 4.2 hours. Every message is answered by a human on the product team — no bots, no canned replies.
        </p>
      </section>

      {/* Back to Home */}
      <div className="bg-white py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-100 text-center">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <IconArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <Footer />
    </div>
  );
}
