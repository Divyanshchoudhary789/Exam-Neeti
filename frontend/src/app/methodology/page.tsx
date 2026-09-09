"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import {
  IconLayers,
  IconChart,
  IconFilter,
  IconTarget,
  IconBulb,
  IconShield,
  IconTrendingUp,
  IconArrowLeft,
} from "../../components/common/UIComponents";

const PIPELINE = [
  { icon: IconLayers, title: "Data Ingestion", desc: "Test responses, timings and answer keys are ingested per question — every choice, every second, every mark." },
  { icon: IconFilter, title: "Metric Extraction", desc: "Raw responses are classified into correct, incorrect, skipped and rule-based guess attempts." },
  { icon: IconChart, title: "Normalization", desc: "Scores are normalized across difficulty layers and test formats so every comparison is apples-to-apples." },
  { icon: IconTarget, title: "Pattern Detection", desc: "Business rules isolate recurring behaviours: late-test fatigue, guess clusters, time sinks, easy-question skips." },
  { icon: IconBulb, title: "Insight Generation", desc: "Each pattern is converted into a quantified, prioritised finding with its exact mark value attached." },
];

const RULES = [
  {
    title: "Attempt Classification Rule",
    formula: "guess = (time < 25s) ∧ (topic_accuracy < 40%)",
    desc: "An attempt is flagged as a guess when answer time falls below the reading threshold and the student's historical accuracy in that topic is weak — no self-reporting required.",
  },
  {
    title: "Time Utilization Index",
    formula: "TUI = Σ(t_optimal) / Σ(t_total) × 100",
    desc: "The share of total test time spent inside the optimal 60–120 second band. Students above 75 TUI consistently outperform their accuracy-matched peers.",
  },
  {
    title: "Negative Mark Attribution",
    formula: "loss_avoidable = Σ(neg | cause ∈ {silly, misread})",
    desc: "Every negative mark is attributed to one of four root causes. Silly errors and misreads are classified avoidable — typically 60%+ of all losses.",
  },
  {
    title: "Recoverable Marks Formula",
    formula: "RM = loss_avoidable + skips_easy×M + Δt_misalloc×acc",
    desc: "Avoidable losses, plus skipped questions from high-accuracy chapters at full marks, plus misallocated time re-priced at the student's real accuracy.",
  },
];

const PRINCIPLES = [
  { icon: IconShield, title: "Deterministic, not probabilistic", desc: "The same test data always produces the same analysis. Every number can be traced to its rule." },
  { icon: IconTrendingUp, title: "Behaviour-first metrics", desc: "We measure decisions (guessing, pacing, skipping) — because decisions change faster than knowledge." },
  { icon: IconTarget, title: "Marks as the universal unit", desc: "Every insight is priced in marks, so students always know what a fix is worth." },
];

export default function MethodologyPage() {
  const router = useRouter();

  const handleOpenAuth = (type: "login" | "join") => {
    router.push(type === "login" ? "/login" : "/register");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased overflow-x-clip w-full max-w-full">
      <Navbar onOpenAuth={handleOpenAuth} />

      {/* Hero */}
      <section className="relative bg-gradient-to-b border-b from-indigo-50 via-violet-50/60 to-white overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Methodology · How the Engine Thinks</span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mt-4">
            No opinions. <span className="text-indigo-600">Only formulas.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Every insight on Exam Neeti is produced by a five-stage analytical pipeline governed by predefined business rules — auditable, repeatable, and explainable.
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="bg-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">The Pipeline</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              Five stages from raw test to strategy.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="relative bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <span className="absolute top-3 right-4 text-3xl font-black text-slate-200 select-none">{i + 1}</span>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
                  <step.icon className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-4">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200/70">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">The Rules</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              A look inside the formulas.
            </h2>
            <p className="text-sm text-slate-500 mt-4">
              Simplified forms of the actual business rules the engine executes on every ingested test.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {RULES.map((r) => (
              <div key={r.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">{r.title}</h3>
                <code className="block mt-3 text-[12.5px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-nowrap">
                  {r.formula}
                </code>
                <p className="text-xs text-slate-500 leading-relaxed mt-3">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Non-negotiable Principles</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="text-center px-4">
                <div className="h-11 w-11 mx-auto rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-4">{p.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            See the methodology run on your own test.
          </h2>
          <p className="text-sm text-indigo-100 mt-3">
            Upload one mock and watch the pipeline price every decision you made.
          </p>
          <button
            onClick={() => handleOpenAuth("join")}
            className="inline-flex items-center gap-2 mt-7 bg-white text-indigo-700 text-sm font-bold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg cursor-pointer"
          >
            Analyze My First Test
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
