"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MathRenderer } from "../common/MathRenderer";
import { IconCross, IconChevronLeft, IconChevronRight, IconCheck } from "../common/UIComponents";

// Loose shape — this modal is fed the enriched attempt responses.
export interface MQResponse {
  slotPosition?: number;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  isCorrect?: boolean | null;
  isAttempted?: boolean;
  marksAwarded?: number;
  timeSpentSeconds?: number;
  confidence?: number | null;
  wasReattempted?: boolean;
  answerChanges?: number;
  subject?: string;
  chapter?: string;
  questionData?: {
    text?: string;
    hasLatex?: boolean;
    subject?: string;
    chapter?: string;
    topic?: string;
    difficulty?: string;
    questionImage?: { url?: string | null } | null;
    options?: { key: string; text?: string; image?: { url?: string | null } | null }[];
    solution?: { text?: string; image?: { url?: string | null } | null; images?: ({ url?: string | null })[] } | null;
    correctAnswer?: string;
  };
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;

const SUBJECT_TINT: Record<string, string> = { physics: "#6366f1", chemistry: "#8b5cf6", biology: "#14b8a6" };
const subjColor = (s?: string) => SUBJECT_TINT[String(s || "").toLowerCase()] || "#64748b";

function statusOf(r: MQResponse) {
  if (r.isCorrect) return { label: "Correct", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  if (r.selectedAnswer) return { label: "Incorrect", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };
  return { label: "Skipped", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
}

export function MetricQuestionsModal({
  open,
  onClose,
  title,
  subtitle,
  questions,
  onViewInSolutions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  questions: MQResponse[];
  /** Optional — jump to the full Solutions tab filtered to these questions. */
  onViewInSolutions?: () => void;
}) {
  // A single-question modal jumps straight to the detail view — the one-row
  // list in between is pointless.
  const single = questions.length === 1;
  const [detailIdx, setDetailIdx] = useState<number | null>(single ? 0 : null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setDetailIdx((d) => (d !== null ? null : (onClose(), null))); }
      if (e.key === "ArrowRight") setDetailIdx((d) => (d !== null ? Math.min(questions.length - 1, d + 1) : d));
      if (e.key === "ArrowLeft") setDetailIdx((d) => (d !== null && d > 0 ? d - 1 : d));
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey, true); };
  }, [open, onClose, questions.length]);

  const sorted = useMemo(
    () => [...questions].sort((a, b) => (a.slotPosition ?? 0) - (b.slotPosition ?? 0)),
    [questions],
  );

  if (!open || typeof document === "undefined") return null;

  const detail = detailIdx !== null ? sorted[detailIdx] : null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-sheet-up sm:animate-none">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
          {detail && !single ? (
            <button onClick={() => setDetailIdx(null)} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
              <IconChevronLeft className="w-3.5 h-3.5" /> All {sorted.length} question{sorted.length !== 1 ? "s" : ""}
            </button>
          ) : detail && single ? (
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-[11px] font-semibold text-slate-400 capitalize">{subtitle}</p>}
            </div>
          ) : (
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">{title}</h3>
              <p className="text-[11px] font-semibold text-slate-400">{subtitle || `${sorted.length} question${sorted.length !== 1 ? "s" : ""}`}</p>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {detail && !single && (
              <>
                <button onClick={() => setDetailIdx((d) => (d && d > 0 ? d - 1 : d))} disabled={detailIdx === 0}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40 cursor-pointer" aria-label="Previous">
                  <IconChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-extrabold text-slate-400 tabular-nums px-1">{(detailIdx ?? 0) + 1}/{sorted.length}</span>
                <button onClick={() => setDetailIdx((d) => (d !== null ? Math.min(sorted.length - 1, d + 1) : d))} disabled={detailIdx === sorted.length - 1}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40 cursor-pointer" aria-label="Next">
                  <IconChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500 flex items-center justify-center cursor-pointer ml-1" aria-label="Close">
              <IconCross className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto overflow-x-hidden flex-grow px-4 sm:px-6 py-4">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-xs font-semibold text-slate-400">No questions to show for this metric.</p>
          ) : detail ? (
            <QuestionDetail r={detail} />
          ) : (
            <ul className="space-y-2">
              {onViewInSolutions && (
                <li>
                  <button onClick={() => { onViewInSolutions(); onClose(); }}
                    className="w-full text-center rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold py-2 cursor-pointer transition-colors">
                    Open these {sorted.length} in the full Solutions list ↗
                  </button>
                </li>
              )}
              {sorted.map((r, i) => {
                const st = statusOf(r);
                const qd = r.questionData || {};
                const preview = (qd.text || "")
                  .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, "")
                  .replace(/\\[a-zA-Z]+\{?|[{}]/g, "")
                  .replace(/\s+/g, " ")
                  .trim();
                return (
                  <li key={`${r.slotPosition}-${i}`}>
                    <button onClick={() => setDetailIdx(i)} className="w-full text-left rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300 hover:shadow-sm p-3 flex items-start gap-3 transition-all cursor-pointer">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 text-white" style={{ backgroundColor: subjColor(qd.subject || r.subject) }}>
                        Q{r.slotPosition}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{preview || `${qd.chapter || r.chapter || qd.subject || "Question"} · ${qd.topic || ""}`}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] font-semibold text-slate-400">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                          <span className="capitalize">{qd.difficulty || ""}</span>
                          <span>{fmtTime(r.timeSpentSeconds || 0)}</span>
                          {r.selectedAnswer && <span>You: {r.selectedAnswer}</span>}
                          {(r.correctAnswer || qd.correctAnswer) && <span className="text-emerald-600">Ans: {r.correctAnswer || qd.correctAnswer}</span>}
                          <span className={Number(r.marksAwarded) < 0 ? "text-rose-600" : Number(r.marksAwarded) > 0 ? "text-emerald-600" : ""}>
                            {Number(r.marksAwarded) > 0 ? "+" : ""}{Number(r.marksAwarded ?? 0)} mks
                          </span>
                        </div>
                      </div>
                      <IconChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuestionDetail({ r }: { r: MQResponse }) {
  const qd = r.questionData || {};
  const your = String(r.selectedAnswer || "").toUpperCase();
  const correct = String(r.correctAnswer || qd.correctAnswer || "").toUpperCase();
  const st = statusOf(r);
  const options: NonNullable<NonNullable<MQResponse["questionData"]>["options"]> =
    qd.options && qd.options.length ? qd.options : ["A", "B", "C", "D"].map((k) => ({ key: k, text: "" }));
  const solImgs = [qd.solution?.image?.url, ...((qd.solution?.images || []).map((x) => x?.url))].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 capitalize">{qd.subject || r.subject}</span>
        {(qd.chapter || r.chapter) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{qd.chapter || r.chapter}</span>}
        {qd.topic && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{qd.topic}</span>}
        {qd.difficulty && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">{qd.difficulty}</span>}
        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
      </div>

      {qd.text ? (
        <div className="text-sm font-semibold text-slate-800 leading-relaxed"><MathRenderer text={qd.text} /></div>
      ) : (
        <p className="text-xs font-semibold text-slate-400">Question text is not available.</p>
      )}
      {qd.questionImage?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qd.questionImage.url} alt="Question" className="rounded-xl border border-slate-200 max-h-64 object-contain" />
      )}

      <div className="space-y-2">
        {options.map((opt) => {
          const k = String(opt.key).toUpperCase();
          const isCorrect = k === correct;
          const isYours = k === your;
          return (
            <div key={k} className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs font-semibold ${
              isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : isYours ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${isCorrect ? "bg-emerald-600 text-white" : isYours ? "bg-rose-500 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{k}</span>
              <div className="min-w-0 flex-1">
                {opt.text ? <MathRenderer text={opt.text} inline /> : <span className="text-slate-400">Option {k}</span>}
                {opt.image?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.image.url} alt={`Option ${k}`} className="mt-1 rounded-lg border border-slate-200 max-h-28" />
                )}
              </div>
              {isCorrect && <IconCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
              {isYours && !isCorrect && <span className="text-[9px] font-black uppercase shrink-0">You</span>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Your answer", v: your || "—", c: r.isCorrect ? "text-emerald-600" : your ? "text-rose-600" : "text-slate-500" },
          { l: "Correct", v: correct || "—", c: "text-emerald-600" },
          { l: "Marks", v: Number(r.marksAwarded) > 0 ? `+${r.marksAwarded}` : String(r.marksAwarded ?? 0), c: Number(r.marksAwarded) > 0 ? "text-emerald-600" : Number(r.marksAwarded) < 0 ? "text-rose-600" : "text-slate-500" },
          { l: "Time spent", v: fmtTime(r.timeSpentSeconds || 0), c: "text-slate-700" },
          { l: "Reattempted", v: r.wasReattempted ? "Yes" : "No", c: "text-slate-700" },
          { l: "Confidence", v: r.confidence != null ? `${r.confidence}%` : "—", c: "text-slate-700" },
        ].map((x) => (
          <div key={x.l} className="dash-inset p-2.5 text-center">
            <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{x.l}</p>
            <p className={`text-sm font-black tabular-nums mt-0.5 ${x.c}`}>{x.v}</p>
          </div>
        ))}
      </div>

      {qd.solution?.text || solImgs.length ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-600">Solution</p>
          {qd.solution?.text && (
            <div className="text-xs font-medium text-slate-700 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-indigo-100">
              <MathRenderer text={qd.solution.text} />
            </div>
          )}
          {solImgs.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`Solution ${i + 1}`} className="rounded-lg border border-indigo-200 max-h-64 object-contain bg-white" />
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-slate-400 text-center py-1">No worked solution is available for this question yet.</p>
      )}
    </div>
  );
}
