"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { MathRenderer } from "../../../common/MathRenderer";
import { IconCross } from "../../../common/UIComponents";
import { fmtSecs } from "../../../common/DashboardUI";
import type { InsightQuestion } from "../../../../services/apiServices";

const OPT_KEYS = ["A", "B", "C", "D"];

export function QuestionDetailModal({
  q,
  onClose,
  onViewAttempt,
}: {
  q: InsightQuestion | null;
  onClose: () => void;
  onViewAttempt?: (attemptId: string) => void;
}) {
  // Escape + scroll lock while open. This modal deliberately sits ABOVE the
  // drill-down Sheet (z-[120]) — it is opened from inside it — so it uses its
  // own high-z portal rather than the shared CommonModal (z-50).
  useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [q, onClose]);

  if (!q || typeof document === "undefined") return null;

  const your = (q.yourAnswer || "").toUpperCase();
  const correct = (q.correctAnswer || "").toUpperCase();
  const options: NonNullable<InsightQuestion["options"]> = q.options && q.options.length
    ? q.options
    : OPT_KEYS.map((k) => ({ key: k, text: "" }));

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-sheet-up sm:animate-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Question {q.slotPosition}</h3>
            <p className="text-[11px] font-semibold text-slate-400 truncate">{q.examTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0" aria-label="Close">
            <IconCross className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overflow-x-hidden flex-grow px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 capitalize">{q.subject}</span>
            {q.chapter && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{q.chapter}</span>}
            {q.topic && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{q.topic}</span>}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">{q.difficulty}</span>
            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md ${q.reason.toLowerCase().includes("correct") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{q.reason}</span>
          </div>

          {q.questionText ? (
            <div className="text-sm font-semibold text-slate-800 leading-relaxed">
              <MathRenderer text={q.questionText} />
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-400">Question text is not available for this question.</p>
          )}
          {q.questionImage?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.questionImage.url} alt="Question" className="rounded-xl border border-slate-200 max-h-64" />
          )}

          <div className="space-y-2">
            {options.map((opt) => {
              const k = opt.key.toUpperCase();
              const isCorrect = k === correct;
              const isYours = k === your;
              return (
                <div
                  key={k}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs font-semibold ${
                    isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : isYours ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${isCorrect ? "bg-emerald-600 text-white" : isYours ? "bg-rose-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{k}</span>
                  <div className="min-w-0 flex-1">
                    {opt.text ? <MathRenderer text={opt.text} inline /> : <span className="text-slate-400">Option {k}</span>}
                    {opt.image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.image.url} alt={`Option ${k}`} className="mt-1 rounded-lg border border-slate-200 max-h-28" />
                    )}
                  </div>
                  {isCorrect && <span className="text-[9px] font-black uppercase shrink-0">Correct</span>}
                  {isYours && !isCorrect && <span className="text-[9px] font-black uppercase shrink-0">You</span>}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "Your answer", v: your || "—", tone: q.isCorrect ? "text-emerald-600" : your ? "text-rose-600" : "text-slate-500" },
              { l: "Correct", v: correct || "—", tone: "text-emerald-600" },
              { l: "Marks", v: q.marksAwarded > 0 ? `+${q.marksAwarded}` : String(q.marksAwarded), tone: q.marksAwarded > 0 ? "text-emerald-600" : q.marksAwarded < 0 ? "text-rose-600" : "text-slate-500" },
              { l: "Time spent", v: fmtSecs(q.timeSpentSeconds), tone: "text-slate-700" },
              { l: "Ideal time", v: q.idealTimeSeconds ? fmtSecs(q.idealTimeSeconds) : "—", tone: "text-slate-700" },
              { l: "Confidence", v: q.confidence != null ? `${q.confidence}%` : "—", tone: "text-slate-700" },
            ].map((x) => (
              <div key={x.l} className="dash-inset p-2.5 text-center">
                <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{x.l}</p>
                <p className={`text-sm font-black tabular-nums mt-0.5 ${x.tone}`}>{x.v}</p>
              </div>
            ))}
          </div>

          {q.solution?.text ? (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-600 mb-1.5">Solution</p>
              <div className="text-xs font-medium text-slate-700 leading-relaxed">
                <MathRenderer text={q.solution.text} />
              </div>
              {q.solution.image?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.solution.image.url} alt="Solution" className="mt-2 rounded-lg border border-slate-200 max-h-64" />
              )}
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-slate-400 text-center py-1">No worked solution is available for this question yet.</p>
          )}

          {onViewAttempt && q.attemptId && (
            <button
              onClick={() => { onClose(); onViewAttempt(q.attemptId); }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Open the full analysis for {q.examTitle}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
