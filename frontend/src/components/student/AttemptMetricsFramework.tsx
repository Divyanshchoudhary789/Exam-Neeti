"use client";

import React, { useMemo, useState } from "react";
import {
  IconChart, IconClock, IconAlertTriangle, IconTarget, IconRefresh, IconBook, IconTrendingUp, FormulaInfo,
} from "../common/UIComponents";
import {
  RadialMeter, GaugeArc, DonutChart, HBarChart, StackedBar, AreaLineChart, RadarChart, Heatmap,
} from "../common/Charts";
import { SectionCard } from "../common/DashboardUI";
import { MetricQuestionsModal, type MQResponse } from "./MetricQuestionsModal";

// ── Loose data contract — the caller passes the already-derived framework bags ──
export interface MFProps {
  responses: MQResponse[];
  analytics: Record<string, unknown>;
  advancedAnalytics: Record<string, unknown>;
  errorClassification: Record<string, unknown>;
  roiMetrics: Record<string, unknown>;
  fatigueCurve: Record<string, unknown>;
  reattemptMetrics: Record<string, unknown>;
  timeVariance: Record<string, unknown>;
  orderQuality: Record<string, unknown>;
  frameworkContent: Record<string, unknown>;
  frameworkBehavior: Record<string, unknown>;
  frameworkPattern: Record<string, unknown>;
  frameworkFatigue: Record<string, unknown>;
  frameworkEarly: Record<string, unknown>;
  frameworkTime: Record<string, unknown>;
  frameworkDifficulty: Record<string, unknown>;
  frameworkFoundation: Record<string, unknown>;
  frameworkAccuracyErrors: Record<string, unknown>;
  recoverableMarks: Record<string, unknown>;
  difficultyAccuracy: Record<string, unknown>[];
  difficultySummary: Record<string, unknown>[];
  subjectTimeDistribution: Record<string, unknown>[];
  topicAccuracy: Record<string, unknown>[];
  subjectBreakdown: Record<string, unknown>[];
  totalTimeSec: number;
  /** Optional — jump to the Solutions tab filtered to a set of question slots. */
  onViewInSolutions?: (slots: number[], label: string) => void;
}

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const pc = (v: unknown) => `${n(v).toFixed(1)}%`;
const secs = (v: unknown) => `${n(v).toFixed(0)}s`;
const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;

type Tone = "neutral" | "good" | "warn" | "risk" | "brand";
const bandTone = (pct: number, hiGood = true): Tone => {
  const t: Tone = pct >= 70 ? "good" : pct >= 40 ? "warn" : "risk";
  return hiGood ? t : (t === "good" ? "risk" : t === "risk" ? "good" : t);
};

const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-600", warn: "text-amber-600", risk: "text-rose-600", brand: "text-indigo-600", neutral: "text-slate-900",
};
const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500", warn: "bg-amber-500", risk: "bg-rose-500", brand: "bg-indigo-500", neutral: "bg-slate-400",
};

// ── One metric — compact, scannable, optional bar + question drill-in ─────────
function Metric({
  label, value, sub, tone = "neutral", bar, formula, calc, note, onQuestions, count,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  /** 0-100 → thin progress bar under the value */
  bar?: number | null;
  formula?: string;
  calc?: string;
  note?: string;
  onQuestions?: () => void;
  count?: number;
}) {
  const clickable = !!onQuestions && (count ?? 0) > 0;
  return (
    <div
      onClick={clickable ? onQuestions : undefined}
      className={`dash-inset p-3 flex flex-col gap-1 min-w-0 ${clickable ? "cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-slate-400 leading-snug">{label}</p>
        {formula && <FormulaInfo formula={formula} calculation={calc} note={note} />}
      </div>
      <p className={`text-base sm:text-lg font-black tabular-nums leading-tight break-words ${TONE_TEXT[tone]}`}>{value}</p>
      {bar != null && (
        <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden mt-0.5">
          <div className={`h-full rounded-full transition-all duration-700 ${TONE_BAR[tone === "neutral" ? "brand" : tone]}`} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        {sub && <p className="text-[10px] text-slate-400 font-semibold leading-snug line-clamp-2">{sub}</p>}
        {clickable && (
          <span className="text-[9px] font-black uppercase text-indigo-500 shrink-0 whitespace-nowrap">
            {count} Q →
          </span>
        )}
      </div>
    </div>
  );
}

// ── Hero stat — the headline number of a section, with an optional visual ────
function Hero({
  label, value, sub, tone = "brand", visual,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: Tone;
  visual?: React.ReactNode;
}) {
  return (
    <div className="dash-card-flat p-4 flex items-center gap-4">
      {visual && <div className="shrink-0">{visual}</div>}
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-2xl sm:text-[26px] font-black tabular-nums leading-none mt-0.5 ${TONE_TEXT[tone]}`}>{value}</p>
        {sub && <p className="text-[11px] font-semibold text-slate-400 mt-1 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

// ── Icon badge for heroes without a chart ────────────────────────────────────
function Badge({ tone, children }: { tone: "rose" | "indigo" | "emerald" | "slate" | "amber"; children: React.ReactNode }) {
  const cls = {
    rose: "bg-rose-50 text-rose-500", indigo: "bg-indigo-50 text-indigo-500", emerald: "bg-emerald-50 text-emerald-500",
    slate: "bg-slate-100 text-slate-500", amber: "bg-amber-50 text-amber-500",
  }[tone];
  return <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${cls}`}>{children}</div>;
}

// ── Question-by-question run — colour per outcome, click to open the question ─
type SeqState = "correct" | "incorrect" | "skipped";
function SequenceStrip({
  items, onPick, dense = false,
}: {
  items: { slot: number; state: SeqState; title: string }[];
  onPick?: (slot: number) => void;
  dense?: boolean;
}) {
  if (!items.length) return null;
  const sz = dense ? "w-4 h-4 text-[0px]" : "w-6 h-6 text-[9px]";
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <button
            key={it.slot}
            type="button"
            title={it.title}
            onClick={onPick ? () => onPick(it.slot) : undefined}
            className={`${sz} rounded-md font-black flex items-center justify-center transition-transform ${onPick ? "cursor-pointer hover:scale-125 hover:z-10 relative" : "cursor-default"} ${
              it.state === "correct" ? "bg-emerald-500 text-white"
              : it.state === "incorrect" ? "bg-rose-500 text-white"
              : "bg-slate-200 text-slate-500"
            }`}
          >
            {dense ? "" : it.slot}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] font-bold text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" />Correct</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" />Incorrect</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200" />Skipped</span>
        {onPick && <span className="text-slate-300">· tap a question to open it</span>}
      </div>
    </div>
  );
}

// ── Per-question time bars — height = time, colour = outcome ─────────────────
function TimeBars({
  items, onPick,
}: {
  items: { slot: number; time: number; state: SeqState; title: string }[];
  onPick?: (slot: number) => void;
}) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.time), 1);
  return (
    <div className="flex items-end gap-[3px] h-28 w-full overflow-x-auto pb-1">
      {items.map((it) => (
        <button
          key={it.slot}
          type="button"
          title={it.title}
          onClick={onPick ? () => onPick(it.slot) : undefined}
          className={`flex-1 min-w-[5px] rounded-t transition-all hover:opacity-70 ${onPick ? "cursor-pointer" : "cursor-default"} ${
            it.state === "correct" ? "bg-emerald-500" : it.state === "incorrect" ? "bg-rose-500" : "bg-slate-300"
          }`}
          style={{ height: `${Math.max(4, (it.time / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ── Labelled comparison bars (raw values, not %) ────────────────────────────
function CompareBars({ items }: { items: { label: string; value: number; display: string; color?: string }[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
            <span>{it.label}</span>
            <span className="tabular-nums text-slate-500">{it.display}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Math.abs(it.value) / max) * 100}%`, backgroundColor: it.color || "#6366f1" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const SECTIONS = [
  { id: "summary", label: "Summary", Icon: IconChart },
  { id: "errors", label: "Errors", Icon: IconAlertTriangle },
  { id: "roi", label: "ROI & Value", Icon: IconTarget },
  { id: "timing", label: "Timing & Pace", Icon: IconClock },
  { id: "strategy", label: "Strategy", Icon: IconTrendingUp },
  { id: "behavior", label: "Reattempts & Fatigue", Icon: IconRefresh },
  { id: "content", label: "Content & Difficulty", Icon: IconBook },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function AttemptMetricsFramework(p: MFProps) {
  const [section, setSection] = useState<SectionId>("summary");
  const [modal, setModal] = useState<{ title: string; subtitle?: string; qs: MQResponse[] } | null>(null);

  const {
    responses, analytics, advancedAnalytics, errorClassification, roiMetrics, fatigueCurve,
    reattemptMetrics, timeVariance, orderQuality, frameworkContent, frameworkBehavior,
    frameworkPattern, frameworkFatigue, frameworkEarly, frameworkTime, frameworkDifficulty,
    frameworkFoundation, frameworkAccuracyErrors, recoverableMarks, difficultyAccuracy,
    difficultySummary, subjectTimeDistribution, topicAccuracy, subjectBreakdown, totalTimeSec,
  } = p;

  // ── question drill-ins ────────────────────────────────────────────────────
  const bySlot = useMemo(() => {
    const m = new Map<number, MQResponse>();
    for (const r of responses) if (r.slotPosition != null) m.set(Number(r.slotPosition), r);
    return m;
  }, [responses]);

  const openSlots = (raw: Array<{ slotPosition?: number } | number> | undefined, title: string, subtitle?: string) => {
    const slots = new Set(
      (raw || []).map((x) => (typeof x === "number" ? x : Number(x?.slotPosition))).filter((x) => Number.isFinite(x)),
    );
    const qs = [...slots].map((s) => bySlot.get(s)).filter(Boolean) as MQResponse[];
    if (qs.length) setModal({ title, subtitle, qs });
  };
  const openFilter = (pred: (r: MQResponse) => boolean, title: string, subtitle?: string) => {
    const qs = responses.filter(pred);
    if (qs.length) setModal({ title, subtitle, qs });
  };
  const openOne = (slot: number) => {
    const q = bySlot.get(slot);
    if (q) setModal({ title: `Question ${slot}`, qs: [q] });
  };

  const incorrectQs = responses.filter((r) => r.isAttempted && r.isCorrect === false);
  const unattemptedQs = responses.filter((r) => !r.isAttempted);
  const negativeQs = responses.filter((r) => n(r.marksAwarded) < 0);
  const overThreshMs = n(analytics.avgTimePerQuestion) * 1.5;

  const sillyN = n(errorClassification.sillyMistakes);
  const conceptN = n(errorClassification.conceptErrors);
  const guessN = n(errorClassification.guesses ?? analytics.totalGuessAttempts);
  const totalErr = sillyN + conceptN + guessN;

  const rho = n(orderQuality.spearmanRho, NaN);
  const rhoPct = Number.isNaN(rho) ? 0 : ((rho + 1) / 2) * 100;

  const streak = (advancedAnalytics.streakMetrics as Record<string, unknown>) || {};
  const slowdown = frameworkTime.slowdownPoint as Record<string, unknown> | undefined;
  const streakBreak = frameworkPattern.streakBreakPoint as Record<string, unknown> | null;
  const peakWindow = frameworkFatigue.peakPerformanceWindow as Record<string, unknown> | undefined;
  const rollingWindows = (fatigueCurve.rollingWindows as Record<string, unknown>[]) || [];

  const totalQ = n(analytics.totalQuestions, responses.length);
  const attempted = n(analytics.totalAttempted);
  const correct = n(analytics.totalCorrect);
  const incorrect = n(analytics.totalIncorrect);
  const unatt = n(analytics.totalUnattempted, unattemptedQs.length);
  const accuracyN = n(analytics.overallAccuracy);

  // ── derived visuals ──────────────────────────────────────────────────────
  const sequence = useMemo(() => {
    return [...responses]
      .filter((r) => r.slotPosition != null)
      .sort((a, b) => n(a.slotPosition) - n(b.slotPosition))
      .map((r) => {
        const state: SeqState = !r.isAttempted ? "skipped" : r.isCorrect ? "correct" : "incorrect";
        return {
          slot: n(r.slotPosition),
          time: n(r.timeSpentSeconds),
          state,
          title: `Q${n(r.slotPosition)} · ${state} · ${fmtTime(n(r.timeSpentSeconds))}${r.selectedAnswer ? ` · you: ${r.selectedAnswer}` : ""}`,
        };
      });
  }, [responses]);

  const attemptedResp = responses.filter((r) => r.isAttempted);
  const avgConfidence = attemptedResp.length
    ? attemptedResp.reduce((s, r) => s + n(r.confidence), 0) / attemptedResp.length
    : 0;

  const roiRho = orderQuality;
  const soi = (roiMetrics.soiBreakdown as Record<string, unknown>) || {};

  // subject rollup for the radar / heatmap (from difficultyAccuracy rows: difficulty × subject)
  const subjectRollup = useMemo(() => {
    const by: Record<string, { correct: number; attempted: number; total: number }> = {};
    for (const d of difficultyAccuracy) {
      const k = String(d.subject || "").toLowerCase();
      if (!k) continue;
      by[k] = by[k] || { correct: 0, attempted: 0, total: 0 };
      by[k].correct += n(d.correct); by[k].attempted += n(d.attempted); by[k].total += n(d.totalQuestions);
    }
    // fall back to subjectBreakdown if difficultyAccuracy is empty
    if (!Object.keys(by).length) {
      for (const s of subjectBreakdown) {
        const k = String(s.subject || "").toLowerCase();
        if (!k) continue;
        by[k] = { correct: n(s.correct), attempted: n(s.attempted), total: n(s.totalQuestions ?? s.attempted) };
      }
    }
    return by;
  }, [difficultyAccuracy, subjectBreakdown]);
  const subjectKeys = Object.keys(subjectRollup);

  return (
    <div className="space-y-4">
      {/* section nav */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setSection(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              section === id ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ══ SUMMARY ══════════════════════════════════════════════════════════ */}
      {section === "summary" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Hero label="Accuracy" value={pc(analytics.overallAccuracy)} sub={`${correct} correct of ${attempted} attempted`} tone={bandTone(accuracyN)}
              visual={<RadialMeter value={accuracyN} size={72} strokeWidth={7} />} />
            <Hero label="Attempt Rate" value={pc(analytics.overallAttemptRate)} sub={`${attempted} of ${totalQ} questions`} tone={bandTone(n(analytics.overallAttemptRate))}
              visual={<RadialMeter value={n(analytics.overallAttemptRate)} size={72} strokeWidth={7} />} />
            <Hero label="Negative Marks" value={n(analytics.totalNegativeMarks).toFixed(1)} sub={`from ${incorrect} wrong answers`} tone={n(analytics.totalNegativeMarks) < 0 || incorrect > 0 ? "risk" : "neutral"}
              visual={<Badge tone="rose"><IconAlertTriangle className="w-7 h-7" /></Badge>} />
          </div>

          <SectionCard title="Your run, question by question" subtitle="In the order you attempted them — tap any square to open that question" icon={IconChart}>
            <div className="pt-1">
              <SequenceStrip items={sequence} onPick={openOne} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Attempt composition" subtitle="How the paper broke down for you" icon={IconChart}>
              <div className="flex flex-col xs:flex-row items-center gap-4 py-1">
                <DonutChart size={124} strokeWidth={16} centerLabel={`${totalQ}`} centerSublabel="questions"
                  data={[
                    { label: "Correct", value: correct, color: "#059669" },
                    { label: "Incorrect", value: incorrect, color: "#e11d48" },
                    { label: "Unattempted", value: unatt, color: "#cbd5e1" },
                  ]} />
                <div className="w-full">
                  <StackedBar height={16} segments={[
                    { label: "Correct", value: correct, color: "#059669" },
                    { label: "Incorrect", value: incorrect, color: "#e11d48" },
                    { label: "Unattempted", value: unatt, color: "#cbd5e1" },
                  ]} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Score picture" subtitle="Marks won vs marks lost to negatives" icon={IconTarget}>
              <div className="py-2 space-y-3">
                <CompareBars items={[
                  { label: "Marks from correct answers", value: n(analytics.totalPositiveMarks ?? correct * 4), display: `+${n(analytics.totalPositiveMarks ?? correct * 4).toFixed(0)}`, color: "#059669" },
                  { label: "Marks lost to negatives", value: Math.abs(n(analytics.totalNegativeMarks)), display: n(analytics.totalNegativeMarks).toFixed(1), color: "#e11d48" },
                  { label: "Recoverable (realistic)", value: n(recoverableMarks.totalRecoverable), display: n(recoverableMarks.totalRecoverable).toFixed(1), color: "#6366f1" },
                ]} />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Fundamentals" subtitle="Every headline number — the (i) shows how each is worked out" icon={IconChart} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Total Questions" value={totalQ} sub="in the paper"
              formula="Count of all questions in the paper" calc={`${totalQ} questions`} />
            <Metric label="Correct" value={correct} tone="good" sub="answered correctly"
              formula="Count of responses marked correct" calc={`${correct} of ${totalQ}`} />
            <Metric label="Incorrect" value={incorrect} tone="risk" sub="answered wrongly"
              formula="Count of attempted responses marked incorrect" calc={`${incorrect} of ${attempted} attempted`}
              count={incorrectQs.length} onQuestions={() => setModal({ title: "Incorrect answers", subtitle: `${incorrectQs.length} questions`, qs: incorrectQs })} />
            <Metric label="Unattempted" value={unatt} sub="left blank"
              formula="Total Questions − Attempted" calc={`${totalQ} − ${attempted} = ${unatt}`}
              count={unattemptedQs.length} onQuestions={() => setModal({ title: "Unattempted questions", subtitle: `${unattemptedQs.length} questions`, qs: unattemptedQs })} />
            <Metric label="Negative Marks" value={n(analytics.totalNegativeMarks).toFixed(1)} tone="risk" sub="marks lost"
              formula="Sum of negative marks across every incorrect answer" calc={`${incorrect} wrong → ${n(analytics.totalNegativeMarks).toFixed(1)} lost`}
              count={negativeQs.length} onQuestions={() => setModal({ title: "Negative marking", subtitle: `${negativeQs.length} questions`, qs: negativeQs })} />
            <Metric label="Guess Rate" value={pc(errorClassification.guessRate)} tone={bandTone(n(errorClassification.guessRate), false)} bar={n(errorClassification.guessRate)}
              sub={`${guessN} guesses`} formula="Guesses ÷ Attempted × 100"
              calc={`${guessN} ÷ ${attempted} × 100 = ${pc(errorClassification.guessRate)}`}
              note="A response counts as a guess when confidence < 50% AND time spent < 60% of your average time per question."
              count={(errorClassification.guessQuestions as unknown[] | undefined)?.length}
              onQuestions={() => openSlots(errorClassification.guessQuestions as Array<{ slotPosition?: number }>, "Guessed questions")} />
            <Metric label="First-Attempt Accuracy" value={pc(frameworkFoundation.firstAttemptAccuracyPercent)} bar={n(frameworkFoundation.firstAttemptAccuracyPercent)}
              tone={bandTone(n(frameworkFoundation.firstAttemptAccuracyPercent))} sub="correct before any reattempt"
              formula="Correct on first answer ÷ Attempted × 100" calc={`${pc(frameworkFoundation.firstAttemptAccuracyPercent)} of ${attempted} attempted`} />
            <Metric label="Reattempt Accuracy" value={pc(frameworkFoundation.reattemptAccuracyPercent)} bar={n(frameworkFoundation.reattemptAccuracyPercent)}
              tone={bandTone(n(frameworkFoundation.reattemptAccuracyPercent))} sub="correct on reattempted Qs"
              formula="Correct after reattempt ÷ Total reattempted questions × 100"
              calc={`${n(reattemptMetrics.totalReattempts)} reattempted → ${pc(frameworkFoundation.reattemptAccuracyPercent)} correct`} />
            <Metric label="Careless Error Rate" value={pc(frameworkFoundation.carelessErrorRatePercent)} tone="risk" bar={n(frameworkFoundation.carelessErrorRatePercent)}
              sub="careless mistakes ÷ attempted" formula="Careless mistakes ÷ Attempted × 100"
              calc={`${sillyN} ÷ ${attempted} × 100 = ${pc(frameworkFoundation.carelessErrorRatePercent)}`}
              note="Same classification as Silly Mistakes, expressed against all attempted questions."
              count={(errorClassification.sillyMistakeQuestions as unknown[] | undefined)?.length}
              onQuestions={() => openSlots(errorClassification.sillyMistakeQuestions as Array<{ slotPosition?: number }>, "Careless / silly mistakes")} />
            <Metric label="Known-Question Accuracy" value={pc(frameworkAccuracyErrors.knownQuestionAccuracyPercent)} bar={n(frameworkAccuracyErrors.knownQuestionAccuracyPercent)}
              tone={bandTone(n(frameworkAccuracyErrors.knownQuestionAccuracyPercent))} sub="seen in a prior attempt"
              formula="Correct ÷ Attempted, restricted to questions answered in an earlier submitted attempt"
              calc={`${pc(frameworkAccuracyErrors.knownQuestionAccuracyPercent)} on questions you'd seen before`} />
            <Metric label="Recoverable Marks" value={n(recoverableMarks.totalRecoverable).toFixed(1)} tone="brand" sub="score opportunity"
              formula="Wrong-easy + Negative loss + Time misallocation + Weak-topic misses + Skipped high-value"
              calc={`${n(recoverableMarks.incorrectEasyQuestions).toFixed(1)} + ${n(recoverableMarks.negativeLoss).toFixed(1)} + ${n(recoverableMarks.timeMisallocation).toFixed(1)} + ${n(recoverableMarks.lowAccuracyAreas).toFixed(1)} + ${n(recoverableMarks.missedHighROI).toFixed(1)} = ${n(recoverableMarks.totalRecoverable).toFixed(1)}`} />
          </SectionCard>
        </div>
      )}

      {/* ══ ERRORS ═══════════════════════════════════════════════════════════ */}
      {section === "errors" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Error mix" subtitle="Every wrong answer, classified" icon={IconAlertTriangle}>
              {totalErr > 0 ? (
                <div className="flex flex-col xs:flex-row items-center gap-4">
                  <DonutChart size={128} strokeWidth={16} centerLabel={String(totalErr)} centerSublabel="error events"
                    data={[
                      { label: "Conceptual", value: conceptN, color: "#4f46e5" },
                      { label: "Silly", value: sillyN, color: "#7c3aed" },
                      { label: "Guessing", value: guessN, color: "#f59e0b" },
                    ]} />
                  <div className="grid gap-1.5 w-full">
                    {[
                      { l: "Conceptual errors", v: conceptN, raw: errorClassification.conceptErrorQuestions },
                      { l: "Silly mistakes", v: sillyN, raw: errorClassification.sillyMistakeQuestions },
                      { l: "Guesses", v: guessN, raw: errorClassification.guessQuestions },
                    ].map((x) => (
                      <button key={x.l} disabled={x.v === 0}
                        onClick={() => openSlots(x.raw as Array<{ slotPosition?: number }>, x.l)}
                        className="dash-inset px-3 py-2 flex items-center justify-between disabled:opacity-50 enabled:hover:border-indigo-300 enabled:cursor-pointer transition-colors">
                        <span className="text-[11px] font-bold text-slate-700">{x.l}</span>
                        <span className="text-sm font-black tabular-nums text-slate-900">{x.v}{x.v > 0 && <span className="text-[10px] text-indigo-500 ml-1">view →</span>}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-xs font-semibold text-slate-400">No errors classified — nothing wrong to break down.</p>
              )}
            </SectionCard>

            <SectionCard title="Confidence vs reality" subtitle="How your self-rated confidence compares to actual accuracy" icon={IconTarget}>
              <div className="py-2">
                <CompareBars items={[
                  { label: "Avg self-rated confidence", value: avgConfidence, display: `${avgConfidence.toFixed(0)}%`, color: "#6366f1" },
                  { label: "Actual accuracy", value: accuracyN, display: pc(accuracyN), color: accuracyN >= avgConfidence ? "#059669" : "#e11d48" },
                ]} />
                <p className="text-[11px] font-semibold text-slate-400 mt-3 leading-snug">
                  Gap of {pc(frameworkAccuracyErrors.confidenceAccuracyGapPercent)} — {avgConfidence > accuracyN + 8 ? "you're over-confident; slow down on the ones you feel sure about." : accuracyN > avgConfidence + 8 ? "you're under-confident; you know more than you back yourself for." : "your confidence tracks your accuracy well."}
                </p>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Where wrong answers come from" subtitle="Count of questions flagged under each error type" icon={IconAlertTriangle}>
            <HBarChart max={Math.max(incorrect, 1)} valueSuffix="" data={[
              { label: "Conceptual errors", value: conceptN, color: "#4f46e5", detail: `${pc(errorClassification.conceptErrorRate)} of wrong` },
              { label: "Silly mistakes", value: sillyN, color: "#7c3aed", detail: `${pc(errorClassification.sillyMistakeRate)} of wrong` },
              { label: "Guesses", value: guessN, color: "#f59e0b", detail: `${pc(errorClassification.guessRate)} of attempted` },
              { label: "Overthought & wrong", value: n(frameworkBehavior.overthinkingIndex), color: "#db2777", detail: "long time, still wrong" },
              { label: "Repeated wrong (cross-test)", value: n(frameworkBehavior.repeatedWrongQuestionsCrossTest), color: "#e11d48", detail: "also wrong before" },
            ]} />
          </SectionCard>

          <SectionCard title="Error & confidence metrics" icon={IconAlertTriangle} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Silly Mistakes" value={sillyN} tone="risk" sub={`${pc(errorClassification.sillyMistakeRate)} of wrong`}
              formula="Wrong + confidence ≥ 80% + normally ≥60% here + time ≥ 50% of avg — Rate = count ÷ Wrong × 100"
              calc={`${sillyN} ÷ ${incorrect} × 100 = ${pc(errorClassification.sillyMistakeRate)}`}
              count={(errorClassification.sillyMistakeQuestions as unknown[] | undefined)?.length}
              onQuestions={() => openSlots(errorClassification.sillyMistakeQuestions as Array<{ slotPosition?: number }>, "Silly mistakes")} />
            <Metric label="Concept Errors" value={conceptN} tone="risk" sub={`${pc(errorClassification.conceptErrorRate)} of wrong`}
              formula="Wrong + confidence 50–80% + time > 120% of avg — Rate = count ÷ Wrong × 100"
              calc={`${conceptN} ÷ ${incorrect} × 100 = ${pc(errorClassification.conceptErrorRate)}`}
              count={(errorClassification.conceptErrorQuestions as unknown[] | undefined)?.length}
              onQuestions={() => openSlots(errorClassification.conceptErrorQuestions as Array<{ slotPosition?: number }>, "Concept errors")} />
            <Metric label="Calculation Error Rate" value={pc(frameworkAccuracyErrors.calculationErrorRatePercent)} tone="risk" bar={n(frameworkAccuracyErrors.calculationErrorRatePercent)}
              sub="wrong numeric Qs, worked not guessed" formula="Wrong numeric/integer Qs worked ≥ 50% of avg wrong-answer time ÷ Wrong × 100"
              calc={`${pc(frameworkAccuracyErrors.calculationErrorRatePercent)} of ${incorrect} wrong`} />
            <Metric label="Error Rate" value={pc(frameworkAccuracyErrors.errorRatePercent)} tone="risk" bar={n(frameworkAccuracyErrors.errorRatePercent)}
              sub="wrong ÷ attempted" formula="Wrong ÷ Attempted × 100"
              calc={`${incorrect} ÷ ${attempted} × 100 = ${pc(frameworkAccuracyErrors.errorRatePercent)}`}
              count={incorrectQs.length} onQuestions={() => setModal({ title: "All incorrect answers", subtitle: `${incorrectQs.length} questions`, qs: incorrectQs })} />
            <Metric label="Confidence Gap" value={pc(frameworkAccuracyErrors.confidenceAccuracyGapPercent)} tone={n(frameworkAccuracyErrors.confidenceAccuracyGapPercent) > 20 ? "risk" : "neutral"}
              bar={n(frameworkAccuracyErrors.confidenceAccuracyGapPercent)} sub="|avg confidence − accuracy|"
              formula="| Average self-reported confidence − Actual accuracy |"
              calc={`|${avgConfidence.toFixed(0)}% − ${pc(analytics.overallAccuracy)}| = ${pc(frameworkAccuracyErrors.confidenceAccuracyGapPercent)}`}
              note="Large gap = you're over- or under-confident vs how you actually perform." />
            <Metric label="Confidence Collapse" value={n(frameworkAccuracyErrors.confidenceCollapseCount)} tone="risk"
              sub="wrong despite high confidence, high-ROI" formula="High-ROI questions attempted wrong with confidence ≥ 80%"
              calc={`${n(frameworkAccuracyErrors.confidenceCollapseCount)} such questions`} />
            <Metric label="Overthinking Index" value={n(frameworkBehavior.overthinkingIndex)} tone="risk"
              sub="high time and still wrong" formula="Wrong answers where time spent > 1.5 × your average time per question"
              calc={`${n(frameworkBehavior.overthinkingIndex)} questions took long and were still wrong`}
              count={incorrectQs.filter((r) => n(r.timeSpentSeconds) > overThreshMs).length}
              onQuestions={() => openFilter((r) => r.isAttempted === true && r.isCorrect === false && n(r.timeSpentSeconds) > overThreshMs, "Overthought & still wrong")} />
            <Metric label="Repeated Wrong (Cross-Test)" value={n(frameworkBehavior.repeatedWrongQuestionsCrossTest)} tone="risk"
              sub="also wrong in a prior attempt" formula="Wrong now AND wrong in a prior submitted attempt (last 50)"
              calc={`${n(frameworkBehavior.repeatedWrongQuestionsCrossTest)} of ${incorrect} wrong were also wrong before`} />
          </SectionCard>
        </div>
      )}

      {/* ══ ROI ══════════════════════════════════════════════════════════════ */}
      {section === "roi" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Hero label="Opportunity Index" value={n(roiMetrics.scoreOpportunityIndex).toFixed(1)} sub="avoidable marks left on the table" tone="risk"
              visual={<Badge tone="rose"><IconTarget className="w-7 h-7" /></Badge>} />
            <Hero label="Recoverable Marks" value={n(recoverableMarks.totalRecoverable).toFixed(1)} sub="realistic score you can win back" tone="brand"
              visual={<Badge tone="indigo"><IconRefresh className="w-7 h-7" /></Badge>} />
          </div>

          <SectionCard title="ROI coverage & accuracy" subtitle="ROI = expected marks per minute. Questions ranked against the rest of this paper — top 25% = high, mid 50% = medium, bottom 25% = low." icon={IconTarget}>
            <div className="space-y-3.5">
              {[
                { l: "High ROI", cov: n(roiMetrics.highROICoverage), cnt: n(roiMetrics.highROICount), acc: n(frameworkAccuracyErrors.highROIAccuracyPercent), c: "#059669" },
                { l: "Medium ROI", cov: n(roiMetrics.mediumROIAttempts), cnt: n(roiMetrics.mediumROICount), acc: null, c: "#d97706" },
                { l: "Low ROI", cov: n(roiMetrics.lowROIAttempts), cnt: n(roiMetrics.lowROICount), acc: null, c: "#e11d48" },
              ].map((x) => (
                <div key={x.l}>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>{x.l} <span className="text-slate-400 font-semibold">· {x.cnt} questions</span></span>
                    <span className="tabular-nums text-slate-500">{x.cov.toFixed(0)}% attempted{x.acc != null ? ` · ${x.acc.toFixed(0)}% accurate` : ""}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, x.cov)}%`, backgroundColor: x.c }} />
                    {x.acc != null && (
                      <span className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-900/70 rounded" style={{ left: `${Math.min(100, x.acc)}%` }} title={`${x.acc.toFixed(0)}% accuracy`} />
                    )}
                  </div>
                </div>
              ))}
              <p className="text-[10px] font-semibold text-slate-400">Bar = % attempted · the dark tick on High ROI marks your accuracy within that tier.</p>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Where the avoidable marks went" subtitle="Opportunity Index broken down" icon={IconAlertTriangle}>
              <div className="py-2">
                <StackedBar height={16} segments={[
                  { label: "Silly mistakes", value: n(soi.sillyMistakesLoss), color: "#7c3aed" },
                  { label: "Skipped high-ROI", value: n(soi.highROISkippedLoss), color: "#e11d48" },
                  { label: "Wrong low-ROI", value: n(soi.lowROIAttemptedLoss), color: "#f59e0b" },
                  { label: "Guessing", value: n(soi.guessingLoss), color: "#0ea5e9" },
                ]} />
                <p className="text-[11px] font-semibold text-slate-400 mt-3">Total avoidable loss ≈ {n(roiMetrics.scoreOpportunityIndex).toFixed(1)} marks.</p>
              </div>
            </SectionCard>

            <SectionCard title="Recoverable marks — the components" subtitle="Realistic marks you could win back" icon={IconRefresh}>
              <div className="py-2">
                <StackedBar height={16} segments={[
                  { label: "Wrong on easy", value: n(recoverableMarks.incorrectEasyQuestions), color: "#059669" },
                  { label: "Negative loss", value: Math.abs(n(recoverableMarks.negativeLoss)), color: "#e11d48" },
                  { label: "Time misallocation", value: n(recoverableMarks.timeMisallocation), color: "#d97706" },
                  { label: "Weak-topic misses", value: n(recoverableMarks.lowAccuracyAreas), color: "#4f46e5" },
                  { label: "Skipped high-value", value: n(recoverableMarks.missedHighROI), color: "#0ea5e9" },
                ]} />
                <p className="text-[11px] font-semibold text-slate-400 mt-3">Total ≈ {n(recoverableMarks.totalRecoverable).toFixed(1)} marks back in reach.</p>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Value metrics" icon={IconTarget} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="High ROI Coverage" value={pc(roiMetrics.highROICoverage)} bar={n(roiMetrics.highROICoverage)} tone={bandTone(n(roiMetrics.highROICoverage))}
              sub={`${n(roiMetrics.highROICount)} priority questions`} formula="High-ROI attempted ÷ Total high-ROI × 100" calc={`${pc(roiMetrics.highROICoverage)} attempted`} />
            <Metric label="High ROI Accuracy" value={pc(frameworkAccuracyErrors.highROIAccuracyPercent)} bar={n(frameworkAccuracyErrors.highROIAccuracyPercent)} tone={bandTone(n(frameworkAccuracyErrors.highROIAccuracyPercent))}
              sub="correct among priority Qs" formula="Correct high-ROI attempts ÷ Attempted high-ROI × 100" calc={`${pc(frameworkAccuracyErrors.highROIAccuracyPercent)} correct`} />
            <Metric label="Medium ROI Attempts" value={pc(roiMetrics.mediumROIAttempts)} bar={n(roiMetrics.mediumROIAttempts)}
              sub={`${n(roiMetrics.mediumROICount)} mid-value questions`} formula="Medium-ROI attempted ÷ Total medium-ROI × 100" calc={`${pc(roiMetrics.mediumROIAttempts)} attempted`} />
            <Metric label="Low ROI Attempts" value={pc(roiMetrics.lowROIAttempts)} tone={n(roiMetrics.lowROIAttempts) > 60 ? "risk" : "neutral"} bar={n(roiMetrics.lowROIAttempts)}
              sub={`${n(roiMetrics.lowROICount)} low-value questions`} formula="Low-ROI attempted ÷ Total low-ROI × 100" calc={`${pc(roiMetrics.lowROIAttempts)} attempted`}
              note="Bottom 25% of the paper by ROI — time was likely better spent elsewhere." />
            <Metric label="Opportunity Index" value={n(roiMetrics.scoreOpportunityIndex).toFixed(1)} tone="risk"
              sub="avoidable loss estimate" formula="Silly-mistake loss + Skipped-high-ROI loss + Wrong-low-ROI loss + Guessing loss"
              calc={`${n(soi.sillyMistakesLoss).toFixed(1)} + ${n(soi.highROISkippedLoss).toFixed(1)} + ${n(soi.lowROIAttemptedLoss).toFixed(1)} + ${n(soi.guessingLoss).toFixed(1)} = ${n(roiMetrics.scoreOpportunityIndex).toFixed(1)}`} />
            <Metric label="Recoverable Marks" value={n(recoverableMarks.totalRecoverable).toFixed(1)} tone="brand"
              sub="wrong-easy + negative + skipped high-value" formula="Sum of the recoverable-marks components" calc={`= ${n(recoverableMarks.totalRecoverable).toFixed(1)} marks`} />
          </SectionCard>
        </div>
      )}

      {/* ══ TIMING ═══════════════════════════════════════════════════════════ */}
      {section === "timing" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Hero label="Total Time" value={fmtTime(n(analytics.totalTimeSeconds, totalTimeSec))} sub="submitted duration" tone="good"
              visual={<Badge tone="emerald"><IconClock className="w-7 h-7" /></Badge>} />
            <Hero label="Avg / Question" value={secs(analytics.avgTimePerQuestion)} sub={`across ${totalQ} questions`} tone="neutral"
              visual={<Badge tone="slate"><IconClock className="w-7 h-7" /></Badge>} />
            <Hero label="Speed Index" value={`${n(frameworkTime.speedIndex).toFixed(2)}`} sub="questions attempted per minute" tone="brand"
              visual={<Badge tone="indigo"><IconTrendingUp className="w-7 h-7" /></Badge>} />
          </div>

          <SectionCard title="Time spent per question" subtitle="Bar height = seconds · colour = outcome · tap a bar to open it" icon={IconClock}>
            <TimeBars items={sequence} onPick={openOne} />
          </SectionCard>

          {rollingWindows.length > 0 && (
            <SectionCard title="Fatigue curve" subtitle="Rolling 5-question accuracy through the paper — hover a point" icon={IconAlertTriangle}>
              <AreaLineChart color="#d97706" valueSuffix="%" data={rollingWindows.map((w) => ({
                label: `Q${w.startPosition}`, value: n(w.accuracy), detail: `Questions ${w.startPosition}–${w.endPosition}`,
              }))} />
            </SectionCard>
          )}

          <SectionCard title="How your time splits" subtitle="Average seconds by answer outcome" icon={IconClock}>
            <div className="py-1">
              <CompareBars items={[
                { label: "On correct answers", value: n(analytics.avgTimeOnCorrect ?? timeVariance.avgTimeOnCorrect), display: secs(analytics.avgTimeOnCorrect ?? timeVariance.avgTimeOnCorrect), color: "#059669" },
                { label: "On wrong answers", value: n(analytics.avgTimeOnIncorrect ?? timeVariance.avgTimeOnIncorrect), display: secs(analytics.avgTimeOnIncorrect ?? timeVariance.avgTimeOnIncorrect), color: "#e11d48" },
                { label: "Median question", value: n(frameworkTime.medianTimePerQuestionSeconds), display: secs(frameworkTime.medianTimePerQuestionSeconds), color: "#6366f1" },
                { label: "Overall average", value: n(analytics.avgTimePerQuestion), display: secs(analytics.avgTimePerQuestion), color: "#94a3b8" },
              ]} />
            </div>
          </SectionCard>

          <SectionCard title="Pace metrics" icon={IconClock} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Correct Avg Time" value={secs(analytics.avgTimeOnCorrect ?? timeVariance.avgTimeOnCorrect)} tone="good"
              sub="time on correct answers" formula="Sum of time on correct ÷ Correct count" calc={`over ${correct} correct = ${secs(analytics.avgTimeOnCorrect ?? timeVariance.avgTimeOnCorrect)}`} />
            <Metric label="Wrong Avg Time" value={secs(analytics.avgTimeOnIncorrect ?? timeVariance.avgTimeOnIncorrect)} tone="risk"
              sub="time on incorrect answers" formula="Sum of time on incorrect ÷ Incorrect count" calc={`over ${incorrect} incorrect = ${secs(analytics.avgTimeOnIncorrect ?? timeVariance.avgTimeOnIncorrect)}`} />
            <Metric label="Speed Consistency" value={secs(analytics.timeStdDeviation ?? timeVariance.standardDeviation)}
              sub="std deviation of per-Q time" formula="√( Σ(time − mean)² ÷ n ) across attempted questions" calc={`= ${secs(analytics.timeStdDeviation ?? timeVariance.standardDeviation)} — lower is steadier`} />
            <Metric label="Median Time" value={secs(frameworkTime.medianTimePerQuestionSeconds)}
              sub="middle question time" formula="Median of time spent per attempted question" calc={`middle of ${attempted} attempted = ${secs(frameworkTime.medianTimePerQuestionSeconds)}`} />
            <Metric label="First-Answer Time" value={secs(frameworkTime.firstAttemptTimeSeconds ?? frameworkEarly.foundationTimeSeconds)}
              sub="time to your first answer" formula="Time spent to submit your very first answer of the exam" calc={secs(frameworkTime.firstAttemptTimeSeconds ?? frameworkEarly.foundationTimeSeconds)} />
            <Metric label="Time / Unattempted" value={secs(frameworkTime.timePerUnattemptedSeconds)}
              sub="spent before skipping" formula="Sum of time on skipped questions ÷ Unattempted count" calc={`over ${unatt} skipped = ${secs(frameworkTime.timePerUnattemptedSeconds)} each`}
              count={unattemptedQs.length} onQuestions={() => setModal({ title: "Questions you skipped", subtitle: `${unattemptedQs.length} questions`, qs: unattemptedQs })} />
            <Metric label="Slowdown Point" value={slowdown ? `Q${slowdown.attemptIndex}` : "None"}
              sub={slowdown ? `${slowdown.beforeAvgSeconds}s → ${slowdown.afterAvgSeconds}s` : "no sharp slowdown"}
              formula="First point a 5-Q rolling avg time jumps > 35% vs the previous window"
              calc={slowdown ? `Before ${slowdown.beforeAvgSeconds}s → After ${slowdown.afterAvgSeconds}s at Q${slowdown.attemptIndex}` : "no >35% jump"} />
          </SectionCard>

          {subjectTimeDistribution.length > 0 && (
            <SectionCard title="Time per subject" subtitle="Share of your total time" icon={IconClock}>
              <HBarChart valueSuffix="%" data={subjectTimeDistribution.map((s) => ({
                label: String(s.subject || "Subject"), value: n(s.percentageOfTotal),
                detail: `${fmtTime(n(s.totalTimeSeconds))} · ${n(s.avgTimePerQuestion).toFixed(0)}s/Q`,
              }))} />
            </SectionCard>
          )}

          {difficultyAccuracy.length > 0 && (
            <SectionCard title="Avg time — difficulty × subject" subtitle="Seconds per question · correct/attempted below" icon={IconClock}>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-xs border-collapse min-w-[420px]">
                  <thead><tr>
                    <th className="text-left font-extrabold uppercase text-[10px] text-slate-400 py-2 pr-2">Difficulty</th>
                    {["physics", "chemistry", "biology"].map((s) => (
                      <th key={s} className="text-center font-extrabold uppercase text-[10px] text-slate-400 py-2 px-2 capitalize">{s}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(["easy", "medium", "hard"] as const).map((diff) => (
                      <tr key={diff} className="border-t border-slate-100">
                        <td className="py-2.5 pr-2 font-bold text-slate-800 capitalize">{diff}</td>
                        {["physics", "chemistry", "biology"].map((subj) => {
                          const cell = difficultyAccuracy.find((d) => String(d.difficulty || "").toLowerCase() === diff && String(d.subject || "").toLowerCase() === subj);
                          return (
                            <td key={subj} className="py-2.5 px-2 text-center tabular-nums">
                              {cell ? <span className="font-bold text-slate-900">{n(cell.avgTimeSeconds).toFixed(0)}s</span> : <span className="text-slate-300">—</span>}
                              {cell && <span className="block text-[10px] text-slate-400 font-semibold">{n(cell.correct)}/{n(cell.attempted)} correct</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ══ STRATEGY ═════════════════════════════════════════════════════════ */}
      {section === "strategy" && (
        <div className="space-y-4 animate-dash-in">
          <SectionCard title="Attempt order quality" subtitle="How close your attempt order was to the ideal highest-value-first order" icon={IconTrendingUp}>
            <div className="flex flex-col items-center gap-2 py-2">
              <GaugeArc value={rhoPct} size={220} caption={
                Number.isNaN(rho) ? "Not enough sequenced questions"
                : rho >= 0.5 ? `ρ = ${rho.toFixed(2)} · ${String(roiRho.interpretation || "good")} — you prioritised well`
                : rho >= 0.2 ? `ρ = ${rho.toFixed(2)} · ${String(roiRho.interpretation || "average")} — partly value-ordered`
                : rho >= -0.2 ? `ρ = ${rho.toFixed(2)} · ${String(roiRho.interpretation || "needs work")} — close to random order`
                : `ρ = ${rho.toFixed(2)} · ${String(roiRho.interpretation || "poor")} — near-reverse of ideal`
              } />
              <p className="text-[11px] font-semibold text-slate-400 text-center max-w-md">
                Spearman ρ across {String(roiRho.totalSequenced ?? "n/a")} sequenced questions. +1 = perfect priority order, 0 = random, −1 = reverse. Gauge maps −1…+1 onto 0…100%.
              </p>
            </div>
          </SectionCard>

          {sequence.length > 0 && (
            <SectionCard title="Your opening" subtitle="The first 10 questions you attempted — a strong start sets the tone" icon={IconTrendingUp}>
              <div className="pt-1">
                <SequenceStrip items={sequence.slice(0, 10)} onPick={openOne} />
              </div>
            </SectionCard>
          )}

          <SectionCard title="Early momentum" subtitle="Quality and pace of your opening stretch" icon={IconTrendingUp}>
            <div className="py-1">
              <CompareBars items={[
                { label: "First-10 accuracy", value: n(frameworkEarly.firstNAccuracyPercent), display: pc(frameworkEarly.firstNAccuracyPercent), color: bandTone(n(frameworkEarly.firstNAccuracyPercent)) === "good" ? "#059669" : bandTone(n(frameworkEarly.firstNAccuracyPercent)) === "warn" ? "#d97706" : "#e11d48" },
                { label: "Overall accuracy", value: accuracyN, display: pc(accuracyN), color: "#94a3b8" },
                { label: "Early stability (lower = steadier)", value: n(frameworkEarly.earlyAccuracyStabilityPercent), display: pc(frameworkEarly.earlyAccuracyStabilityPercent), color: "#6366f1" },
              ]} />
            </div>
          </SectionCard>

          <SectionCard title="Start & momentum metrics" icon={IconTrendingUp} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Order Quality (ρ)" value={Number.isNaN(rho) ? "—" : rho.toFixed(2)} tone={rho >= 0.4 ? "good" : rho >= 0 ? "warn" : "risk"}
              sub={String(roiRho.interpretation || "strategy score")}
              formula="Spearman ρ = 1 − (6 × Σd²) ÷ (n × (n²−1)), d = ideal rank − your actual rank"
              calc={`ρ = ${Number.isNaN(rho) ? "n/a" : rho.toFixed(2)} across ${String(roiRho.totalSequenced ?? "n/a")} sequenced questions`}
              note="'Ideal' rank blends expected ROI, easy-question bonus and marks per question." />
            <Metric label="Foundation Time" value={secs(frameworkEarly.foundationTimeSeconds)} sub="time on your first answer"
              formula="Time to submit your very first answer of the exam" calc={secs(frameworkEarly.foundationTimeSeconds)} />
            <Metric label="First-10 Accuracy" value={pc(frameworkEarly.firstNAccuracyPercent)} bar={n(frameworkEarly.firstNAccuracyPercent)} tone={bandTone(n(frameworkEarly.firstNAccuracyPercent))}
              sub="quality of your opening" formula="Correct ÷ Attempted × 100, first 10 attempted questions" calc={`${pc(frameworkEarly.firstNAccuracyPercent)} across your first ${Math.min(10, attempted)} attempts`} />
            <Metric label="Early Speed" value={secs(frameworkEarly.earlySpeedSeconds)} sub="avg time, first 10 Qs"
              formula="Average time per question across your first 10 attempted questions" calc={`${secs(frameworkEarly.earlySpeedSeconds)} average`} />
            <Metric label="Early Stability" value={pc(frameworkEarly.earlyAccuracyStabilityPercent)} tone={n(frameworkEarly.earlyAccuracyStabilityPercent) < 15 ? "good" : "warn"}
              sub={`lower = steadier (±${secs(frameworkEarly.earlyTimeSpreadSeconds)} time spread)`}
              formula="Std deviation of rolling 3-Q accuracy within your first 10 attempted questions" calc={`${pc(frameworkEarly.earlyAccuracyStabilityPercent)} — lower means steadier`} />
            <Metric label="Momentum Score" value={n(frameworkEarly.momentumScore).toFixed(1)} tone="brand"
              sub="accuracy × pace of your opening" formula="First-N Accuracy% × N ÷ (First-N total time in minutes)"
              calc={`${pc(frameworkEarly.firstNAccuracyPercent)} weighted by pace = ${n(frameworkEarly.momentumScore).toFixed(1)}`} />
          </SectionCard>
        </div>
      )}

      {/* ══ BEHAVIOR ═════════════════════════════════════════════════════════ */}
      {section === "behavior" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Hero label="Reattempt Rate" value={pc(reattemptMetrics.reattemptRate)} sub={`${n(reattemptMetrics.totalReattempts)} total`} tone="neutral" />
            <Hero label="Reattempt Efficiency" value={pc(reattemptMetrics.productiveReattemptRate)} sub={`${n(reattemptMetrics.wrongToCorrect)} wrong → correct`} tone={bandTone(n(reattemptMetrics.productiveReattemptRate))} />
            <Hero label="Longest Correct Streak" value={n(streak.goodStreakLength)} sub="best run" tone="good" />
            <Hero label="Longest Wrong Streak" value={n(streak.badStreakLength)} sub="risk run" tone="risk" />
          </div>

          <SectionCard title="Result sequence" subtitle="Streaks and alternation, in attempt order — tap a square to open it" icon={IconRefresh}>
            <div className="pt-1"><SequenceStrip items={sequence} onPick={openOne} /></div>
          </SectionCard>

          {n(reattemptMetrics.totalReattempts) > 0 && (
            <SectionCard title="What reattempts did for you" subtitle={`${n(reattemptMetrics.totalReattempts)} questions revisited`} icon={IconRefresh}>
              <div className="py-2">
                <StackedBar height={16} segments={[
                  { label: "Wrong → correct", value: n(frameworkBehavior.wrongToCorrect), color: "#059669" },
                  { label: "Stayed wrong", value: n(frameworkBehavior.wrongToWrong), color: "#e11d48" },
                  { label: "Other reattempts", value: Math.max(0, n(reattemptMetrics.totalReattempts) - n(frameworkBehavior.wrongToCorrect) - n(frameworkBehavior.wrongToWrong)), color: "#cbd5e1" },
                ]} />
              </div>
            </SectionCard>
          )}

          {rollingWindows.length > 0 && (
            <SectionCard title="Accuracy through the paper" subtitle="Rolling 5-question accuracy — dips show where fatigue set in" icon={IconAlertTriangle}>
              <AreaLineChart color="#d97706" valueSuffix="%" data={rollingWindows.map((w) => ({
                label: `Q${w.startPosition}`, value: n(w.accuracy), detail: `Questions ${w.startPosition}–${w.endPosition}`,
              }))} />
            </SectionCard>
          )}

          <SectionCard title="Reattempt behaviour" icon={IconRefresh} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Correct on Reattempt" value={n(frameworkBehavior.wrongToCorrect)} tone="good" sub="wrong → correct switches"
              formula="Reattempted Qs where the initial answer was wrong and the final answer was correct" calc={`${n(frameworkBehavior.wrongToCorrect)} of ${n(reattemptMetrics.totalReattempts)} reattempts turned right`} />
            <Metric label="Wrong Again" value={n(frameworkBehavior.wrongToWrong)} tone="risk" sub="stayed wrong after reattempt"
              formula="Reattempted Qs where both initial and final answer were wrong" calc={`${n(frameworkBehavior.wrongToWrong)} of ${n(reattemptMetrics.totalReattempts)} reattempts stayed wrong`} />
            <Metric label="Avg Reattempt Delay" value={secs(frameworkBehavior.reattemptDelaySeconds)} sub="gap before reattempting"
              formula="Average gap between first answer and reattempt" calc={`= ${secs(frameworkBehavior.reattemptDelaySeconds)}`} />
            <Metric label="Reattempt Efficiency" value={pc(frameworkBehavior.reattemptEfficiencyPercent)} bar={n(frameworkBehavior.reattemptEfficiencyPercent)}
              tone={bandTone(n(frameworkBehavior.reattemptEfficiencyPercent))} sub="productive reattempt rate"
              formula="Wrong→Correct on reattempt ÷ Total reattempts × 100"
              calc={`${n(reattemptMetrics.wrongToCorrect)} ÷ ${n(reattemptMetrics.totalReattempts)} × 100 = ${pc(frameworkBehavior.reattemptEfficiencyPercent)}`} />
            <Metric label="Time Change on Reattempt" value={secs(frameworkBehavior.timeChangeOnReattemptSeconds)} sub="extra time to finalise"
              formula="Average of (last-answer time − first-answer time) across reattempted Qs" calc={`${secs(frameworkBehavior.timeChangeOnReattemptSeconds)} extra on average`} />
            <Metric label="Smart Reattempt Rate" value={pc((frameworkBehavior.smartVsBlind as Record<string, unknown>)?.smartRatePercent)} bar={n((frameworkBehavior.smartVsBlind as Record<string, unknown>)?.smartRatePercent)}
              tone={bandTone(n((frameworkBehavior.smartVsBlind as Record<string, unknown>)?.smartRatePercent))} sub="considered vs impulsive"
              formula="Reattempts with delay > 15s ÷ Total reattempts × 100"
              calc={`${n((frameworkBehavior.smartVsBlind as Record<string, unknown>)?.consideredReattempts)} ÷ ${n(reattemptMetrics.totalReattempts)} × 100`}
              note="A reattempt within 15s of the first answer is treated as impulsive." />
            <Metric label="Overthinking Index" value={n(frameworkBehavior.overthinkingIndex)} tone="risk" sub="high time and still wrong"
              formula="Wrong answers where time spent > 1.5 × avg time per question" calc={`${n(frameworkBehavior.overthinkingIndex)} questions`}
              count={incorrectQs.filter((r) => n(r.timeSpentSeconds) > overThreshMs).length}
              onQuestions={() => openFilter((r) => r.isAttempted === true && r.isCorrect === false && n(r.timeSpentSeconds) > overThreshMs, "Overthought & still wrong")} />
          </SectionCard>

          <SectionCard title="Streaks, fatigue & recovery" icon={IconAlertTriangle} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Max Accuracy Drop" value={pc(fatigueCurve.maxDrop)} tone="risk" sub={`${n(fatigueCurve.criticalWindowsCount)} critical windows`}
              formula="Highest 5-Q rolling accuracy − Lowest 5-Q rolling accuracy" calc={`${pc(fatigueCurve.highestSpike)} − ${pc(fatigueCurve.lowestSpike)} = ${pc(fatigueCurve.maxDrop)}`} />
            <Metric label="Recovery Window" value={String(fatigueCurve.recoveryWindow ?? "None")} sub="after a sub-40% dip"
              formula="First rolling window where accuracy climbs back to ≥ 60% after dropping below 40%" calc={fatigueCurve.recoveryWindow != null ? `recovered at window #${fatigueCurve.recoveryWindow}` : "never dipped & recovered"} />
            <Metric label="Peak Window" value={String(peakWindow?.windowIndex ?? "None")} sub={`${pc(peakWindow?.accuracy)} accuracy`}
              formula="The 5-Q rolling window with the highest accuracy" calc={peakWindow ? `window #${peakWindow.windowIndex}, Qs ${peakWindow.startPosition}–${peakWindow.endPosition}` : "need ≥5 attempts"} />
            <Metric label="Accuracy Recovery" value={String(frameworkFatigue.accuracyRecovery ?? "None")} sub="recovery window index"
              formula="First window bouncing back to ≥60% accuracy after a sub-40% drop" calc={frameworkFatigue.accuracyRecovery != null ? `window #${frameworkFatigue.accuracyRecovery}` : "no recovery needed"} />
            <Metric label="Fall Rate" value={pc(frameworkDifficulty.fallRatePercent)} tone="risk" sub="first half vs second half"
              formula="max(0, First-half accuracy − Second-half accuracy), split by question order" calc={`accuracy drop = ${pc(frameworkDifficulty.fallRatePercent)}`} />
            <Metric label="Consistency Spread" value={pc(frameworkDifficulty.performanceConsistencyPercent)} tone={n(frameworkDifficulty.performanceConsistencyPercent) < 15 ? "good" : "warn"}
              sub="accuracy variance by difficulty" formula="Std deviation of accuracy across Easy/Medium/Hard buckets" calc={`= ${pc(frameworkDifficulty.performanceConsistencyPercent)}`}
              note="Lower = you perform similarly regardless of difficulty." />
            <Metric label="Alternation Count" value={n(frameworkPattern.rightWrongAlternationCount)} sub="right/wrong switches"
              formula="Consecutive attempted-Q pairs where the result flips" calc={`${n(frameworkPattern.rightWrongAlternationCount)} flips across ${attempted} attempted`} />
            <Metric label="Error Pattern Rate" value={pc((frameworkPattern.patternOfErrors as Record<string, unknown>)?.alternationRatePercent)} bar={n((frameworkPattern.patternOfErrors as Record<string, unknown>)?.alternationRatePercent)}
              sub="alternating responses" formula="Alternation Count ÷ (Attempted − 1) × 100" calc={`${n(frameworkPattern.rightWrongAlternationCount)} ÷ ${Math.max(attempted - 1, 0)} × 100`} />
            <Metric label="Streak Break Point" value={streakBreak ? String(streakBreak.label) : "None"} sub={streakBreak ? `${streakBreak.breakCount} streaks broke here` : "no repeated pattern"}
              formula="The exam quartile (Q1–Q4) where most of your correct-answer streaks ended" calc={streakBreak ? `${streakBreak.breakCount} good streaks broke in ${streakBreak.label}` : "no repeating pattern"} />
            <Metric label="Topics Fatiguing" value={n((frameworkFatigue.topicFatigue as unknown[])?.length)} tone="risk" sub="accuracy drops within a topic"
              formula="Topics (≥2 attempts) where second-half accuracy is lower than first-half" calc={`${n((frameworkFatigue.topicFatigue as unknown[])?.length)} topics decline within the topic`} />
          </SectionCard>
        </div>
      )}

      {/* ══ CONTENT ══════════════════════════════════════════════════════════ */}
      {section === "content" && (
        <div className="space-y-4 animate-dash-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {subjectKeys.length >= 3 && (
              <SectionCard title="Subject balance" subtitle="Accuracy vs attempt rate across subjects — toggle a series" icon={IconTarget}>
                <RadarChart
                  size={280}
                  axes={subjectKeys.map((k) => k[0].toUpperCase() + k.slice(1))}
                  series={[
                    { label: "Accuracy", color: "#4f46e5", values: subjectKeys.map((k) => { const v = subjectRollup[k]; return v.attempted ? (v.correct / v.attempted) * 100 : 0; }) },
                    { label: "Attempt rate", color: "#14b8a6", values: subjectKeys.map((k) => { const v = subjectRollup[k]; return v.total ? (v.attempted / v.total) * 100 : 0; }) },
                  ]}
                />
              </SectionCard>
            )}

            {difficultyAccuracy.length > 0 && (
              <SectionCard title="Accuracy heatmap" subtitle="Difficulty × subject — greener is stronger" icon={IconTarget}>
                <Heatmap
                  rows={["easy", "medium", "hard"]}
                  columns={[...new Set(difficultyAccuracy.map((d) => String(d.subject || "").toLowerCase()).filter(Boolean))]}
                  cell={(rw, col) => {
                    const c = difficultyAccuracy.find((d) => String(d.difficulty || "").toLowerCase() === rw && String(d.subject || "").toLowerCase() === col);
                    if (!c || !n(c.attempted)) return null;
                    return (n(c.correct) / n(c.attempted)) * 100;
                  }}
                />
              </SectionCard>
            )}
          </div>

          {difficultyAccuracy.length > 0 && (
            <SectionCard title="Accuracy by difficulty" subtitle="Where the paper's easy marks went" icon={IconTarget}>
              <HBarChart data={(() => {
                const RAMP: Record<string, string> = { easy: "#a5b4fc", medium: "#6366f1", hard: "#4338ca" };
                const ORDER = ["easy", "medium", "hard"];
                const by: Record<string, { correct: number; attempted: number; total: number; time: number }> = {};
                for (const d of difficultyAccuracy) {
                  const k = String(d.difficulty || "").toLowerCase();
                  by[k] = by[k] || { correct: 0, attempted: 0, total: 0, time: 0 };
                  by[k].correct += n(d.correct); by[k].attempted += n(d.attempted);
                  by[k].total += n(d.totalQuestions); by[k].time += n(d.avgTimeSeconds) * n(d.totalQuestions);
                }
                return Object.entries(by).sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b)).map(([k, v]) => ({
                  label: k, value: v.attempted > 0 ? (v.correct / v.attempted) * 100 : 0, color: RAMP[k] || "#6366f1",
                  detail: `${v.correct}/${v.attempted} correct · ${v.total > 0 ? (v.time / v.total).toFixed(0) : 0}s avg`,
                }));
              })()} valueSuffix="%" />
            </SectionCard>
          )}

          {difficultySummary.length > 0 && (
            <SectionCard title="Accuracy & attempt rate by difficulty" icon={IconTarget} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(["easy", "medium", "hard"] as const).map((diff) => {
                const row = difficultySummary.find((d) => String(d.difficulty || "").toLowerCase() === diff);
                const L = diff[0].toUpperCase() + diff.slice(1);
                return (
                  <React.Fragment key={diff}>
                    <Metric label={`${L} Accuracy`} value={pc(row?.accuracy)} bar={n(row?.accuracy)} tone={bandTone(n(row?.accuracy))}
                      sub={`${n(row?.correct)}/${n(row?.attempted)} correct`} formula="Correct ÷ Attempted × 100, this difficulty" calc={`${n(row?.correct)} ÷ ${n(row?.attempted)} × 100 = ${pc(row?.accuracy)}`} />
                    <Metric label={`${L} Attempt Rate`} value={pc(row?.attemptRate)} bar={n(row?.attemptRate)}
                      sub={`${n(row?.attempted)}/${n(row?.totalQuestions)} attempted`} formula="Attempted ÷ Total × 100, this difficulty" calc={`${n(row?.attempted)} ÷ ${n(row?.totalQuestions)} × 100 = ${pc(row?.attemptRate)}`} />
                  </React.Fragment>
                );
              })}
            </SectionCard>
          )}

          <SectionCard title="Content-type accuracy" subtitle="How you did by the kind of question" icon={IconBook}>
            <HBarChart data={[
              { label: "Assertion–Reason", value: n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.accuracy), color: "#4f46e5", detail: `${n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.attempted)} attempted` },
              { label: "Numeric / Integer", value: n((frameworkContent.numericAccuracy as Record<string, unknown>)?.accuracy), color: "#7c3aed", detail: `${n((frameworkContent.numericAccuracy as Record<string, unknown>)?.attempted)} attempted` },
              { label: "Image-based", value: n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.accuracy), color: "#0ea5e9", detail: `${n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.attempted)} attempted` },
              { label: "New questions", value: n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAccuracyPercent), color: "#059669", detail: `${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAttempted)} attempted` },
              { label: "Repeated questions", value: n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAccuracyPercent), color: "#d97706", detail: `${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAttempted)} attempted` },
            ]} valueSuffix="%" />
          </SectionCard>

          <SectionCard title="Content-type metrics" icon={IconBook} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Topic Coverage" value={pc(frameworkContent.topicCoveragePercent)} bar={n(frameworkContent.topicCoveragePercent)} tone={bandTone(n(frameworkContent.topicCoveragePercent))}
              sub="attempted topic coverage" formula="Topics with ≥1 attempt ÷ Total distinct topics × 100" calc={`${pc(frameworkContent.topicCoveragePercent)} of ${topicAccuracy.length} topics touched`} />
            <Metric label="Question-Type Coverage" value={`${((frameworkContent.questionTypeCoverage as Record<string, unknown>[] | undefined)?.length ? (frameworkContent.questionTypeCoverage as Record<string, unknown>[]).reduce((s, t) => s + n(t.coverage), 0) / (frameworkContent.questionTypeCoverage as Record<string, unknown>[]).length : 0).toFixed(1)}%`}
              sub="across question types" formula="Mean of each type's (Attempted ÷ Total of that type × 100)" calc="average across question types" />
            <Metric label="Assertion Accuracy" value={pc((frameworkContent.assertionAccuracy as Record<string, unknown>)?.accuracy)} bar={n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.accuracy)}
              tone={bandTone(n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.accuracy))} sub={`${n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.attempted)} attempted`}
              formula="Correct ÷ Attempted × 100, Assertion-Reason questions only" calc={`${n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.correct)} ÷ ${n((frameworkContent.assertionAccuracy as Record<string, unknown>)?.attempted)} × 100`} />
            <Metric label="Numeric Accuracy" value={pc((frameworkContent.numericAccuracy as Record<string, unknown>)?.accuracy)} bar={n((frameworkContent.numericAccuracy as Record<string, unknown>)?.accuracy)}
              tone={bandTone(n((frameworkContent.numericAccuracy as Record<string, unknown>)?.accuracy))} sub={`${n((frameworkContent.numericAccuracy as Record<string, unknown>)?.attempted)} attempted`}
              formula="Correct ÷ Attempted × 100, Numeric/Integer questions only" calc={`${n((frameworkContent.numericAccuracy as Record<string, unknown>)?.correct)} ÷ ${n((frameworkContent.numericAccuracy as Record<string, unknown>)?.attempted)} × 100`} />
            <Metric label="Image Accuracy" value={pc((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.accuracy)} bar={n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.accuracy)}
              tone={bandTone(n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.accuracy))} sub={`${n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.attempted)} attempted`}
              formula="Correct ÷ Attempted × 100, questions with an image" calc={`${n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.correct)} ÷ ${n((frameworkContent.imageBasedAccuracy as Record<string, unknown>)?.attempted)} × 100`} />
            <Metric label="New-Question Accuracy" value={pc((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAccuracyPercent)} bar={n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAccuracyPercent)}
              tone={bandTone(n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAccuracyPercent))} sub={`${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAttempted)} new attempts`}
              formula="Correct ÷ Attempted × 100, questions never seen before" calc={`${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAttempted)} new = ${pc((frameworkContent.newVsRepeated as Record<string, unknown>)?.newAccuracyPercent)} correct`} />
            <Metric label="Repeated-Question Accuracy" value={pc((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAccuracyPercent)} bar={n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAccuracyPercent)}
              tone={bandTone(n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAccuracyPercent))} sub={`${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAttempted)} repeated attempts`}
              formula="Correct ÷ Attempted × 100, questions seen in a prior submitted attempt" calc={`${n((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAttempted)} repeated = ${pc((frameworkContent.newVsRepeated as Record<string, unknown>)?.repeatedAccuracyPercent)} correct`} />
          </SectionCard>

          <SectionCard title="Subject & topic" icon={IconBook} bodyClassName="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Metric label="Weak Topics" value={topicAccuracy.filter((t) => t.isWeak).length} tone="risk" sub="below threshold"
              formula="Topics (≥1 attempt) with accuracy below the weak threshold (default 40%)" calc={`${topicAccuracy.filter((t) => t.isWeak).length} of ${topicAccuracy.length} attempted topics`} />
            <Metric label="Strong Topics" value={topicAccuracy.filter((t) => t.isStrong).length} tone="good" sub="above threshold"
              formula="Topics (≥1 attempt) with accuracy at/above the strong threshold (default 80%)" calc={`${topicAccuracy.filter((t) => t.isStrong).length} of ${topicAccuracy.length} attempted topics`} />
            <Metric label="Avg Topic Attempt Rate" value={`${(topicAccuracy.length ? topicAccuracy.reduce((s, t) => s + n(t.attemptRate), 0) / topicAccuracy.length : 0).toFixed(1)}%`}
              bar={topicAccuracy.length ? topicAccuracy.reduce((s, t) => s + n(t.attemptRate), 0) / topicAccuracy.length : 0}
              sub={`across ${topicAccuracy.length} topics`} formula="Mean of each topic's (Attempted ÷ Total × 100)" calc={`average across ${topicAccuracy.length} topics`} />
            {subjectBreakdown.slice(0, 3).map((s, i) => (
              <Metric key={i} label={String(s.subject || `Subject ${i + 1}`)} value={pc(s.accuracy)} bar={n(s.accuracy)} tone={bandTone(n(s.accuracy))}
                sub={`${n(s.correct)}/${n(s.attempted)} correct`} formula="Correct ÷ Attempted × 100, this subject" calc={`${n(s.correct)} ÷ ${n(s.attempted)} × 100 = ${pc(s.accuracy)}`} />
            ))}
          </SectionCard>
        </div>
      )}

      {modal && (
        <MetricQuestionsModal
          open
          onClose={() => setModal(null)}
          title={modal.title}
          subtitle={modal.subtitle}
          questions={modal.qs}
          onViewInSolutions={
            p.onViewInSolutions
              ? () =>
                  p.onViewInSolutions!(
                    modal.qs.map((q) => Number(q.slotPosition)).filter((s) => Number.isFinite(s)),
                    modal.title,
                  )
              : undefined
          }
        />
      )}
    </div>
  );
}
