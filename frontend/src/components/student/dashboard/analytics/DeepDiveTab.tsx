"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  IconChart, IconAlertTriangle, IconClock, IconRefresh, Spinner, IconChevronRight,
} from "../../../common/UIComponents";
import { RadialMeter, StackedBar, Heatmap } from "../../../common/Charts";
import { SectionCard, EmptyState, StatTile, subjectColor, fmtSecs, previewText } from "../../../common/DashboardUI";
import { useDrilldown } from "../drilldown/DrilldownProvider";
import { QuestionDetailModal } from "../drilldown/QuestionDetailModal";
import { studentService, type InsightQuestion, type QuestionInsightMetric, type QuestionInsightsPayload } from "../../../../services/apiServices";
import type { DashboardData } from "../useDashboardData";
import { num, orderSubjects, questionOutcomes } from "../lib";

type Lens = "accuracy" | "negative" | "time" | "recoverable";

const LENSES: { id: Lens; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "accuracy", label: "Accuracy Analysis", Icon: IconChart },
  { id: "negative", label: "Negative Marking", Icon: IconAlertTriangle },
  { id: "time", label: "Time Utilization", Icon: IconClock },
  { id: "recoverable", label: "Recoverable Marks", Icon: IconRefresh },
];

export function DeepDiveTab({ data, onViewAttempt }: { data: DashboardData; onViewAttempt: (id: string) => void }) {
  const [lens, setLens] = useState<Lens>("accuracy");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {LENSES.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setLens(id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${lens === id ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {lens === "accuracy" && <AccuracyLens data={data} />}
      {lens === "negative" && (
        <InsightLens
          data={data} metric="negative_marking" onViewAttempt={onViewAttempt}
          title="Every mark you gave back"
          stats={(t) => [
            { label: "Negative Marks", value: String(t.reduce((s, x) => s + Math.min(0, num(x.totalNegativeMarks)), 0) || -t.reduce((s, x) => s + num(x.totalNegativeMarks), 0)), tone: "risk" as const },
            { label: "Avg / Test", value: (t.length ? (t.reduce((s, x) => s + num(x.totalNegativeMarks), 0) / t.length) : 0).toFixed(1), tone: "risk" as const },
          ]}
        />
      )}
      {lens === "time" && (
        <InsightLens
          data={data} metric="slowest" onViewAttempt={onViewAttempt}
          title="Your slowest questions"
          note="The questions that ate the most time across the sprint — tap one to see whether the time paid off."
          stats={() => []}
          statsFromPayload={(p) => {
            const times = p.questions.map((q) => q.timeSpentSeconds).filter((t) => t > 0);
            if (!times.length) return [];
            const avg = times.reduce((s, t) => s + t, 0) / times.length;
            const wrong = p.questions.filter((q) => q.isCorrect === false).length;
            return [
              { label: "Slowest", value: `${Math.round(Math.max(...times))}s`, tone: "warn" as const },
              { label: "Avg on these", value: `${Math.round(avg)}s`, tone: "warn" as const },
              { label: "Still wrong", value: `${wrong}/${p.questions.length}`, tone: wrong > 0 ? ("risk" as const) : ("good" as const) },
            ];
          }}
        />
      )}
      {lens === "recoverable" && <RecoverableLens data={data} />}
    </div>
  );
}

// ─── Recoverable Marks lens ────────────────────────────────────────────────
// "Recoverable marks" is a composite (wrong-easy + negative loss + skipped
// high-value + …) — there is no single question list behind it. So this lens
// breaks it into the concrete, actionable buckets, each a real drill-down.
function RecoverableLens({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { timeline } = data.analytics;
  const total = timeline.reduce((s, x) => s + num(x.totalRecoverable), 0);
  const avg = timeline.length ? total / timeline.length : 0;

  const buckets: { label: string; hint: string; metric: QuestionInsightMetric; params?: Record<string, string>; tone: "risk" | "warn" | "brand" }[] = [
    { label: "Wrong on easy questions", hint: "Questions you should have banked", metric: "incorrect", params: { difficulty: "easy" }, tone: "risk" },
    { label: "Negative marking", hint: "Marks handed back on wrong answers", metric: "negative_marking", tone: "risk" },
    { label: "Rushed guesses", hint: "Answered too fast and got wrong", metric: "guesses", tone: "warn" },
    { label: "Left blank", hint: "Skipped — some were winnable", metric: "unattempted", tone: "brand" },
    { label: "High-value reached too late", hint: "Attempted after the easy marks were gone", metric: "missed_high_roi", tone: "warn" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        <StatTile label="Recoverable Marks" value={total.toFixed(0)} sub="est. marks you could win back" tone="brand" />
        <StatTile label="Avg / Test" value={avg.toFixed(1)} sub={`over ${timeline.length} test${timeline.length !== 1 ? "s" : ""}`} tone="brand" />
        <StatTile label="Best Test %" value={`${timeline.reduce((m, t) => Math.max(m, num(t.percentage)), 0).toFixed(0)}%`} sub="your ceiling — the target" tone="good" />
      </div>

      <SectionCard title="Where these marks are hiding" subtitle="Each bucket opens the exact questions — fixing these is the fastest score gain" icon={IconRefresh}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {buckets.map((b) => (
            <RecoverableBucket key={b.label} data={data} bucket={b} onOpen={() => open({
              title: b.label,
              subtitle: b.hint,
              metric: b.metric,
              params: b.params,
            })} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function RecoverableBucket({
  data,
  bucket,
  onOpen,
}: {
  data: DashboardData;
  bucket: { label: string; hint: string; metric: QuestionInsightMetric; params?: Record<string, string>; tone: "risk" | "warn" | "brand" };
  onOpen: () => void;
}) {
  const { selectedSprintId } = data;
  const [count, setCount] = useState<number | null>(null);
  const [marks, setMarks] = useState<number>(0);

  useEffect(() => {
    if (!selectedSprintId) return;
    let cancelled = false;
    setCount(null);
    studentService.getSprintQuestionInsights(selectedSprintId, { metric: bucket.metric, ...bucket.params })
      .then((res) => {
        if (cancelled) return;
        const p = (res?.data ?? res) as QuestionInsightsPayload;
        setCount(p.totalCount || 0);
        setMarks(p.questions.reduce((s, q) => s + Math.abs(Math.min(0, q.marksAwarded)), 0));
      })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, [selectedSprintId, bucket.metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const toneCls = bucket.tone === "risk" ? "text-rose-600" : bucket.tone === "warn" ? "text-amber-600" : "text-indigo-600";
  const empty = count === 0;

  return (
    <button
      onClick={onOpen}
      disabled={empty}
      className={`dash-inset p-3.5 text-left flex items-start gap-3 ${empty ? "opacity-50 cursor-default" : "dash-clickable group"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-800">{bucket.label}</p>
        <p className="text-[10px] font-semibold text-slate-400 mt-0.5 leading-snug">{bucket.hint}</p>
        <p className={`text-[11px] font-black mt-1.5 ${toneCls}`}>
          {count == null ? "…" : count === 0 ? "None — clear" : `${count} question${count !== 1 ? "s" : ""}${marks > 0 ? ` · ${marks} mks` : ""}`}
        </p>
      </div>
      {!empty && <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0 mt-0.5" />}
    </button>
  );
}

// ─── Accuracy lens ─────────────────────────────────────────────────────────
function AccuracyLens({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { summary, subjectPerformance, topicPerformance } = data.analytics;
  const o = useMemo(() => questionOutcomes(subjectPerformance), [subjectPerformance]);
  const guesses = data.analytics.errorAnalysis.guess;

  // chapter × difficulty heatmap from topic.byDifficulty
  const chapters = useMemo(() => {
    const map = new Map<string, Record<string, { correct: number; attempted: number }>>();
    for (const t of topicPerformance.all) {
      if (!t.byDifficulty) continue;
      const key = `${t.subject} · ${t.chapter}`;
      const row = map.get(key) || {};
      for (const [d, band] of Object.entries(t.byDifficulty)) {
        row[d] = row[d] || { correct: 0, attempted: 0 };
        row[d].correct += num(band.correct);
        row[d].attempted += num(band.attempted);
      }
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, v }))
      .filter((r) => Object.values(r.v).some((x) => x.attempted > 0))
      .slice(0, 12);
  }, [topicPerformance]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Overall" icon={IconChart} className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 py-2">
            <RadialMeter value={num(summary?.overallAccuracy)} size={132} strokeWidth={12} label="Accuracy" />
            <div className="grid grid-cols-3 gap-1.5 w-full">
              {[
                { l: "Total", v: o.total }, { l: "Attempted", v: o.correct + o.incorrect }, { l: "Skipped", v: o.skipped },
              ].map((x) => (
                <div key={x.l} className="dash-inset p-1.5 text-center">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">{x.l}</p>
                  <p className="text-sm font-black tabular-nums text-slate-900">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Outcome Split" subtitle={`${o.total} questions across ${data.analytics.timeline.length} test${data.analytics.timeline.length !== 1 ? "s" : ""}`} icon={IconChart} className="lg:col-span-2">
          <div className="py-2">
            <StackedBar
              height={16}
              segments={[
                { label: "Correct", value: o.correct, color: "#059669" },
                { label: "Incorrect", value: o.incorrect, color: "#e11d48" },
                { label: "Unattempted", value: o.skipped, color: "#cbd5e1" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <StatTile label="Correct" value={o.correct} tone="good" onClick={() => open({ title: "Correct questions", metric: "correct" })} />
            <StatTile label="Incorrect" value={o.incorrect} tone="risk" onClick={() => open({ title: "Incorrect questions", metric: "incorrect" })} />
            <StatTile label="Unattempted" value={o.skipped} onClick={() => open({ title: "Unattempted questions", metric: "unattempted" })} />
            <StatTile label="Guesses" value={guesses} sub={o.correct + o.incorrect > 0 ? `${Math.round((guesses / (o.correct + o.incorrect)) * 100)}% of attempts` : undefined} tone={guesses > 0 ? "warn" : "neutral"} onClick={() => open({ title: "Guessed questions", metric: "guesses" })} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Subject Breakdown" subtitle="Tap a subject to see its wrong answers" icon={IconChart}>
        <div className="space-y-2">
          {orderSubjects(subjectPerformance).map((s) => {
            const skipped = Math.max(0, num(s.totalQuestions) - num(s.attempted));
            return (
              <button key={s.subject} onClick={() => open({ title: `${s.subject} · incorrect`, metric: "incorrect", params: { subject: s.subject } })}
                className="w-full dash-inset dash-clickable p-3 flex items-center gap-3 text-left">
                <span className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: subjectColor(s.subject) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black capitalize text-slate-800">{s.subject}</span>
                    <span className="text-[11px] font-bold text-slate-500 tabular-nums">{num(s.accuracy).toFixed(0)}% acc · {num(s.attemptRate).toFixed(0)}% att</span>
                  </div>
                  <div className="mt-1.5">
                    <StackedBar showLegend={false} height={8}
                      segments={[
                        { label: "Correct", value: num(s.correct), color: "#059669" },
                        { label: "Incorrect", value: num(s.incorrect), color: "#e11d48" },
                        { label: "Skipped", value: skipped, color: "#cbd5e1" },
                      ]} />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">{s.correct} correct · {s.incorrect} wrong · {skipped} skipped</p>
                </div>
                <IconChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      </SectionCard>

      {chapters.length > 0 && (
        <SectionCard title="Accuracy Heatmap" subtitle="Chapters × difficulty — click a cell for those questions" icon={IconChart}>
          <Heatmap
            rows={chapters.map((c) => c.key)}
            columns={["easy", "medium", "hard"]}
            cell={(row, col) => {
              const c = chapters.find((x) => x.key === row);
              const d = c?.v[col];
              if (!d || d.attempted === 0) return null;
              return (d.correct / d.attempted) * 100;
            }}
            onCellClick={(row, col) => {
              const [subject, chapter] = row.split(" · ");
              open({
                title: `${chapter} · ${col[0].toUpperCase()}${col.slice(1)}`,
                subtitle: `${subject} — every question you attempted at this difficulty`,
                metric: "attempted",
                params: { subject, chapter, difficulty: col },
              });
            }}
          />
        </SectionCard>
      )}
    </div>
  );
}

// ─── Generic insight lens (Negative / Time / Recoverable) ──────────────────
type LensStat = { label: string; value: string; tone: "risk" | "brand" | "good" | "warn" | "neutral" };
function InsightLens({
  data,
  metric,
  title,
  note,
  stats,
  statsFromPayload,
  onViewAttempt,
}: {
  data: DashboardData;
  metric: QuestionInsightMetric;
  title: string;
  note?: string;
  stats: (timeline: DashboardData["analytics"]["timeline"]) => LensStat[];
  statsFromPayload?: (p: QuestionInsightsPayload) => LensStat[];
  onViewAttempt: (id: string) => void;
}) {
  const { selectedSprintId, analytics } = data;
  const [payload, setPayload] = useState<QuestionInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [subj, setSubj] = useState("");
  const [activeQ, setActiveQ] = useState<InsightQuestion | null>(null);

  useEffect(() => {
    if (!selectedSprintId) return;
    setLoading(true); setErr(false);
    studentService.getSprintQuestionInsights(selectedSprintId, { metric })
      .then((res) => setPayload((res?.data ?? res) as QuestionInsightsPayload))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [selectedSprintId, metric]);

  const questions = useMemo(() => {
    const all = payload?.questions ?? [];
    return subj ? all.filter((q) => q.subject?.toLowerCase() === subj.toLowerCase()) : all;
  }, [payload, subj]);

  const headline = payload && statsFromPayload ? statsFromPayload(payload) : stats(analytics.timeline);

  return (
    <div className="space-y-4">
      {(headline.length > 0 || payload) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {headline.map((s) => <StatTile key={s.label} label={s.label} value={s.value} tone={s.tone} />)}
          <StatTile label="Questions" value={payload?.totalCount ?? (loading ? "…" : 0)} />
          <StatTile label="Across tests" value={payload?.byExam.length ?? (loading ? "…" : 0)} />
        </div>
      )}

      <SectionCard title={title} subtitle={note} icon={IconAlertTriangle}>
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10"><Spinner className="w-6 h-6 text-indigo-600" /><p className="text-xs font-bold text-slate-500">Loading questions…</p></div>
        ) : err ? (
          <EmptyState icon={IconAlertTriangle} title="Couldn't load" desc="Please retry in a moment." />
        ) : !payload || payload.totalCount === 0 ? (
          <EmptyState icon={IconChart} title="Nothing flagged here" desc="Good news — no questions match this lens for the current sprint." />
        ) : (
          <div className="space-y-3">
            {payload.bySubject.length > 1 && (
              <div className="flex gap-1">
                {["", ...payload.bySubject.map((s) => s.subject)].map((s) => (
                  <button key={s || "all"} onClick={() => setSubj(s)}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold capitalize transition-colors ${subj === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {s || "All"}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-2">
              {questions.map((q) => (
                <li key={`${q.attemptId}-${q.slotPosition}`}>
                  <button onClick={() => setActiveQ(q)} className="w-full text-left dash-card-flat dash-clickable p-3 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 text-white" style={{ backgroundColor: subjectColor(q.subject) }}>Q{q.slotPosition}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{q.questionText ? previewText(q.questionText) : `${q.chapter} · ${q.topic}`}</p>
                      <div className="flex flex-wrap gap-x-2 text-[10px] font-semibold text-slate-400 mt-0.5">
                        <span className="truncate max-w-[120px]">{q.examTitle}</span>
                        <span className="capitalize">{q.difficulty}</span>
                        <span>{fmtSecs(q.timeSpentSeconds)}</span>
                        {q.yourAnswer && <span>You: {q.yourAnswer}</span>}
                        {q.correctAnswer && <span className="text-emerald-600">Ans: {q.correctAnswer}</span>}
                        <span className={q.marksAwarded < 0 ? "text-rose-600" : q.marksAwarded > 0 ? "text-emerald-600" : "text-slate-400"}>{q.marksAwarded > 0 ? "+" : ""}{q.marksAwarded} mks</span>
                        <span className="text-indigo-500">{q.reason}</span>
                      </div>
                    </div>
                    <IconChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <QuestionDetailModal q={activeQ} onClose={() => setActiveQ(null)} onViewAttempt={onViewAttempt} />
    </div>
  );
}
