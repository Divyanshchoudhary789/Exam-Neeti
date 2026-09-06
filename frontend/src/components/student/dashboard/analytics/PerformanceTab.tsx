"use client";

import React, { useMemo } from "react";
import { IconChart, IconClock, IconCheck, IconTarget, IconTrendingUp } from "../../../common/UIComponents";
import { AreaLineChart, GaugeArc, HBarChart, StackedBar } from "../../../common/Charts";
import { SectionCard, StatTile, SortableTable, StatusBadge2, subjectColor, type Column } from "../../../common/DashboardUI";
import { useDrilldown } from "../drilldown/DrilldownProvider";
import type { DashboardData, TimelineEntry } from "../useDashboardData";
import { filterByRange, monthlyDelta, num, orderSubjects, type RangeKey } from "../lib";

export function PerformanceTab({
  data,
  range,
  onViewAttempt,
}: {
  data: DashboardData;
  range: RangeKey;
  onViewAttempt: (id: string) => void;
}) {
  const { open } = useDrilldown();
  const { analytics } = data;
  const { summary, timeline, subjectPerformance } = analytics;
  const ranged = useMemo(() => filterByRange(timeline, range), [timeline, range]);

  const totalMarksObtained = timeline.reduce((s, t) => s + num(t.score), 0);
  const maxPerTest = num(timeline[0]?.totalMarks, 720);

  // score bands
  const bands = useMemo(() => {
    const b = { hi: 0, mid: 0, lo: 0, poor: 0 };
    for (const t of timeline) {
      const p = num(t.percentage);
      if (p >= 80) b.hi++;
      else if (p >= 60) b.mid++;
      else if (p >= 40) b.lo++;
      else b.poor++;
    }
    return b;
  }, [timeline]);
  const marksDelta = ranged.length >= 2 ? num(ranged[ranged.length - 1].score) - num(ranged[0].score) : 0;

  const pctTone = (p: number): "good" | "neutral" | "risk" => (p >= 65 ? "good" : p >= 40 ? "neutral" : "risk");
  const bestPct = timeline.reduce((m, t) => Math.max(m, num(t.percentage)), 0);

  const cards: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "warn" | "risk" | "brand"; onClick?: () => void; formula?: string; calc?: string }[] = [
    { label: "Tests Taken", value: String(summary?.totalTests ?? 0), sub: "scored this sprint" },
    { label: "Average %", value: `${num(summary?.overallPercentage).toFixed(1)}%`, tone: pctTone(num(summary?.overallPercentage)), sub: `${num(summary?.averageScore).toFixed(0)} marks / test`, formula: "Mean of every test's percentage", calc: `avg of ${timeline.length} tests = ${num(summary?.overallPercentage).toFixed(1)}%` },
    { label: "Best %", value: `${bestPct.toFixed(1)}%`, tone: "good", sub: `${summary?.highestScore ?? 0} marks — your ceiling` },
    { label: "Accuracy", value: `${num(summary?.overallAccuracy).toFixed(1)}%`, tone: pctTone(num(summary?.overallAccuracy)), sub: "of what you attempt", onClick: () => open({ title: "Incorrect questions", metric: "incorrect", formula: "Correct ÷ Attempted × 100", subtitle: `${num(summary?.overallAccuracy).toFixed(1)}% average accuracy — these are the misses` }) },
    { label: "Attempt Rate", value: `${num(summary?.overallAttemptRate).toFixed(1)}%`, tone: num(summary?.overallAttemptRate) >= 85 ? "good" : num(summary?.overallAttemptRate) >= 60 ? "neutral" : "risk", sub: "of the paper you try", onClick: () => open({ title: "Unattempted questions", metric: "unattempted", formula: "Attempted ÷ Total × 100", subtitle: `${(100 - num(summary?.overallAttemptRate)).toFixed(1)}% left blank on average` }) },
    { label: "Total Marks", value: totalMarksObtained.toLocaleString("en-IN"), tone: "brand", sub: `of ${(maxPerTest * (summary?.totalTests ?? 0)).toLocaleString("en-IN")} possible` },
  ];

  const dAcc = monthlyDelta(timeline, (t) => t.accuracy);

  // ── Performance breakdown table ──
  const columns: Column<TimelineEntry>[] = [
    { key: "name", header: "Test", sortable: true, sortValue: (r) => r.examTitle || "", render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-800 truncate max-w-[180px]">{r.examTitle || "Test"}</span>
        {num(r.attemptNumber) > 1 && <span className="text-[9px] font-black px-1 rounded bg-violet-50 text-violet-700">A{r.attemptNumber}</span>}
      </div>
    ) },
    { key: "date", header: "Date", align: "right", sortable: true, sortValue: (r) => new Date(r.attemptedAt || 0).getTime(), render: (r) => r.attemptedAt ? new Date(r.attemptedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—" },
    { key: "marks", header: "Marks", align: "right", sortable: true, sortValue: (r) => num(r.score), render: (r) => <span className="font-black text-slate-800">{num(r.score)}<span className="text-slate-400 font-semibold">/{num(r.totalMarks, 720)}</span></span> },
    { key: "pct", header: "%", align: "right", sortable: true, sortValue: (r) => num(r.percentage), render: (r) => {
      const p = num(r.percentage);
      const cls = p >= 65 ? "text-emerald-600" : p >= 40 ? "text-amber-600" : "text-rose-600";
      return <span className={`font-black ${cls}`}>{p.toFixed(1)}%</span>;
    } },
    { key: "acc", header: "Accuracy", align: "right", sortable: true, sortValue: (r) => num(r.accuracy), render: (r) => `${num(r.accuracy).toFixed(0)}%` },
    { key: "att", header: "Attempt", align: "right", sortable: true, sortValue: (r) => num(r.attemptRate), render: (r) => `${num(r.attemptRate).toFixed(0)}%` },
    { key: "status", header: "Status", align: "right", render: (r) => <StatusBadge2 pct={num(r.percentage)} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {cards.map((c) => (
          <StatTile key={c.label} label={c.label} value={c.value} sub={c.sub} tone={c.tone} onClick={c.onClick} formula={c.formula} calc={c.calc} />
        ))}
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Accuracy Gauge" subtitle="Average across all tests" icon={IconTarget}>
          <div className="flex flex-col items-center gap-1.5 py-2">
            <GaugeArc value={num(summary?.overallAccuracy)} size={220} caption={
              num(summary?.overallAccuracy) >= 80 ? "Top-tier accuracy" : num(summary?.overallAccuracy) >= 60 ? "Solid — push for 80%" : "Accuracy is the priority fix"
            } />
            {dAcc != null && (
              <p className={`text-[11px] font-bold ${dAcc > 0 ? "text-emerald-600" : dAcc < 0 ? "text-rose-600" : "text-slate-400"}`}>
                {dAcc > 0 ? "+" : ""}{dAcc}% vs prior month
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Score Bands" subtitle={`Where your ${timeline.length} test result${timeline.length !== 1 ? "s" : ""} land`} icon={IconChart}>
          <div className="pt-1 space-y-3">
            <StackedBar
              height={16}
              segments={[
                { label: "80%+", value: bands.hi, color: "#059669" },
                { label: "60–80%", value: bands.mid, color: "#10b981" },
                { label: "40–60%", value: bands.lo, color: "#d97706" },
                { label: "<40%", value: bands.poor, color: "#e11d48" },
              ]}
            />
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { l: "80%+", v: bands.hi, c: "text-emerald-600" },
                { l: "60–80%", v: bands.mid, c: "text-emerald-600" },
                { l: "40–60%", v: bands.lo, c: "text-amber-600" },
                { l: "<40%", v: bands.poor, c: "text-rose-600" },
              ].map((x) => (
                <div key={x.l} className="dash-inset px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">{x.l}</span>
                  <span className={`text-xs font-black tabular-nums ${x.v > 0 ? x.c : "text-slate-300"}`}>{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Marks Progress" subtitle={`${marksDelta > 0 ? "+" : ""}${marksDelta} marks since first test in range`} icon={IconTrendingUp}>
          {ranged.length >= 2 ? (
            <AreaLineChart
              data={ranged.map((t, i) => ({ label: `T${t.examNumber ?? i + 1}`, value: num(t.score), detail: `${t.examTitle || "Test"} · ${num(t.score)}/${num(t.totalMarks, 720)}` }))}
              height={190}
              color="#7c3aed"
              yMax={maxPerTest}
            />
          ) : <p className="py-8 text-center text-xs font-semibold text-slate-400">Need 2+ tests in range.</p>}
        </SectionCard>

        <SectionCard title="Attempt Rate by Subject" subtitle="How much of each paper you attempt" icon={IconCheck}>
          <HBarChart
            data={orderSubjects(subjectPerformance).map((s) => ({
              label: s.subject,
              value: num(s.attemptRate),
              detail: `${s.attempted}/${s.totalQuestions} Qs`,
              color: subjectColor(s.subject),
            }))}
            valueSuffix="%"
          />
        </SectionCard>
      </div>

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
