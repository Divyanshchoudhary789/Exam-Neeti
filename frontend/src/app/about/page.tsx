"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import {
  IconTarget,
  IconTrendingUp,
  IconShield,
  IconUsers,
  IconBook,
  IconGraduationCap,
  IconArrowLeft,
  IconChart,
} from "../../components/common/UIComponents";

const STATS = [
  { value: "50K+", label: "Tests Evaluated" },
  { value: "3M+", label: "Questions Tracked" },
  { value: "360°", label: "Performance Analysis" },
  { value: "2378", label: "Active Students" },
];

const PRINCIPLES = [
  {
    icon: IconTarget,
    title: "Mathematics Over Motivation",
    desc: "We don't deal in vague encouragement. Every insight on the platform is derived from predefined business rules and rigorous formulas — if we can't compute it, we don't claim it.",
  },
  {
    icon: IconShield,
    title: "Radical Transparency",
    desc: "Students see exactly why a mark was lost — a guess, a misread, a time sink — and exactly what it's worth to fix. No black boxes, no mystery scores.",
  },
  {
    icon: IconTrendingUp,
    title: "Decisions, Not Just Data",
    desc: "Dashboards are only useful if they change behaviour. Every metric we surface is tied to a concrete test-taking decision a student can make in their very next mock.",
  },
  {
    icon: IconChart,
    title: "One Attempt, Fully X-Rayed",
    desc: "Accuracy, pacing, guess rate and negative-mark leakage are charted attempt over attempt — and every number on the dashboard drills straight down to the exact questions behind it.",
  },
];

const STORY = [
  {
    year: "2023",
    title: "The Question",
    desc: "The founder, an exam mentor, asks why toppers and average scorers with identical syllabus coverage score 150 marks apart — and finds the answer in decision patterns, not knowledge.",
  },
  {
    year: "2024",
    title: "The Engine",
    desc: "The first formula-driven analysis engine ships: attempt classification, time-per-question tracking and negative-marking attribution across 4 pilot batches.",
  },
  {
    year: "2025",
    title: "The Platform",
    desc: "Exam Neeti launches publicly with student and admin dashboards, the Recoverable Marks Analyzer, and downloadable institutional reports.",
  },
  {
    year: "2026",
    title: "The Scale",
    desc: "50K+ tests evaluated, 3M+ questions tracked and 9 institute batches analysed — with a 94.8% accuracy optimization rate.",
  },
];

const TEAM = [
  {
    initials: "AB",
    name: "Abhishek Bhavnani",
    role: "Founder",
    bio: "Started Exam Neeti after watching disciplined aspirants plateau for reasons no mark sheet could explain. Built the formula-driven engine that names every lost mark — and the exact decision needed to win it back.",
  },
];

export default function AboutPage() {
  const router = useRouter();

  const handleOpenAuth = (type: "login" | "join") => {
    router.push(type === "login" ? "/login" : "/register");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased overflow-x-clip w-full max-w-full">
      <Navbar onOpenAuth={handleOpenAuth} />

      {/* Hero */}
      <section className="relative bg-gradient-to-b from-indigo-50 via-violet-50/60 to-white overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">About Exam Neeti</span>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mt-4">
            We turned exam preparation into an{" "}
            <span className="text-indigo-600">exact science.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Exam Neeti is an analytics platform for competitive-exam aspirants and institutes. We believe every score is the output of measurable decisions — and that measuring those decisions precisely is the fastest way to change them.
          </p>

          <div className="mt-12 bg-slate-950 border border-slate-800 rounded-3xl shadow-sm px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">{s.value}</div>
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-white py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-10">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Our Mission</span>
            <h2 className="font-display text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mt-3">
              Make every lost mark explainable — and recoverable.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mt-4">
              Most aspirants lose 60–90 marks per exam not to ignorance, but to guessing patterns, time misallocation and careless slips. Our mission is to attribute every one of those marks to its exact cause, and hand students a computed, prioritised path to claiming them back.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 sm:p-10">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Our Vision</span>
            <h2 className="font-display text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mt-3">
              A dashboard on every aspirant&apos;s desk.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mt-4">
              We picture a preparation culture where &quot;work harder&quot; is replaced by &quot;fix this specific decision&quot; — where every student, in every batch, in every institute walks into their exam knowing exactly which behaviours their score depends on.
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200/70">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">What We Stand For</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              Principles behind every formula.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
                <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-4">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story timeline */}
      <section className="bg-white py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Our Story</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              From one question to 3 million.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STORY.map((s) => (
              <div key={s.year} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <span className="text-3xl font-black text-indigo-600 tracking-tight">{s.year}</span>
                <h3 className="text-sm font-bold text-slate-900 mt-3">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200/70">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">The Founder</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              The mind behind the method.
            </h2>
          </div>
          <div className="max-w-sm mx-auto">
            {TEAM.map((m) => (
              <div key={m.name} className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
                  {m.initials}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-4">{m.name}</h3>
                <p className="text-[11px] font-semibold text-indigo-600 mt-1">{m.role}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-3">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="mx-auto max-w-3xl text-center">
          <IconBook className="w-8 h-8 text-indigo-200 mx-auto" />
          <p className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug mt-6">
            &quot;Toppers aren&apos;t smarter. They make fewer bad decisions per paper. Once we could count those decisions, we could coach them.&quot;
          </p>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-5">
            — The founding insight, 2023
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <IconUsers className="w-8 h-8 text-white/70 mx-auto" />
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-4">
            Ready to see your score differently?
          </h2>
          <p className="text-sm text-indigo-100 mt-3">
            Join 2,378 active students already turning test data into rank movement.
          </p>
          <button
            onClick={() => handleOpenAuth("join")}
            className="inline-flex items-center gap-2 mt-7 bg-white text-indigo-700 text-sm font-bold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all shadow-lg cursor-pointer"
          >
            <IconGraduationCap className="w-4 h-4" />
            Join Exam Neeti
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
