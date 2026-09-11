"use client";

import React, { useMemo, useState } from "react";
import {
  IconChart, IconBook, IconCheck, IconClock, IconTarget, IconRefresh,
  IconChevronRight, IconAlertTriangle, IconTrendingUp, IconRocket, CardSkeleton,
} from "../../common/UIComponents";
import { MultiLineChart, DonutChart } from "../../common/Charts";
import {
  SectionCard, KpiCard, EmptyState, SegmentedControl, subjectColor, subjectGradient,
  GradientIconTile,
} from "../../common/DashboardUI";
import { useDrilldown } from "./drilldown/DrilldownProvider";
import type { DashboardData } from "./useDashboardData";
import type { SectionId } from "./types";
import {
  monthlyDelta, pctStatus, filterByRange, questionOutcomes, orderSubjects, num,
  RANGE_OPTIONS, type RangeKey,
} from "./lib";

export function OverviewSection({
  data,
  user,
  onGoSection,
  onOpenSurvey,
}: {
  data: DashboardData;
  user: { name?: string; email?: string } | null;
  onGoSection: (s: SectionId) => void;
  onViewAttempt?: (id: string) => void;
  onOpenSurvey: () => void;
}) {
  const { open } = useDrilldown();
  const { analytics, loading, refresh, refreshing } = data;
  const { summary, timeline, subjectPerformance, chapterPerformance, errorAnalysis } = analytics;
  const [range, setRange] = useState<RangeKey>("6m");

  const firstName = user?.name?.split(" ")[0] || "Student";
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();
  const rangedTimeline = useMemo(() => filterByRange(timeline, range), [timeline, range]);
  const outcomes = useMemo(() => questionOutcomes(subjectPerformance), [subjectPerformance]);

  const testCount = summary?.totalTests ?? 0;
  const noData = !summary || testCount === 0;

  const dAcc = monthlyDelta(timeline, (t) => t.accuracy);
  const dRate = monthlyDelta(timeline, (t) => t.attemptRate);
  const dPct = monthlyDelta(timeline, (t) => t.percentage);
  const dScore = monthlyDelta(timeline, (t) => t.score);

  const lossDrivers = useMemo(
    () =>
      [...chapterPerformance]
        .filter((c) => (c.attempted || 0) > 0 && (c.incorrect || 0) > 0)
        .map((c) => ({ ...c, lostMarks: (c.incorrect || 0) * 5 }))
        .sort((a, b) => b.lostMarks - a.lostMarks)
        .slice(0, 4),
    [chapterPerformance],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="dash-card h-28 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        <div className="dash-card h-72 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-dash-in">
      {/* Greeting row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{greeting}, {firstName} 👋</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            A high-level summary of your performance — updated after every test.
          </p>
        </div>
        <button onClick={() => refresh()} title="Refresh" className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer self-start">
          <IconRefresh className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {noData ? (
        <SectionCard>
          <EmptyState
            icon={IconChart}
            title="No submitted tests yet"
            desc="Take a test from Tests — your KPIs, trends and drill-downs unlock the moment your first attempt is scored."
            action={<button onClick={() => onGoSection("tests")} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer">Go to Tests</button>}
          />
        </SectionCard>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <KpiCard label="Total Tests Taken" value={testCount} sub={`in ${data.selectedSprint?.name || "this sprint"}`} icon={IconClock} accent="#6366f1" onClick={() => onGoSection("history")} />
            <KpiCard label="Highest Score" value={`${timeline.reduce((m, t) => Math.max(m, num(t.percentage)), 0).toFixed(0)}%`} sub={`${summary?.highestScore ?? 0} marks`} icon={IconCheck} accent="#7c3aed"
              spark={timeline.map((t) => num(t.percentage))} status={{ label: "Personal Best", tone: "good" }} />
            <KpiCard label="Average Score" value={`${num(summary?.averageScore).toFixed(0)}`} sub={`${num(summary?.overallPercentage).toFixed(0)}% per test`} icon={IconChart} accent="#0ea5e9" delta={dScore}
              spark={timeline.map((t) => num(t.score))} status={pctStatus(num(summary?.overallPercentage), dPct)} onClick={() => onGoSection("performance")} />
            <KpiCard label="Overall Accuracy" value={`${num(summary?.overallAccuracy).toFixed(0)}%`} sub="of what you attempt" icon={IconTarget} accent="#4f46e5" delta={dAcc}
              spark={timeline.map((t) => num(t.accuracy))} status={pctStatus(num(summary?.overallAccuracy), dAcc)}
              onClick={() => open({ title: "Incorrect questions", metric: "incorrect", subtitle: `${num(summary?.overallAccuracy).toFixed(1)}% average accuracy` })} />
            <KpiCard label="Attempt Rate" value={`${num(summary?.overallAttemptRate).toFixed(0)}%`} sub={`${(100 - num(summary?.overallAttemptRate)).toFixed(0)}% left blank`} icon={IconTrendingUp} accent="#f59e0b" delta={dRate}
              spark={timeline.map((t) => num(t.attemptRate))} status={pctStatus(num(summary?.overallAttemptRate), dRate)}
              onClick={() => open({ title: "Unattempted questions", metric: "unattempted", subtitle: `${(100 - num(summary?.overallAttemptRate)).toFixed(1)}% of the paper left blank` })} />
            <KpiCard label="Overall Percentage" value={`${num(summary?.overallPercentage).toFixed(1)}%`} sub="across all tests" icon={IconChart} accent="#0891b2" delta={dPct}
              spark={timeline.map((t) => num(t.percentage))} status={pctStatus(num(summary?.overallPercentage), dPct)} onClick={() => onGoSection("performance")} />
          </div>

          {/* Trend + outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SectionCard
              className="lg:col-span-2"
              title="Score Trend"
              subtitle={`Score, Accuracy & Attempt Rate · last ${rangedTimeline.length}`}
              icon={IconChart}
              action={<SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />}
            >
              {rangedTimeline.length >= 2 ? (
                <MultiLineChart
                  labels={rangedTimeline.map((t, i) => `T${t.examNumber ?? i + 1}`)}
                  series={[
                    { label: "Score (%)", color: "#4f46e5", values: rangedTimeline.map((t) => num(t.percentage)) },
                    { label: "Accuracy (%)", color: "#0ea5e9", values: rangedTimeline.map((t) => num(t.accuracy)) },
                    { label: "Attempt Rate (%)", color: "#f59e0b", values: rangedTimeline.map((t) => num(t.attemptRate)) },
                  ]}
                  height={220}
                />
              ) : (
                <EmptyState icon={IconChart} title="Need 2+ tests" desc="The trend line appears once you have two scored tests in range." />
              )}
            </SectionCard>

            <SectionCard title="Question Outcomes" subtitle="All attempts · this sprint" icon={IconCheck}>
              {outcomes.total > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <DonutChart
                    size={150} strokeWidth={20}
                    centerLabel={`${((outcomes.correct / Math.max(outcomes.correct + outcomes.incorrect, 1)) * 100).toFixed(0)}%`}
                    centerSublabel="Accuracy"
                    data={[
                      { label: "Correct", value: outcomes.correct, color: "#059669" },
                      { label: "Incorrect", value: outcomes.incorrect, color: "#e11d48" },
                      { label: "Skipped", value: outcomes.skipped, color: "#cbd5e1" },
                    ]}
                  />
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {[
                      { l: "Correct", v: outcomes.correct, m: "correct" as const, tone: "text-emerald-600" },
                      { l: "Incorrect", v: outcomes.incorrect, m: "incorrect" as const, tone: "text-rose-600" },
                      { l: "Skipped", v: outcomes.skipped, m: "unattempted" as const, tone: "text-slate-500" },
                    ].map((x) => (
                      <button key={x.l} onClick={() => open({ title: `${x.l} questions`, metric: x.m, subtitle: `${x.v} across the sprint` })} className="dash-inset dash-clickable p-2 text-center">
                        <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{x.l}</p>
                        <p className={`text-base font-black tabular-nums ${x.tone}`}>{x.v}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : <EmptyState icon={IconCheck} title="No outcome data" />}
            </SectionCard>
          </div>

          {/* Subject performance + where you lose marks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Subject Performance"
              subtitle="Average score vs accuracy"
              icon={IconBook}
              action={<button onClick={() => onGoSection("subjects")} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">Details</button>}
            >
              {subjectPerformance.length > 0 ? (
                <div className="space-y-3.5">
                  {orderSubjects(subjectPerformance).map((s) => {
                    const score = num(s.marksObtained) > 0 && num(s.totalQuestions) > 0
                      ? Math.round((num(s.marksObtained) / (num(s.totalQuestions) * 4)) * 100) : 0;
                    return (
                      <button key={s.subject} onClick={() => open({ title: `${s.subject} · incorrect`, subtitle: `${num(s.accuracy).toFixed(0)}% accuracy`, metric: "incorrect", params: { subject: s.subject } })} className="w-full text-left group">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                          <span className="capitalize flex items-center gap-2">
                            <GradientIconTile icon={IconBook} gradient={subjectGradient(s.subject)} size="sm" />
                            {s.subject}
                          </span>
                          <span className="tabular-nums" style={{ color: subjectColor(s.subject) }}>{score}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-110" style={{ width: `${score}%`, backgroundColor: subjectColor(s.subject) }} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1">Accuracy {num(s.accuracy).toFixed(0)}%</p>
                      </button>
                    );
                  })}
                </div>
              ) : <EmptyState icon={IconBook} title="No subject data yet" />}
            </SectionCard>

            <SectionCard title="Where You Lose Marks" subtitle="Top loss drivers this sprint" icon={IconAlertTriangle}>
              {lossDrivers.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {lossDrivers.map((c) => (
                    <button
                      key={`${c.subject}-${c.chapter}`}
                      onClick={() => open({ title: c.chapter, subtitle: `${c.subject} · ${num(c.accuracy).toFixed(0)}% accuracy`, metric: "incorrect", params: { subject: c.subject, chapter: c.chapter } })}
                      className="w-full flex items-center justify-between gap-3 py-2.5 -mx-1 px-1 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: subjectColor(c.subject) }} />
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-bold text-slate-800 truncate">{c.chapter}</p>
                          <p className="text-[10px] font-semibold text-slate-400 capitalize">{c.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-rose-600 tabular-nums">− {c.lostMarks} mks</span>
                        <span className="text-[10px] font-bold text-indigo-500 inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity">Fix it <IconChevronRight className="w-3 h-3" /></span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : <EmptyState icon={IconRocket} title="Nothing leaking" desc="No chapter is costing you recoverable marks right now." />}
            </SectionCard>
          </div>

          {/* Error mix + jump-to */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Error Mix" subtitle="Tap a type to see the exact questions" icon={IconAlertTriangle}>
              {errorAnalysis.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <DonutChart
                    size={128} strokeWidth={16}
                    centerLabel={String(errorAnalysis.total)} centerSublabel="Error events"
                    data={[
                      { label: "Conceptual", value: errorAnalysis.concept, color: "#4f46e5" },
                      { label: "Silly", value: errorAnalysis.silly, color: "#7c3aed" },
                      { label: "Guessing", value: errorAnalysis.guess, color: "#f59e0b" },
                    ]}
                  />
                  <div className="grid gap-1.5 w-full">
                    {[
                      { l: "Conceptual errors", v: errorAnalysis.concept, m: "concept_errors" as const },
                      { l: "Silly mistakes", v: errorAnalysis.silly, m: "silly_mistakes" as const },
                      { l: "Guesses", v: errorAnalysis.guess, m: "guesses" as const },
                    ].map((x) => (
                      <button key={x.l} onClick={() => open({ title: x.l, metric: x.m, subtitle: `${x.v} flagged across this sprint` })}
                        className="dash-inset dash-clickable px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">{x.l}</span>
                        <span className="text-sm font-black tabular-nums text-slate-900">{x.v} <IconChevronRight className="w-3 h-3 inline text-slate-300" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : <EmptyState icon={IconAlertTriangle} title="No errors classified yet" desc="Error analysis needs a scored attempt with confidence data." />}
            </SectionCard>

            <SectionCard title="Jump To" icon={IconChart}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { Icon: IconChart, label: "Performance", s: "performance" as SectionId, cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                  { Icon: IconBook, label: "Subjects", s: "subjects" as SectionId, cls: "text-sky-700 bg-sky-50 border-sky-200" },
                  { Icon: IconTarget, label: "Chapters", s: "chapters" as SectionId, cls: "text-violet-700 bg-violet-50 border-violet-200" },
                  { Icon: IconTrendingUp, label: "Deep Analytics", s: "analytics" as SectionId, cls: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200" },
                  { Icon: IconClock, label: "Tests", s: "tests" as SectionId, cls: "text-teal-700 bg-teal-50 border-teal-200" },
                  { Icon: IconBook, label: "History", s: "history" as SectionId, cls: "text-slate-700 bg-slate-50 border-slate-200" },
                ].map(({ Icon, label, s, cls }) => (
                  <button key={label} onClick={() => onGoSection(s)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-extrabold transition-all cursor-pointer hover:brightness-95 active:scale-[0.98] ${cls}`}>
                    <Icon className="w-4 h-4 shrink-0" /> {label}
                  </button>
                ))}
              </div>
              <button onClick={onOpenSurvey} className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-[11px] font-bold hover:bg-slate-800 cursor-pointer">
                <IconBook className="w-3.5 h-3.5" /> Update Chapter Assessment
              </button>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
