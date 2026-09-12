"use client";

import React, { useMemo, useState } from "react";
import {
  IconChart, IconClock, IconCheck, IconTarget, IconTrendingUp, IconAlertTriangle,
  IconRocket, IconBulb, IconBook, CardSkeleton,
} from "../../common/UIComponents";
import { AreaLineChart, MultiLineChart, DonutChart, GaugeArc } from "../../common/Charts";
import {
  SectionCard, KpiCard, SortableTable, StatusBadge2, EmptyState, SegmentedControl,
  subjectColor, subjectGradient, GradientIconTile, type Column,
} from "../../common/DashboardUI";
import { useDrilldown } from "./drilldown/DrilldownProvider";
import type { DashboardData, TimelineEntry } from "./useDashboardData";
import {
  filterByRange, monthlyDelta, num, orderSubjects, pctStatus,
  RANGE_OPTIONS, type RangeKey,
} from "./lib";

export function PerformanceSection({
  data,
  onViewAttempt,
}: {
  data: DashboardData;
  onViewAttempt: (id: string) => void;
}) {
  const { open } = useDrilldown();
  const { analytics, loading } = data;
  const { summary, timeline, subjectPerformance, difficultyPerformance, errorAnalysis, chapterPerformance } = analytics;
  const [range, setRange] = useState<RangeKey>("6m");
  const [diffMode, setDiffMode] = useState<"accuracy" | "time">("accuracy");

  const ranged = useMemo(() => filterByRange(timeline, range), [timeline, range]);

  const dPct = monthlyDelta(timeline, (t) => t.percentage);
  const dAcc = monthlyDelta(timeline, (t) => t.accuracy);
  const dRate = monthlyDelta(timeline, (t) => t.attemptRate);
  const dScore = monthlyDelta(timeline, (t) => t.score);

  const improvementPotential = useMemo(() => {
    // recoverable marks per test as a % of a paper — a real "headroom" number
    const totalRec = timeline.reduce((s, t) => s + num(t.totalRecoverable), 0);
    const per = timeline.length ? totalRec / timeline.length : 0;
    const maxPerTest = num(timeline[0]?.totalMarks, 720);
    return maxPerTest > 0 ? (per / maxPerTest) * 100 : 0;
  }, [timeline]);

  const lossDrivers = useMemo(
    () =>
      [...chapterPerformance]
        .filter((c) => (c.attempted || 0) > 0 && (c.incorrect || 0) > 0)
        .map((c) => ({ ...c, lostMarks: (c.incorrect || 0) * 5 }))
        .sort((a, b) => b.lostMarks - a.lostMarks)
        .slice(0, 5),
    [chapterPerformance],
  );

  const totalMarksObtained = timeline.reduce((s, t) => s + num(t.score), 0);
  const maxPerTest = num(timeline[0]?.totalMarks, 720);

  const columns: Column<TimelineEntry>[] = [
    { key: "name", header: "Test Name", sortable: true, sortValue: (r) => r.examTitle || "", render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-800 truncate max-w-[200px]">{r.examTitle || "Test"}</span>
        {num(r.attemptNumber) > 1 && <span className="text-[9px] font-black px-1 rounded bg-violet-50 text-violet-700">A{r.attemptNumber}</span>}
      </div>
    ) },
    { key: "date", header: "Date", align: "right", sortable: true, sortValue: (r) => new Date(r.attemptedAt || 0).getTime(), render: (r) => r.attemptedAt ? new Date(r.attemptedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
    { key: "marks", header: "Marks", align: "right", sortable: true, sortValue: (r) => num(r.score), render: (r) => <span className="font-black text-slate-800">{num(r.score)}<span className="text-slate-400 font-semibold">/{num(r.totalMarks, 720)}</span></span> },
    { key: "pct", header: "Percentage", align: "right", sortable: true, sortValue: (r) => num(r.percentage), render: (r) => {
      const p = num(r.percentage);
      const cls = p >= 65 ? "text-emerald-600" : p >= 40 ? "text-amber-600" : "text-rose-600";
      return <span className={`font-black ${cls}`}>{p.toFixed(1)}%</span>;
    } },
    { key: "acc", header: "Accuracy", align: "right", sortable: true, sortValue: (r) => num(r.accuracy), render: (r) => `${num(r.accuracy).toFixed(0)}%` },
    { key: "att", header: "Attempt", align: "right", sortable: true, sortValue: (r) => num(r.attemptRate), render: (r) => `${num(r.attemptRate).toFixed(0)}%` },
    { key: "status", header: "Status", align: "right", render: (r) => <StatusBadge2 pct={num(r.percentage)} /> },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        <div className="dash-card h-72 animate-pulse" />
      </div>
    );
  }

  if (!summary || timeline.length === 0) {
    return <SectionCard><EmptyState icon={IconChart} title="No performance data yet" desc="Take a test in this sprint and your full performance breakdown appears here." /></SectionCard>;
  }

  return (
    <div className="space-y-5 animate-dash-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Performance</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Deep dive into your test performance and improvement areas.</p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} size="md" />
      </div>

      {/* KPI row — doc image 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <KpiCard label="Total Tests Taken" value={summary.totalTests} sub="scored this sprint" icon={IconClock} accent={subjectColor("physics")} />
        <KpiCard label="Average Score" value={`${num(summary.averageScore).toFixed(0)}`} sub={`${num(summary.overallPercentage).toFixed(0)}% avg per test`} icon={IconChart} accent="#7c3aed" delta={dPct}
          spark={timeline.map((t) => num(t.percentage))} status={pctStatus(num(summary.overallPercentage), dPct)} />
        <KpiCard label="Highest Score" value={`${summary.highestScore}`} sub={`${timeline.reduce((m, t) => Math.max(m, num(t.percentage)), 0).toFixed(0)}% — your ceiling`} icon={IconCheck} accent="#059669"
          spark={timeline.map((t) => num(t.percentage))} status={{ label: "Best", tone: "good" }} />
        <KpiCard label="Accuracy (Avg)" value={`${num(summary.overallAccuracy).toFixed(0)}%`} sub="of what you attempt" icon={IconTarget} accent="#0ea5e9" delta={dAcc}
          spark={timeline.map((t) => num(t.accuracy))} status={pctStatus(num(summary.overallAccuracy), dAcc)}
          onClick={() => open({ title: "Incorrect questions", metric: "incorrect", subtitle: `${num(summary.overallAccuracy).toFixed(1)}% average accuracy — the misses` })} />
        <KpiCard label="Improvement Potential" value={`${improvementPotential.toFixed(0)}%`} sub="recoverable marks headroom" icon={IconBulb} accent="#d97706"
          spark={timeline.map((t) => num(t.totalRecoverable))} status={improvementPotential > 15 ? { label: "High", tone: "warn" } : { label: "Low", tone: "good" }} />
        <KpiCard label="Attempt Rate (Avg)" value={`${num(summary.overallAttemptRate).toFixed(0)}%`} sub={`${(100 - num(summary.overallAttemptRate)).toFixed(0)}% left blank`} icon={IconTrendingUp} accent="#0d9488" delta={dRate}
          spark={timeline.map((t) => num(t.attemptRate))} status={pctStatus(num(summary.overallAttemptRate), dRate)}
          onClick={() => open({ title: "Unattempted questions", metric: "unattempted", subtitle: `${(100 - num(summary.overallAttemptRate)).toFixed(1)}% of the paper left blank` })} />
      </div>

      {/* Trend + error analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="lg:col-span-2" title="Performance Trend" subtitle="Score, Attempt Rate & Accuracy over time" icon={IconChart}>
          {ranged.length >= 2 ? (
            <MultiLineChart
              labels={ranged.map((t, i) => `T${t.examNumber ?? i + 1}`)}
              series={[
                { label: "Score (%)", color: "#4f46e5", values: ranged.map((t) => num(t.percentage)) },
                { label: "Accuracy (%)", color: "#0ea5e9", values: ranged.map((t) => num(t.accuracy)) },
                { label: "Attempt Rate (%)", color: "#f59e0b", values: ranged.map((t) => num(t.attemptRate)) },
              ]}
              height={230}
            />
          ) : <EmptyState icon={IconChart} title="Need 2+ tests" desc="The trend needs at least two scored tests in range." />}
        </SectionCard>

        <SectionCard title="Error Analysis" subtitle={`Distribution of errors · last ${timeline.length}`} icon={IconAlertTriangle}>
          {errorAnalysis.total > 0 ? (
            <div className="flex flex-col items-center">
              <DonutChart
                size={150} strokeWidth={20}
                centerLabel="100%" centerSublabel="of Errors"
                data={[
                  { label: "Conceptual Error", value: errorAnalysis.concept, color: "#4f46e5" },
                  { label: "Silly Mistake", value: errorAnalysis.silly, color: "#7c3aed" },
                  { label: "Guess", value: errorAnalysis.guess, color: "#f59e0b" },
                ]}
              />
              <div className="grid grid-cols-3 gap-1.5 w-full mt-2">
                {[
                  { l: "Conceptual", v: errorAnalysis.concept, m: "concept_errors" as const, c: "text-indigo-600" },
                  { l: "Silly", v: errorAnalysis.silly, m: "silly_mistakes" as const, c: "text-violet-600" },
                  { l: "Guess", v: errorAnalysis.guess, m: "guesses" as const, c: "text-amber-600" },
                ].map((x) => (
                  <button key={x.l} onClick={() => open({ title: x.l, metric: x.m, subtitle: `${x.v} flagged this sprint` })} className="dash-inset dash-clickable p-2 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">{x.l}</p>
                    <p className={`text-sm font-black tabular-nums ${x.c}`}>{x.v}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : <EmptyState icon={IconAlertTriangle} title="No errors classified" desc="Needs a scored attempt with confidence data." />}
        </SectionCard>
      </div>

      {/* Difficulty + chapters to focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Difficulty Type Performance"
          subtitle="Your performance across question difficulty levels"
          icon={IconChart}
          action={<SegmentedControl options={[{ value: "accuracy", label: "Accuracy (%)" }, { value: "time", label: "Avg Time (sec)" }]} value={diffMode} onChange={setDiffMode} />}
        >
          <DifficultyBars
            rows={difficultyPerformance}
            mode={diffMode}
            onDrill={(d, row) => open({
              title: `${d[0].toUpperCase()}${d.slice(1)} questions`,
              subtitle: `${num(row?.attempted)} attempted · ${num(row?.accuracy).toFixed(0)}% accuracy${diffMode === "time" ? ` · ${Math.round(num(row?.avgTimeSeconds))}s avg` : ""}`,
              metric: "attempted",
              params: { difficulty: d },
              note: "Every question you attempted at this difficulty — correct and incorrect. Tap one to open its solution.",
            })}
          />
          <div className="mt-3 rounded-xl bg-indigo-50/60 border border-indigo-100 px-3 py-2 text-[11px] font-semibold text-indigo-700">
            Focus more on {diffMode === "accuracy" ? "difficult questions to lift overall accuracy" : "pacing your hard questions"}.
          </div>
        </SectionCard>

        <SectionCard title="Chapters to Focus On" subtitle="Top chapters by recoverable marks" icon={IconTarget}>
          {lossDrivers.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {lossDrivers.map((c, i) => (
                <button
                  key={`${c.subject}-${c.chapter}`}
                  onClick={() => open({ title: c.chapter, subtitle: `${c.subject} · ${num(c.accuracy).toFixed(0)}% accuracy`, metric: "incorrect", params: { subject: c.subject, chapter: c.chapter } })}
                  className="w-full flex items-center justify-between gap-3 py-2.5 -mx-1 px-1 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-slate-800 truncate">{c.chapter}</p>
                      <p className="text-[10px] font-semibold text-slate-400 capitalize">{c.subject}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-600 tabular-nums shrink-0">− {c.lostMarks} mks</span>
                </button>
              ))}
            </div>
          ) : <EmptyState icon={IconRocket} title="No weak chapters" desc="You're not leaving recoverable marks on the table." />}
        </SectionCard>
      </div>

      {/* Distribution — gauge + marks progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Accuracy Gauge" subtitle="Average across all tests" icon={IconTarget}>
          <div className="flex flex-col items-center gap-1.5 py-2">
            <GaugeArc value={num(summary.overallAccuracy)} size={220} caption={
              num(summary.overallAccuracy) >= 80 ? "Top-tier accuracy" : num(summary.overallAccuracy) >= 60 ? "Solid — push for 80%" : "Accuracy is the priority fix"
            } />
          </div>
        </SectionCard>
        <SectionCard title="Marks Progress" subtitle={`${totalMarksObtained.toLocaleString("en-IN")} of ${(maxPerTest * summary.totalTests).toLocaleString("en-IN")} possible`} icon={IconTrendingUp}>
          {ranged.length >= 2 ? (
            <AreaLineChart
              data={ranged.map((t, i) => ({ label: `T${t.examNumber ?? i + 1}`, value: num(t.score), detail: `${t.examTitle || "Test"} · ${num(t.score)}/${num(t.totalMarks, 720)}` }))}
              height={190} color="#0ea5e9" yMax={maxPerTest}
            />
          ) : <p className="py-8 text-center text-xs font-semibold text-slate-400">Need 2+ tests in range.</p>}
          {dScore != null && (
            <p className={`text-[11px] font-bold mt-1 ${dScore > 0 ? "text-emerald-600" : dScore < 0 ? "text-rose-600" : "text-slate-400"}`}>
              {dScore > 0 ? "+" : ""}{dScore} marks vs prior month
            </p>
          )}
        </SectionCard>
      </div>

      {/* Attempt rate by subject */}
      <SectionCard title="Attempt Rate by Subject" subtitle="How much of each paper you try" icon={IconCheck}>
        <div className="space-y-3">
          {orderSubjects(subjectPerformance).map((s) => {
            const v = num(s.attemptRate);
            return (
              <div key={s.subject}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="capitalize flex items-center gap-2">
                    <GradientIconTile icon={IconBook} gradient={subjectGradient(s.subject)} size="sm" />
                    {s.subject}
                  </span>
                  <span className="tabular-nums text-slate-500">{v.toFixed(0)}% · {s.attempted}/{s.totalQuestions} Qs</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, backgroundColor: subjectColor(s.subject) }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Breakdown table */}
      <SectionCard title="Performance Breakdown" subtitle={`${timeline.length} tests · tap a row for full analysis · tap headers to sort`} icon={IconClock}>
        <SortableTable
          columns={columns}
          rows={timeline}
          initialSort={{ key: "date", dir: "desc" }}
          rowKey={(r, i) => r.attemptId || String(i)}
          onRowClick={(r) => r.attemptId && onViewAttempt(r.attemptId)}
        />
      </SectionCard>
    </div>
  );
}

function DifficultyBars({
  rows,
  mode,
  onDrill,
}: {
  rows: DashboardData["analytics"]["difficultyPerformance"];
  mode: "accuracy" | "time";
  onDrill: (d: string, row: DashboardData["analytics"]["difficultyPerformance"][number]) => void;
}) {
  const order = ["easy", "medium", "hard"];
  const sorted = [...rows]
    .filter((r) => (r.totalQuestions || 0) > 0)
    .sort((a, b) => order.indexOf(a.difficulty?.toLowerCase()) - order.indexOf(b.difficulty?.toLowerCase()));
  if (sorted.length === 0) return <EmptyState icon={IconChart} title="No difficulty data yet" />;

  const color = (d: string) => (d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444");
  const maxTime = Math.max(...sorted.map((r) => num(r.avgTimeSeconds)), 1);
  const TRACK = 160; // px — the plotting area height

  return (
    <div className="flex items-end justify-around gap-4 pt-2">
      {sorted.map((r) => {
        const val = mode === "accuracy" ? num(r.accuracy) : num(r.avgTimeSeconds);
        const hPct = mode === "accuracy" ? Math.min(100, val) : (val / maxTime) * 100;
        return (
          <button key={r.difficulty} onClick={() => onDrill(r.difficulty, r)} className="flex flex-col items-center flex-1 max-w-[120px] group cursor-pointer">
            <div className="w-full flex flex-col justify-end" style={{ height: TRACK }}>
              <span className="text-sm font-black text-slate-800 tabular-nums text-center mb-1">
                {mode === "accuracy" ? `${val.toFixed(0)}%` : `${Math.round(val)}s`}
              </span>
              <div
                className="w-full rounded-t-xl transition-[height] duration-700 group-hover:brightness-110"
                style={{ height: Math.max(6, (hPct / 100) * (TRACK - 26)), backgroundColor: color(r.difficulty?.toLowerCase()) }}
              />
            </div>
            <span className="text-[11px] font-bold text-slate-500 capitalize mt-2">{r.difficulty}</span>
          </button>
        );
      })}
    </div>
  );
}
