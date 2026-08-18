"use client";

import { useState, useEffect } from "react";

// Standalone Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  theme?: "light" | "dark";
}

function Modal({ isOpen, onClose, title, children, theme = "light" }: ModalProps) {
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
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <div className={`relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] border shadow-2xl z-10 transition-all ${
        isLight ? "bg-white border-slate-100 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
      }`}>
        <div className={`flex items-center justify-between px-8 pt-8 pb-4 shrink-0 ${isLight ? "" : "border-b border-slate-200 mb-4"}`}>
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
const IconScan = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
  </svg>
);

const IconUsers = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconShieldCheck = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconSigma = () => (
  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h6M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function Telemetry() {
  const [telemetryTab, setTelemetryTab] = useState("NEET-04");
  const [activeTestNode, setActiveTestNode] = useState(6);
  const [formulasOpen, setFormulasOpen] = useState(false);

  const telemetryTests = [
    { label: "Test 01", accuracy: 18, rank: "3240 / 4566" },
    { label: "Test 02", accuracy: 24, rank: "2810 / 4566" },
    { label: "Test 03", accuracy: 20, rank: "2920 / 4566" },
    { label: "Test 04", accuracy: 38, rank: "1890 / 4566" },
    { label: "Test 05", accuracy: 34, rank: "1550 / 4566" },
    { label: "Test 06", accuracy: 58, rank: "512 / 4566" },
    { label: "Test 07", accuracy: 75, rank: "142 / 4566" }
  ];

  const telemetryData = {
    "NEET-04": { time: "72 seconds", negative: "-14 Marks", guess: "6 Questions", recoverable: "+24 Marks" },
    "NEET-03": { time: "94 seconds", negative: "-22 Marks", guess: "11 Questions", recoverable: "+46 Marks" }
  };

  const chartWidth = 380;
  const chartHeight = 160;
  const paddingX = 32;
  const paddingYRight = 16;
  const paddingYTop = 12;
  const paddingYBottom = 16;

  const getChartX = (idx: number) => paddingX + idx * (chartWidth - paddingX - paddingYRight) / (telemetryTests.length - 1);
  const getChartY = (val: number) => chartHeight - paddingYBottom - val * (chartHeight - paddingYTop - paddingYBottom) / 100;

  const points = telemetryTests.map((t, idx) => ({ x: getChartX(idx), y: getChartY(t.accuracy) }));
  const pathData = points.reduce((acc, p, idx) => {
    if (idx === 0) return `M ${p.x} ${p.y}`;
    const prev = points[idx - 1];
    const cpX1 = prev.x + (p.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (p.x - prev.x) / 2;
    const cpY2 = p.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
  }, "");

  const areaData = `${pathData} L ${points[points.length - 1].x} ${chartHeight - paddingYBottom} L ${points[0].x} ${chartHeight - paddingYBottom} Z`;

  return (
    <section id="telemetry" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-slate-800 w-full text-left bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* Core Analytics Card */}
        <div className="rounded-[2.5rem] bg-gradient-to-b from-[#14123c] via-[#201869] to-[#3a20a4] p-8 text-white flex flex-col justify-between shadow-xl shadow-indigo-950/20 relative overflow-hidden" id="telemetry-card-formulas">
          <div className="absolute right-[-10%] bottom-[-10%] w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none" />
          <div className="space-y-6 text-left">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-300 font-extrabold uppercase tracking-widest text-[10px]">
                <span>CORE ANALYTICS ENGINE</span>
                <IconSigma />
              </div>
              <h3 className="font-display text-[26px] font-black text-white tracking-tight leading-tight mt-2.5">
                Recoverable Marks Analyzer
              </h3>
            </div>
            
            <p className="text-xs sm:text-[13px] leading-relaxed text-indigo-200/90 font-normal">
              A mathematical diagnostic module designed to pinpoint exactly where student marks are lost and calculate how to reclaim them through optimized decision-making.
            </p>

            <div className="grid grid-cols-2 gap-y-4 gap-x-3 pt-4">
              {[
                "Negative Marking Loss",
                "Time Misallocation",
                "Guess Attempt Isolation",
                "Chapter-Wise Accuracy",
                "Trend Progress Timelines",
                "Easy-Question Deficit"
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-white/90 font-semibold leading-snug">
                  <div className="h-4.5 w-4.5 shrink-0 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <svg className="h-3 w-3 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={() => setFormulasOpen(true)}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3.5 text-xs tracking-wide transition-all shadow-lg shadow-indigo-950/20 cursor-pointer active:scale-98"
            >
              <span>Explore Engine Formulas</span>
              <svg className="h-3.5 w-3.5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live Progress Tracker Line Chart Card */}
        <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-8 shadow-sm flex flex-col justify-between relative overflow-hidden" id="telemetry-card-progress">
          <div className="text-left space-y-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                DIAGNOSTICS
              </span>
              <h3 className="font-display text-[22px] font-black text-slate-900 tracking-tight mt-1.5">
                Your Live Progress Tracker
              </h3>
            </div>

            <div className="relative pt-6 min-h-[190px]">
              <div className="sm:absolute sm:right-5 sm:top-[22%] relative mx-auto mb-6 sm:mb-0 bg-white/95 backdrop-blur-sm rounded-[1.25rem] border border-slate-200 shadow-[0_8px_24px_rgba(79,70,229,0.06)] px-5 py-4 text-center z-10 w-[145px]">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg. Accuracy Growth</span>
                <span className="block text-[22px] font-black text-[#5a4bfc] mt-0.5 leading-none">+14.2%</span>
                <span className="block text-[9px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">Overall</span>
              </div>

              <div className="w-full flex justify-center">
                <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0, 25, 50, 75, 100].map((v) => (
                    <g key={v}>
                      <text x={14} y={getChartY(v) + 3} textAnchor="end" fill="#64748b" fontSize="9" fontWeight="700" fontFamily="monospace">
                        {v}
                      </text>
                      <line x1={paddingX} y1={getChartY(v)} x2={chartWidth - paddingYRight} y2={getChartY(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={v !== 0 ? "4 4" : "0"} />
                    </g>
                  ))}

                  <path d={areaData} fill="url(#areaGrad)" />
                  <path d={pathData} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />

                  {telemetryTests.map((t, idx) => {
                    const isActive = activeTestNode === idx;
                    return (
                      <g key={idx} className="cursor-pointer" onClick={() => setActiveTestNode(idx)}>
                        <circle cx={getChartX(idx)} cy={getChartY(t.accuracy)} r="10" fill="transparent" />
                        <circle
                          cx={getChartX(idx)}
                          cy={getChartY(t.accuracy)}
                          r={isActive ? "5.5" : "3.5"}
                          fill={isActive ? "#6366f1" : "#ffffff"}
                          stroke="#6366f1"
                          strokeWidth="2"
                          className="transition-all duration-200"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex justify-between pl-6 pr-2 text-[9px] font-bold font-mono text-slate-500 mt-3">
                {telemetryTests.map((t, idx) => (
                  <button
                    key={t.label}
                    onClick={() => setActiveTestNode(idx)}
                    className={`focus:outline-none py-1 px-1.5 rounded transition-all ${
                      activeTestNode === idx ? "text-[#5a4bfc] bg-slate-200 font-extrabold" : "hover:text-slate-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-5 mt-4 text-center">
              <div className="space-y-0.5">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Tests Evaluated</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight block">24</span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Overall Accuracy</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight block">
                  {telemetryTests[activeTestNode].accuracy}%
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Current Batch Ranking</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight block">
                  {telemetryTests[activeTestNode].rank.split(" / ")[0]}
                  <span className="text-xs font-semibold text-slate-500">/{telemetryTests[activeTestNode].rank.split(" / ")[1]}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Summary Suite Tabbed Interface Card */}
        <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-8 text-slate-800 flex flex-col justify-between shadow-sm relative" id="telemetry-card-summary">
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-extrabold uppercase tracking-widest text-[#00a3c4]">TELEMETRY SUITE</span>
                <h3 className="font-display text-[22px] font-black text-slate-900 tracking-tight mt-1">Instant Summary</h3>
              </div>
              <div className="rounded-full bg-[#00a3c4]/10 px-3 py-1 text-[9px] font-extrabold text-[#00a3c4] uppercase tracking-wider border border-[#00a3c4]/20 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00a3c4] animate-pulse" />
                <span>TELEMETRY</span>
              </div>
            </div>

            <div className="flex gap-2">
              {["NEET-04", "NEET-03"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTelemetryTab(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-300 cursor-pointer ${
                    telemetryTab === tab
                      ? "bg-[#0070f3] text-white border border-[#0070f3]"
                      : "bg-slate-200 text-slate-600 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  #{tab}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed tracking-wide">
              Latest Test Telemetry · <span className="text-slate-700 font-bold">Exam ID: #{telemetryTab}</span>
            </p>

            <div className="space-y-3" id="telemetry-rows-container">
              <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-white border border-slate-200 hover:border-slate-300 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-sm">
                  <IconScan />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Time Per Question</span>
                  <span className="text-[15px] font-extrabold text-slate-900">
                    {telemetryData[telemetryTab as keyof typeof telemetryData].time}{" "}
                    <span className="text-[11px] font-semibold text-slate-500">(Avg)</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-white border border-slate-200 hover:border-slate-300 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-sm">
                  <IconShieldCheck />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Negative Mark Impact</span>
                  <span className="text-[15px] font-extrabold text-slate-900">
                    {telemetryData[telemetryTab as keyof typeof telemetryData].negative}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-white border border-slate-200 hover:border-slate-300 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm">
                  <IconUsers />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Identified Guess Attempts</span>
                  <span className="text-[15px] font-extrabold text-slate-900">
                    {telemetryData[telemetryTab as keyof typeof telemetryData].guess}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-white border border-slate-200 hover:border-slate-300 transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
                  <IconSigma />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Recoverable Marks Hidden</span>
                  <span className="text-[15px] font-extrabold text-slate-900">
                    {telemetryData[telemetryTab as keyof typeof telemetryData].recoverable}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Engine Formulas Modal */}
      <Modal isOpen={formulasOpen} onClose={() => setFormulasOpen(false)} title="Formula-Driven Diagnostics Library">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Exam Neeti utilizes 3 foundational equations to convert mock telemetry into objective strategy corrections:
          </p>
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">1. Recoverable Potential (RP)</span>
              <div className="my-2 p-2.5 bg-white rounded font-mono text-sm text-slate-800 text-center border-l-2 border-indigo-500 shadow-sm">
                RP = (N_neg * W_pen) + (Q_careless * V_val) + T_panic
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">2. Guess Hazard Quotient (GHQ)</span>
              <div className="my-2 p-2.5 bg-white rounded font-mono text-sm text-slate-800 text-center border-l-2 border-emerald-500 shadow-sm">
                GHQ = Q_blind_incorrect / Q_blind_total * 100
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">3. Pace Allocation Index (PAI)</span>
              <div className="my-2 p-2.5 bg-white rounded font-mono text-sm text-slate-800 text-center border-l-2 border-amber-500 shadow-sm">
                PAI = T_question / T_ideal_batch_average
              </div>
            </div>
          </div>
          <button
            onClick={() => setFormulasOpen(false)}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            I Understand the Logic
          </button>
        </div>
      </Modal>
    </section>
  );
}
