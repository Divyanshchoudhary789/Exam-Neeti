"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { studentService, type InsightQuestion, type QuestionInsightMetric, type QuestionInsightsPayload } from "../../../../services/apiServices";
import { Sheet, EmptyState, fmtSecs, subjectColor, previewText } from "../../../common/DashboardUI";
import { HBarChart } from "../../../common/Charts";
import { IconAlertTriangle, IconChart, Spinner, IconChevronRight } from "../../../common/UIComponents";
import { QuestionDetailModal } from "./QuestionDetailModal";

export interface DrilldownConfig {
  title: string;
  subtitle?: string;
  formula?: string;
  calc?: string;
  note?: string;
  /** When set, the sheet fetches the exact questions behind the metric. */
  metric?: QuestionInsightMetric;
  params?: { subject?: string; chapter?: string; topic?: string; difficulty?: string; examId?: string };
  /** Optional non-question breakdown rendered above/instead of the question list. */
  breakdown?: { label: string; value: number; detail?: string; color?: string }[];
  breakdownSuffix?: string;
  breakdownMax?: number;
  customBody?: React.ReactNode;
}

interface Ctx {
  open: (cfg: DrilldownConfig) => void;
}
const DrilldownCtx = createContext<Ctx | null>(null);

export const useDrilldown = () => {
  const c = useContext(DrilldownCtx);
  if (!c) return { open: () => {} };
  return c;
};

export function DrilldownProvider({
  sprintId,
  onViewAttempt,
  children,
}: {
  sprintId: string;
  onViewAttempt: (attemptId: string) => void;
  children: React.ReactNode;
}) {
  const [cfg, setCfg] = useState<DrilldownConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<QuestionInsightsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeQ, setActiveQ] = useState<InsightQuestion | null>(null);
  const [subjFilter, setSubjFilter] = useState<string>("");

  const open = useCallback((next: DrilldownConfig) => {
    setCfg(next);
    setPayload(null);
    setErr(null);
    setSubjFilter(next.params?.subject || "");
    if (next.metric && sprintId) {
      setLoading(true);
      studentService
        .getSprintQuestionInsights(sprintId, { metric: next.metric, ...next.params })
        .then((res) => setPayload((res?.data ?? res) as QuestionInsightsPayload))
        .catch(() => setErr("Could not load the questions behind this metric."))
        .finally(() => setLoading(false));
    }
  }, [sprintId]);

  const close = useCallback(() => { setCfg(null); setPayload(null); setActiveQ(null); }, []);

  // Jumping to a full attempt view must tear the whole drill-down stack down —
  // otherwise the Sheet stays mounted on top of the analysis screen.
  const viewAttempt = useCallback((attemptId: string) => {
    setCfg(null);
    setPayload(null);
    setActiveQ(null);
    onViewAttempt(attemptId);
  }, [onViewAttempt]);

  const questions = useMemo(() => {
    const all = payload?.questions ?? [];
    return subjFilter ? all.filter((q) => q.subject?.toLowerCase() === subjFilter.toLowerCase()) : all;
  }, [payload, subjFilter]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <DrilldownCtx.Provider value={value}>
      {children}

      <Sheet
        open={!!cfg}
        onClose={close}
        title={cfg?.title ?? ""}
        subtitle={cfg?.subtitle}
      >
        {cfg && (
          <div className="space-y-4">
            {(cfg.formula || cfg.calc) && (
              <div className="rounded-xl bg-slate-900 text-white p-3">
                {cfg.formula && (
                  <>
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-300 mb-1">Formula</p>
                    <p className="text-[11.5px] font-mono leading-snug text-slate-100 break-words">{cfg.formula}</p>
                  </>
                )}
                {cfg.calc && (
                  <p className="text-[11.5px] font-mono leading-snug text-emerald-50 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5 mt-2 break-words">{cfg.calc}</p>
                )}
                {cfg.note && <p className="text-[10px] leading-snug text-slate-400 mt-2 pt-2 border-t border-white/10">{cfg.note}</p>}
              </div>
            )}

            {cfg.customBody}

            {cfg.breakdown && cfg.breakdown.length > 0 && (
              <div className="dash-inset p-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-2.5">Breakdown</p>
                <HBarChart
                  data={cfg.breakdown.map((b) => ({ label: b.label, value: b.value, detail: b.detail, color: b.color }))}
                  valueSuffix={cfg.breakdownSuffix ?? ""}
                  max={cfg.breakdownMax ?? Math.max(1, ...cfg.breakdown.map((b) => b.value))}
                />
              </div>
            )}

            {cfg.metric && (
              <>
                {loading && (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Spinner className="w-6 h-6 text-indigo-600" />
                    <p className="text-xs font-bold text-slate-500">Finding the exact questions…</p>
                  </div>
                )}
                {err && !loading && <EmptyState icon={IconAlertTriangle} title="Couldn't load questions" desc={err} />}
                {!loading && !err && payload && (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-black text-slate-800">
                        {payload.totalCount} question{payload.totalCount !== 1 ? "s" : ""}
                        <span className="text-slate-400 font-semibold"> · across {payload.byExam.length} test{payload.byExam.length !== 1 ? "s" : ""}</span>
                      </p>
                      {payload.bySubject.length > 1 && (
                        <div className="flex gap-1">
                          {["", ...payload.bySubject.map((s) => s.subject)].map((s) => (
                            <button
                              key={s || "all"}
                              onClick={() => setSubjFilter(s)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize transition-colors ${subjFilter === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                            >
                              {s || "All"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {payload.byExam.length > 1 && (
                      <div className="dash-inset p-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-2">By test</p>
                        <HBarChart
                          data={payload.byExam.map((e) => ({ label: e.examTitle, value: e.count, detail: `${e.marks > 0 ? "+" : ""}${e.marks} mks` }))}
                          valueSuffix=""
                          max={Math.max(1, ...payload.byExam.map((e) => e.count))}
                        />
                      </div>
                    )}

                    {questions.length === 0 ? (
                      <EmptyState
                        icon={IconChart}
                        title={
                          cfg.metric === "incorrect" || cfg.metric === "negative_marking" ? "Nothing wrong here"
                          : cfg.metric === "unattempted" ? "You attempted them all"
                          : cfg.metric === "attempted" || cfg.metric === "all_questions" ? "No questions in this slice"
                          : "Nothing to show here"
                        }
                        desc={
                          cfg.metric === "incorrect" ? "You got every question in this selection right — no misses to review."
                          : cfg.metric === "negative_marking" ? "No marks were lost to wrong answers here."
                          : cfg.metric === "unattempted" ? "Every question in this selection was attempted."
                          : "No questions match this selection in the current sprint."
                        }
                      />
                    ) : (
                      <ul className="space-y-2">
                        {questions.map((q) => (
                          <li key={`${q.attemptId}-${q.slotPosition}`}>
                            <button
                              onClick={() => setActiveQ(q)}
                              className="w-full text-left dash-card-flat dash-clickable p-3 flex items-start gap-3"
                            >
                              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 text-white" style={{ backgroundColor: subjectColor(q.subject) }}>
                                Q{q.slotPosition}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {q.questionText ? previewText(q.questionText) : `${q.chapter || q.subject} · ${q.topic || ""}`}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] font-semibold text-slate-400">
                                  <span className="truncate max-w-[120px]">{q.examTitle}</span>
                                  <span className="capitalize">{q.difficulty}</span>
                                  <span>{fmtSecs(q.timeSpentSeconds)}</span>
                                  {q.yourAnswer && <span>You: {q.yourAnswer}</span>}
                                  {q.correctAnswer && <span className="text-emerald-600">Ans: {q.correctAnswer}</span>}
                                  <span className={q.marksAwarded < 0 ? "text-rose-600" : q.marksAwarded > 0 ? "text-emerald-600" : ""}>
                                    {q.marksAwarded > 0 ? "+" : ""}{q.marksAwarded} mks
                                  </span>
                                </div>
                              </div>
                              <IconChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>

      <QuestionDetailModal q={activeQ} onClose={() => setActiveQ(null)} onViewAttempt={viewAttempt} />
    </DrilldownCtx.Provider>
  );
}
