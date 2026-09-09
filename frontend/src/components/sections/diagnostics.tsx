"use client";

import { useState, useEffect } from "react";
import { Card } from "../card";

interface DiagnosticsProps {
  onOpenAuth: (type: "login" | "join") => void;
}

// Standalone Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  theme?: "light" | "dark";
}

function Modal({ isOpen, onClose, title, children, theme = "dark" }: ModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const isLight = theme === "light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
      <div className={`relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl z-10 transition-all ${
        isLight ? "bg-white border-slate-100 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
      }`}>
        <div className={`flex items-center justify-between px-8 pt-8 pb-4 shrink-0 ${isLight ? "" : "border-b border-slate-800 mb-4"}`}>
          <h3 className={`font-display text-xl sm:text-2xl font-extrabold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`rounded-xl p-2 transition-colors ${
              isLight ? "text-slate-400 hover:bg-slate-50 hover:text-slate-700" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-8 pb-8 overflow-y-auto flex-grow">
          {children}
        </div>
      </div>
    </div>
  );
}

// Standalone SVG Icons
const IconDashboard = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IconScan = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
  </svg>
);

const IconChart = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M8 16v2M13 11v7M18 6v12" />
  </svg>
);

const IconSigma = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function Diagnostics({ onOpenAuth }: DiagnosticsProps) {
  const [diagnosticsModal, setDiagnosticsModal] = useState<string | null>(null);

  const diagnostics = [
    {
      id: "student",
      title: "Student Dashboard Engine",
      description: "Personalized performance summaries displaying test history, accuracy metrics, and broken-down trends across biology, chemistry, and physics chapters.",
      tags: ["Test History", "Accuracy Metrics", "Chapter Trends"],
      linkText: "View Student Module",
      icon: IconDashboard,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      hoverColor: "group-hover:text-indigo-600",
      tagBg: "bg-indigo-50/50",
      tagText: "text-indigo-600 border-indigo-100/20",
      img: "https://iili.io/ClwuUva.png"
    },
    {
      id: "time",
      title: "Time & Attempt Analysis",
      description: "Predefined business rules that calculate time allocation per question, isolate guess patterns, and evaluate performance across question difficulty layers.",
      tags: ["Time Allocation", "Guess Patterns", "Difficulty Layers"],
      linkText: "View Analytics Logic",
      icon: IconScan,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      hoverColor: "group-hover:text-cyan-600",
      tagBg: "bg-cyan-50/50",
      tagText: "text-cyan-700 border-cyan-100/20",
      img: "https://iili.io/Clwu4Tv.png"
    },
    {
      id: "recoverable",
      title: "Recoverable Marks Analyzer",
      description: "Advanced formulaic scoring that pinpoints marks lost to incorrect answers, careless errors, and time misallocation, showcasing immediate opportunities for score growth.",
      tags: ["Formulaic Scoring", "Careless Errors", "Score Growth"],
      linkText: "View Revenue & Score ROI",
      icon: IconSigma,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      hoverColor: "group-hover:text-emerald-600",
      tagBg: "bg-emerald-50/50",
      tagText: "text-emerald-700 border-emerald-100/20",
      img: "https://iili.io/Clwu6jR.png"
    },
    {
      id: "analytics",
      title: "Analytics-Rich Dashboard",
      description: "A visual command centre for every attempt—accuracy, pace, guess rate and negative-mark trends charted over time, with each metric drilling straight down to the exact questions behind it.",
      tags: ["Visual Dashboards", "Metric Drill-Downs", "Trend Tracking"],
      linkText: "View Analytics Dashboard",
      icon: IconChart,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      hoverColor: "group-hover:text-purple-600",
      tagBg: "bg-purple-50/50",
      tagText: "text-purple-700 border-purple-100/20",
      img: "https://iili.io/ClwuSYg.png"
    }
  ];

  return (
    <section id="diagnostics" className="relative bg-white py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200/60 w-full max-w-full">
      {/* Decorative glows — clipped in their own layer so they never make the
          section a scroll container (which would break the sticky column below). */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-0 w-[400px] h-[400px] bg-indigo-500/[0.01] rounded-full blur-[120px] translate-x-1/4" />
        <div className="absolute left-0 bottom-0 w-[300px] h-[300px] bg-blue-500/[0.01] rounded-full blur-[100px] -translate-x-1/4" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          <div className="lg:col-span-4 text-left flex flex-col space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                THE COMPLETE ANALYTICS MATRIX
              </span>
              <h2 className="font-display text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                One Engine. <br />
                <span className="text-indigo-600">Total Performance Diagnostics.</span>
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
              From student and batch dashboards to formula-based negative marking breakdowns and downloadable institutional reports—all driven by precision mathematical logic.
            </p>
            <button
              onClick={() => setDiagnosticsModal("all-modules")}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-slate-300 bg-slate-50 hover:bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-700 hover:text-slate-900 shadow-sm transition-all cursor-pointer"
              id="explore-all-modules-btn"
            >
              <span>Explore All Modules</span>
              <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" id="diagnostics-grid">
              {diagnostics.map((l) => (
                <Card
                  key={l.id}
                  id={l.id}
                  title={l.title}
                  description={l.description}
                  tags={l.tags}
                  tagBg={l.tagBg}
                  tagText={l.tagText}
                  img={l.img}
                  color={l.color}
                  linkText={l.linkText}
                  onClick={() => setDiagnosticsModal(l.id)}
                  icon={l.icon}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Student Modal */}
      <Modal isOpen={diagnosticsModal === "student"} onClose={() => setDiagnosticsModal(null)} title="Student Dashboard Engine" theme="light">
        <div className="space-y-4 text-slate-700">
          <p className="text-sm text-slate-500">
            A real-time overview of individual student analytics mapped out across high-yield preparation subjects.
          </p>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Subject Summary</span>
              <span className="text-xs font-bold text-indigo-600">Target Accuracy: 80%</span>
            </div>
            <div className="space-y-3">
              {[
                { name: "Biology: Plant Physiology", accuracy: 84, progress: 90 },
                { name: "Chemistry: Organic Reactions", accuracy: 68, progress: 75 },
                { name: "Physics: Electromagnetism", accuracy: 52, progress: 40 }
              ].map((s) => (
                <div key={s.name} className="space-y-1 text-left">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{s.name}</span>
                    <span className={s.accuracy >= 75 ? "text-emerald-600" : "text-rose-600"}>{s.accuracy}% Acc</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setDiagnosticsModal(null); onOpenAuth("login"); }}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            Access My Dashboard
          </button>
        </div>
      </Modal>

      {/* Time Modal */}
      <Modal isOpen={diagnosticsModal === "time"} onClose={() => setDiagnosticsModal(null)} title="Time & Attempt Analysis" theme="light">
        <div className="space-y-4 text-slate-700">
          <p className="text-sm text-slate-500">
            Measures pace index to isolate hazard guessing loops and highlight strategic time-allocation thresholds.
          </p>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 space-y-4">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left">Pacing Profile</h4>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Avg Time/Question</span>
                <span className="font-mono text-lg font-extrabold text-cyan-600">72 sec</span>
              </div>
              <div className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Overbudget Qs</span>
                <span className="font-mono text-lg font-extrabold text-rose-600">14 Qs</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDiagnosticsModal(null)}
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700 py-3 text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            Run Detailed Pacing Audit
          </button>
        </div>
      </Modal>

      {/* Recoverable Modal */}
      <Modal isOpen={diagnosticsModal === "recoverable"} onClose={() => setDiagnosticsModal(null)} title="Recoverable Marks Analyzer" theme="light">
        <div className="space-y-4 text-slate-700">
          <p className="text-sm text-slate-500">
            This module applies rigorous mathematical formulas to isolate your raw scores from avoidable performance leakages.
          </p>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Avoidable Mark Leakages</span>
              <span className="font-mono text-emerald-600 font-extrabold text-base">+72 Marks</span>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600 text-left">
              <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                <span className="font-medium">Negative marks from high-risk guesses:</span>
                <span className="text-slate-800 font-bold">+18 Marks</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                <span className="font-medium">Careless reading errors:</span>
                <span className="text-slate-800 font-bold">+24 Marks</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDiagnosticsModal(null)}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            Evaluate My Last Test Potentials
          </button>
        </div>
      </Modal>

      {/* Analytics Modal */}
      <Modal isOpen={diagnosticsModal === "analytics"} onClose={() => setDiagnosticsModal(null)} title="Analytics-Rich Dashboard" theme="light">
        <div className="space-y-4 text-slate-700">
          <p className="text-sm text-slate-500">
            Every attempt is broken down into the metrics that actually move your score, then charted over time so you can see what is improving and what is still leaking. Tap any number to jump straight to the questions behind it.
          </p>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Attempt Snapshot</span>
              <span className="text-xs font-bold text-purple-600">Last 6 tests</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: "Accuracy Trend", value: "68% → 82%", color: "text-emerald-600" },
                { label: "Avg Time / Qs", value: "72 sec", color: "text-cyan-600" },
                { label: "Guess Rate", value: "11%", color: "text-amber-600" },
                { label: "Recoverable", value: "+34 Marks", color: "text-purple-600" }
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">{m.label}</span>
                  <span className={`font-mono text-base font-extrabold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-xs text-slate-600 text-left pt-1">
              <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                <span className="font-medium">Weakest chapter</span>
                <span className="text-slate-800 font-bold">Physics · Mechanics (52%)</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                <span className="font-medium">Most repeated mistake</span>
                <span className="text-slate-800 font-bold">Misread question (×7)</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* All Modules Modal */}
      <Modal isOpen={diagnosticsModal === "all-modules"} onClose={() => setDiagnosticsModal(null)} title="Exam Neeti - Core Analytics Matrix" theme="light">
        <div className="space-y-4 text-slate-700">
          <p className="text-sm text-slate-500">
            A cohesive view of our four specialized components working concurrently to maximize score metrics:
          </p>
          <div className="space-y-3">
            {diagnostics.map((l) => (
              <div key={l.id} className="flex gap-4 items-start p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${l.bgColor} ${l.color} shadow-sm shadow-indigo-100/10`}>
                  <IconDashboard />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">{l.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5 font-normal">
                    {l.description.substring(0, 100)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </section>
  );
}
