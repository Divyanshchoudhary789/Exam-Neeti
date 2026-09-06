"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import {
  IconLayers,
  IconClock,
  IconTarget,
  IconBuilding,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
} from "../../components/common/UIComponents";

const MODULES = [
  {
    kicker: "Your entire preparation, quantified.",
    title: "Student Dashboard Engine",
    desc: "Personalized performance summaries displaying test history, accuracy metrics, and broken-down trends across biology, chemistry, and physics chapters.",
    icon: IconLayers,
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    features: [
      "Complete test history with sortable breakdowns",
      "Subject → chapter → topic accuracy drill-down",
      "Performance trend timelines across every mock",
      "5-level performance labels on every topic",
      "Downloadable personal performance reports",
    ],
    stat: { value: "24", label: "tests tracked per student on average" },
  },
  {
    kicker: "Find where your minutes leak.",
    title: "Time & Attempt Analysis",
    desc: "Predefined business rules that calculate time allocation per question, isolate guess patterns, and evaluate performance across question difficulty layers.",
    icon: IconClock,
    color: "text-teal-600 bg-teal-50 border-teal-100",
    features: [
      "Per-question time tracking with Fast / Optimal / Slow bands",
      "Guess attempt isolation with conversion rates",
      "Easy / Medium / Hard difficulty-layer accuracy",
      "Question-timeline visualisation of the full paper",
      "Pacing score computed against ideal allocation",
    ],
    stat: { value: "96s", label: "average time per question detected" },
  },
  {
    kicker: "Your realistic ceiling, computed.",
    title: "Recoverable Marks Analyzer",
    desc: "Advanced formulaic scoring that pinpoints marks lost to incorrect answers, careless errors, and time misallocation, showcasing immediate opportunities for score growth.",
    icon: IconTarget,
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    features: [
      "Negative marking attribution by root cause",
      "Careless error vs concept gap classification",
      "Easy-question deficit detection",
      "Score recovery funnel from current to potential",
      "Effort-ranked recovery categories",
    ],
    stat: { value: "+72", label: "average recoverable marks identified" },
  },
  {
    kicker: "The institute control tower.",
    title: "Management Dashboard",
    desc: "Centralized administrative control for institute heads featuring batch-to-batch comparisons, overall institute accuracy metrics, and downloadable PDF/Excel reports.",
    icon: IconBuilding,
    color: "text-violet-600 bg-violet-50 border-violet-100",
    features: [
      "Batch-to-batch radar, heatmap and scatter comparisons",
      "Institute-wide accuracy and score trend timelines",
      "Full student directory with performance badges",
      "Leaderboards with achievement tracking",
      "One-click PDF/Excel institutional reports",
    ],
    stat: { value: "9", label: "batches analysed side-by-side" },
  },
];

export default function ProgramsPage() {
  const router = useRouter();

  const handleOpenAuth = (type: "login" | "join") => {
    router.push(type === "login" ? "/login" : "/register");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased overflow-x-hidden w-full max-w-full">
      <Navbar onOpenAuth={handleOpenAuth} />

      {/* Hero */}
      <section className="relative bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Programs · The Analytics Matrix</span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mt-4">
            Four engines. <span className="text-indigo-600">One complete diagnosis.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Every module below runs on precision mathematical logic — no manual review, no subjective grading, no guesswork about your guesswork.
          </p>
        </div>
      </section>

      {/* Modules grid */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MODULES.map((m) => (
            <div key={m.title} className="flex flex-col bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
              <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${m.color}`}>
                <m.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-5">{m.kicker}</span>
              <h3 className="text-base font-bold text-slate-900 mt-2">{m.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">{m.desc}</p>

              <ul className="space-y-2.5 mt-5">
                {m.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[11.5px] text-slate-600 leading-snug">
                    <IconCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="text-xl font-black text-slate-900 tracking-tight">{m.stat.value}</div>
                <div className="text-[10.5px] text-slate-500 font-medium mt-0.5">{m.stat.label}</div>
              </div>

              <button
                onClick={() => handleOpenAuth("join")}
                className="inline-flex items-center gap-1.5 mt-5 text-[12.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
              >
                <span>Start with this module</span>
                <IconArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            All four modules. One account.
          </h2>
          <p className="text-sm text-indigo-100 mt-3">
            Every Exam Neeti account includes the full analytics matrix — students get their engines, institutes get theirs.
          </p>
          <button
            onClick={() => handleOpenAuth("join")}
            className="inline-flex items-center gap-2 mt-7 bg-white text-indigo-700 text-sm font-bold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg cursor-pointer"
          >
            Get Started Free
          </button>
        </div>
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
