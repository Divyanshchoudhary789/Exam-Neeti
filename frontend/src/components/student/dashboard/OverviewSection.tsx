"use client";

import React, { useMemo, useState } from "react";
import {
  IconChart, IconBook, IconCheck, IconClock, IconTarget, IconRefresh,
  IconChevronRight, IconAlertTriangle, IconFileText, IconTrendingUp, CardSkeleton,
} from "../../common/UIComponents";
import { AreaLineChart, DonutChart } from "../../common/Charts";
import {
  SectionCard, KpiCard, EmptyState, subjectColor,
} from "../../common/DashboardUI";
import { useDrilldown } from "./drilldown/DrilldownProvider";
import type { DashboardData } from "./useDashboardData";
import {
  monthlyDelta, pctStatus, filterByRange, questionOutcomes, orderSubjects, num,
  RANGE_OPTIONS, type RangeKey,
} from "./lib";
import { SegmentedControl } from "../../common/DashboardUI";

type SectionId = "overview" | "analytics" | "tests" | "history" | "reports" | "profile";

export function OverviewSection({
  data,
  user,
  onGoSection,
  onViewAttempt,
  onOpenSurvey,
}: {
  data: DashboardData;
  user: { name?: string; email?: string } | null;
  onGoSection: (s: SectionId) => void;
  onViewAttempt: (id: string) => void;
  onOpenSurvey: () => void;
}) {
  const { open } = useDrilldown();
  const { analytics, loading, probability, coverage, refresh, refreshing } = data;
  const { summary, timeline, subjectPerformance, chapterPerformance, errorAnalysis } = analytics;
  const [range, setRange] = useState<RangeKey>("6m");

  const firstName = user?.name?.split(" ")[0] || "Student";
  const readiness = num(probability?.readinessIndex);
  const sylPct = num(coverage?.syllabusCoverage) || num(coverage?.conceptCoverage);

  const rangedTimeline = useMemo(() => filterByRange(timeline, range), [timeline, range]);
  const outcomes = useMemo(() => questionOutcomes(subjectPerformance), [subjectPerformance]);

  const testCount = summary?.totalTests ?? 0;
  const bestEntry = summary && timeline.length
    ? timeline.find((t) => num(t.score, -1) === summary.highestScore) ?? null
    : null;

  // ── deltas ──
  const dAcc = monthlyDelta(timeline, (t) => t.accuracy);
  const dRate = monthlyDelta(timeline, (t) => t.attemptRate);
  const dPct = monthlyDelta(timeline, (t) => t.percentage);

  const scoreDelta = timeline.length >= 2
    ? num(timeline[timeline.length - 1].score) - num(timeline[timeline.length - 2].score)
    : null;

  // ── loss drivers ──
  const lossDrivers = useMemo(() => {
    return [...chapterPerformance]
      .filter((c) => (c.attempted || 0) > 0 && (c.incorrect || 0) > 0)
      .map((c) => ({
        ...c,
        lostMarks: (c.incorrect || 0) * 5, // full swing: +4 not earned, −1 taken
      }))
      .sort((a, b) => b.lostMarks - a.lostMarks)
      .slice(0, 5);
  }, [chapterPerformance]);

  const recent = [...timeline].reverse().slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="dash-card h-40 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const noData = !summary || testCount === 0;

  const strip = [
    { l: "Readiness", v: readiness > 0 ? `${readiness.toFixed(0)}%` : "—", hint: `${num((probability?.assessedCount as number) || (probability?.chapters as unknown[])?.length)}/86 chapters rated`, onClick: onOpenSurvey },
    { l: "Syllabus seen", v: sylPct > 0 ? `${sylPct.toFixed(0)}%` : "—", hint: "from tests taken" },
    { l: "Consistency", v: summary?.consistencyAcrossTests && summary.consistencyAcrossTests.interpretation !== "insufficient_data" ? summary.consistencyAcrossTests.interpretation.replace(/_/g, " ") : "—", hint: summary?.consistencyAcrossTests?.interpretation === "insufficient_data" ? "needs 2+ tests" : `±${num(summary?.consistencyAcrossTests?.accuracyStdDevPercent).toFixed(0)}% swing` },
  ];

  return (
    <div className="space-y-4 animate-dash-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl dash-gradient text-white p-4 sm:p-5 shadow-lg shadow-indigo-900/20">
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/[0.07]" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-xl sm:text-[26px] font-black tracking-tight leading-tight mt-0.5">
              Hi {firstName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-white/85 font-medium max-w-lg mt-1">
              {scoreDelta != null && scoreDelta !== 0
                ? `Your last test moved ${scoreDelta > 0 ? "up" : "down"} ${Math.abs(scoreDelta)} marks. `
                : ""}
              Every number on this page opens the exact questions behind it.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              onClick={onOpenSurvey}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-indigo-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <IconBook className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Chapter </span>Assessment
            </button>
            <button
              onClick={() => refresh()}
              className="p-2 bg-white/15 border border-white/20 hover:bg-white/25 rounded-xl transition-all cursor-pointer"
              aria-label="Refresh dashboard"
              title="Refresh"
            >
              <IconRefresh className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* readiness / coverage strip — solid cards for contrast + clickability */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {strip.map((x) => (
          <button
            key={x.l}
            onClick={x.onClick}
            disabled={!x.onClick}
            className={`dash-card-flat px-3 py-2.5 text-left disabled:cursor-default ${x.onClick ? "dash-clickable group" : ""}`}
          >
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{x.l}</p>
            <p className="text-base sm:text-lg font-black capitalize leading-tight mt-0.5 text-slate-900">{x.v}</p>
            <p className="text-[10px] text-slate-400 font-semibold truncate">{x.hint}</p>
          </button>
        ))}
      </div>

      {noData ? (
        <SectionCard>
          <EmptyState
            icon={IconChart}
            title="No submitted tests yet"
            desc="Take a test from My Tests — your KPIs, trends and drill-downs unlock the moment your first attempt is scored."
            action={
              <button onClick={() => onGoSection("tests")} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer">
                Go to My Tests
              </button>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            <KpiCard
              label="Tests Taken" value={testCount} sub={`in ${data.selectedSprint?.name || "this sprint"}`}
              icon={IconClock}
              onClick={() => onGoSection("history")}
            />
            <KpiCard
              label="Best Result"
              value={bestEntry ? `${num(bestEntry.percentage).toFixed(0)}%` : `${num(summary?.overallPercentage).toFixed(0)}%`}
              sub={bestEntry ? `${bestEntry.score}/${bestEntry.totalMarks || 720} · ${bestEntry.examTitle || "test"}` : "your ceiling so far"}
              icon={IconCheck} accent="#7c3aed"
              spark={timeline.map((t) => num(t.percentage))}
              status={{ label: "Best", tone: "good" }}
              onClick={bestEntry?.attemptId ? () => onViewAttempt(bestEntry.attemptId as string) : undefined}
            />
            <KpiCard
              label="Average %" value={`${num(summary?.overallPercentage).toFixed(1)}%`} sub={`${num(summary?.averageScore).toFixed(0)} marks per test`}
              icon={IconChart} delta={dPct} spark={timeline.map((t) => num(t.percentage))}
              status={pctStatus(num(summary?.overallPercentage), dPct)}
              onClick={() => onGoSection("analytics")}
            />
            <KpiCard
              label="Accuracy" value={`${num(summary?.overallAccuracy).toFixed(1)}%`} sub="of the questions you attempt"
              icon={IconTarget} delta={dAcc} spark={timeline.map((t) => num(t.accuracy))}
              status={pctStatus(num(summary?.overallAccuracy), dAcc)}
              onClick={() => open({
                title: "Accuracy — the misses",
                subtitle: `${num(summary?.overallAccuracy).toFixed(1)}% correct across ${testCount} test${testCount !== 1 ? "s" : ""}`,
                formula: "Correct ÷ Attempted × 100 (averaged across tests)",
                metric: "incorrect",
                note: "Every question you attempted but got wrong — closing these is the fastest way to raise accuracy.",
              })}
            />
            <KpiCard
              label="Attempt Rate" value={`${num(summary?.overallAttemptRate).toFixed(1)}%`} sub={`${(100 - num(summary?.overallAttemptRate)).toFixed(0)}% left blank`}
              icon={IconTrendingUp} delta={dRate} spark={timeline.map((t) => num(t.attemptRate))}
              status={pctStatus(num(summary?.overallAttemptRate), dRate)}
              onClick={() => open({
                title: "Questions left blank",
                subtitle: `${(100 - num(summary?.overallAttemptRate)).toFixed(1)}% of the paper on average`,
                formula: "Attempted ÷ Total Questions × 100",
                metric: "unattempted",
                note: "Some of these were likely winnable — check which topics you skip most.",
              })}
            />
            <KpiCard
              label="Silly Mistakes" value={errorAnalysis.silly} sub={errorAnalysis.total > 0 ? `${Math.round((errorAnalysis.silly / errorAnalysis.total) * 100)}% of your errors` : "none flagged yet"}
              icon={IconAlertTriangle} accent="#e11d48"
              status={errorAnalysis.silly > 0 ? { label: "Recover", tone: "risk" } : undefined}
              onClick={() => open({
                title: "Silly mistakes",
                subtitle: `${errorAnalysis.silly} question${errorAnalysis.silly !== 1 ? "s" : ""} you knew but got wrong`,
                formula: "Wrong + high confidence + normal time + you're usually strong here",
                metric: "silly_mistakes",
                note: "These are pure recoverable marks — a slower re-read would have fixed them.",
              })}
            />
          </div>

          {/* Trend + outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SectionCard
              className="lg:col-span-2"
              title="Score Trend"
              subtitle={`Percentage per test · last ${rangedTimeline.length}`}
              icon={IconChart}
              action={<SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />}
            >
              {rangedTimeline.length >= 2 ? (
                <AreaLineChart
                  data={rangedTimeline.map((t, i) => ({
                    label: t.examTitle ? `T${t.examNumber ?? i + 1}` : `T${i + 1}`,
                    value: num(t.percentage),
                    detail: `${t.examTitle || "Test"} · ${num(t.score)}/${num(t.totalMarks, 720)}`,
                  }))}
                  height={200}
                  valueSuffix="%"
                  yMax={100}
                />
              ) : (
                <EmptyState icon={IconChart} title="Need 2+ tests" desc="The trend line appears once you have at least two scored tests in range." />
              )}
            </SectionCard>

            <SectionCard title="Question Outcomes" subtitle="All attempts this sprint" icon={IconCheck}>
              {outcomes.total > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <DonutChart
                    size={140}
                    strokeWidth={18}
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
                      <button
                        key={x.l}
                        onClick={() => open({ title: `${x.l} questions`, metric: x.m, subtitle: `${x.v} across the sprint` })}
                        className="dash-inset dash-clickable p-2 text-center"
                      >
                        <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{x.l}</p>
                        <p className={`text-base font-black tabular-nums ${x.tone}`}>{x.v}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={IconCheck} title="No outcome data" />
              )}
            </SectionCard>
          </div>

          {/* Subject snapshot + error mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Subject Snapshot" subtitle="Accuracy · marks · attempt rate" icon={IconBook}
              action={<button onClick={() => onGoSection("analytics")} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">Details</button>}>
              {subjectPerformance.length > 0 ? (
                <div className="space-y-3">
                  {orderSubjects(subjectPerformance).map((s) => {
                    const acc = num(s.accuracy);
                    return (
                      <button
                        key={s.subject}
                        onClick={() => open({
                          title: `${s.subject} · incorrect questions`,
                          subtitle: `${acc.toFixed(0)}% accuracy · ${s.correct}/${s.attempted} correct`,
                          metric: "incorrect", params: { subject: s.subject },
                        })}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                          <span className="capitalize">{s.subject}</span>
                          <span className="tabular-nums text-[11px] text-slate-500">
                            {num(s.marksObtained)} mks · {acc.toFixed(0)}% acc · C{s.correct}/W{s.incorrect}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700 group-hover:brightness-110" style={{ width: `${acc}%`, backgroundColor: subjectColor(s.subject) }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={IconBook} title="No subject data yet" />
              )}
            </SectionCard>

            <SectionCard title="Error Mix" subtitle="Where your wrong answers come from" icon={IconAlertTriangle}>
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
                      <button key={x.l} onClick={() => open({ title: x.l, metric: x.m, subtitle: `${x.v} flagged across the sprint` })}
                        className="dash-inset dash-clickable px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">{x.l}</span>
                        <span className="text-sm font-black tabular-nums text-slate-900">{x.v} <IconChevronRight className="w-3 h-3 inline text-slate-300" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={IconAlertTriangle} title="No errors classified yet" desc="Error analysis needs a scored attempt with confidence data." />
              )}
            </SectionCard>
          </div>

          {/* Where you lose marks */}
          {lossDrivers.length > 0 && (
            <SectionCard title="Where You Lose Marks" subtitle="Top loss drivers this sprint" icon={IconAlertTriangle}>
              <div className="divide-y divide-slate-50">
                {lossDrivers.map((c) => (
                  <button
                    key={`${c.subject}-${c.chapter}`}
                    onClick={() => open({
                      title: c.chapter,
                      subtitle: `${c.subject} · ${num(c.accuracy).toFixed(0)}% accuracy`,
                      metric: "incorrect",
                      params: { subject: c.subject, chapter: c.chapter },
                    })}
                    className="w-full flex items-center justify-between gap-3 py-2.5 -mx-1 px-1 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: subjectColor(c.subject) }} />
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-slate-800 truncate">{c.chapter}</p>
                        <p className="text-[10px] font-semibold text-slate-400 capitalize">{c.subject} · {c.incorrect} wrong of {c.attempted}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-rose-600 tabular-nums">−{c.lostMarks} mks</span>
                      <span className="text-[10px] font-bold text-indigo-500 inline-flex items-center opacity-0 group-hover:opacity-100 transition-opacity">Fix it <IconChevronRight className="w-3 h-3" /></span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Quick actions + recent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Jump To" icon={IconChart}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { Icon: IconChart, label: "Deep Analytics", s: "analytics" as SectionId, cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                  { Icon: IconFileText, label: "Reports", s: "reports" as SectionId, cls: "text-violet-700 bg-violet-50 border-violet-200" },
                  { Icon: IconBook, label: "My Tests", s: "tests" as SectionId, cls: "text-teal-700 bg-teal-50 border-teal-200" },
                ].map(({ Icon, label, s, cls }) => (
                  <button key={label} onClick={() => onGoSection(s)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-extrabold transition-all cursor-pointer hover:brightness-95 active:scale-[0.98] ${cls}`}>
                    <Icon className="w-4 h-4 shrink-0" /> {label}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Recent Results" icon={IconClock}
              action={<button onClick={() => onGoSection("history")} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">View all</button>}>
              {recent.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {recent.map((t, i) => {
                    const ratio = num(t.totalMarks, 720) > 0 ? num(t.score) / num(t.totalMarks, 720) : 0;
                    const tone = ratio >= 0.65 ? "text-emerald-600" : ratio >= 0.4 ? "text-amber-600" : "text-rose-600";
                    return (
                      <button key={t.attemptId || i} onClick={() => t.attemptId && onViewAttempt(t.attemptId)}
                        className="w-full flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded-xl transition-colors">
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-bold text-slate-800 truncate">{t.examTitle || "Test"}</p>
                          <p className="text-[10px] font-semibold text-slate-400">
                            {t.attemptedAt ? new Date(t.attemptedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}
                            {num(t.attemptNumber) > 1 ? ` · Attempt ${t.attemptNumber}` : ""}
                          </p>
                        </div>
                        <div className="text-right tabular-nums shrink-0">
                          <span className={`text-sm font-black ${tone}`}>{num(t.score)}</span>
                          <span className="text-[11px] text-slate-400 font-semibold">/{num(t.totalMarks, 720)}</span>
                          <p className="text-[10px] text-slate-400">{num(t.percentage).toFixed(0)}%</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={IconClock} title="No results yet" />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
