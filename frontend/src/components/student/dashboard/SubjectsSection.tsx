"use client";

import React, { useMemo, useState } from "react";
import { IconBook, IconChart, IconInfo, IconCheck, IconCross, IconAlertTriangle, CardSkeleton } from "../../common/UIComponents";
import { RadarChart, type RadarSeries } from "../../common/Charts";
import {
  SectionCard, EmptyState, SegmentedControl, subjectColor, subjectGradient,
  GradientIconTile, WeightageCoverageRow,
} from "../../common/DashboardUI";
import { useDrilldown } from "./drilldown/DrilldownProvider";
import type { DashboardData } from "./useDashboardData";
import { num, orderSubjects, RANGE_OPTIONS, filterByRange, type RangeKey } from "./lib";

const DIFFS = ["easy", "medium", "hard"] as const;
const RADAR_AXES = ["Accuracy", "Attempt rate", "Easy Qs", "Medium Qs", "Hard Qs"] as const;

export function SubjectsSection({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { analytics, loading, selectedSprint } = data;
  const { subjectPerformance, subjectDifficultyPerformance, topicPerformance, weightageCoverage, timeline } = analytics;
  const [range, setRange] = useState<RangeKey>("all");

  const subjects = orderSubjects(subjectPerformance);
  const ranged = useMemo(() => filterByRange(timeline, range), [timeline, range]);
  const testsInRange = ranged.length;

  const diffAcc = (subject: string, diff: string) => {
    const row = subjectDifficultyPerformance.find(
      (d) => d.subject?.toLowerCase() === subject.toLowerCase() && d.difficulty?.toLowerCase() === diff,
    );
    return row ? num(row.accuracy) : null;
  };

  const radarSeries: RadarSeries[] = useMemo(
    () =>
      subjects.map((s) => ({
        label: s.subject,
        color: subjectColor(s.subject),
        values: [
          num(s.accuracy), num(s.attemptRate),
          diffAcc(s.subject, "easy") ?? 0, diffAcc(s.subject, "medium") ?? 0, diffAcc(s.subject, "hard") ?? 0,
        ],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectPerformance, subjectDifficultyPerformance],
  );

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  }
  if (subjects.length === 0) {
    return <SectionCard><EmptyState icon={IconBook} title="No subject data" desc="Subject analytics appear once a test is scored." /></SectionCard>;
  }

  const gridCols = subjects.length === 1 ? "md:grid-cols-1" : subjects.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-5 animate-dash-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Subject Performance</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {testsInRange} test{testsInRange !== 1 ? "s" : ""} · {selectedSprint?.name || "this sprint"}
          </p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} size="md" />
      </div>

      <div className={`grid grid-cols-1 ${gridCols} gap-3 sm:gap-4`}>
        {subjects.map((s) => {
          const skipped = Math.max(0, num(s.totalQuestions) - num(s.attempted));
          const scoreProgress = num(s.marksObtained) > 0 && num(s.totalQuestions) > 0
            ? Math.round((num(s.marksObtained) / (num(s.totalQuestions) * 4)) * 100)
            : 0;
          const weakZones = topicPerformance.weak.filter((t) => t.subject?.toLowerCase() === s.subject.toLowerCase()).slice(0, 3);
          return (
            <div key={s.subject} className="dash-card dash-accent-card p-4 space-y-3" style={{ ["--accent" as string]: subjectGradient(s.subject) }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GradientIconTile icon={IconBook} gradient={subjectGradient(s.subject)} />
                  <h3 className="text-sm font-black capitalize text-slate-900 truncate">{s.subject}</h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Avg Score</p>
                  <p className="text-lg font-black tabular-nums" style={{ color: subjectColor(s.subject) }}>{num(s.accuracy).toFixed(0)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="dash-inset p-2">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Accuracy</p>
                  <p className="text-base font-black tabular-nums" style={{ color: subjectColor(s.subject) }}>{num(s.accuracy).toFixed(0)}%</p>
                </div>
                <div className="dash-inset p-2">
                  <p className="text-[9px] font-extrabold uppercase text-slate-400">Attempt Rate</p>
                  <p className="text-base font-black tabular-nums" style={{ color: subjectColor(s.subject) }}>{num(s.attemptRate).toFixed(0)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { l: "Correct", v: num(s.correct), Icon: IconCheck, cls: "bg-emerald-50 text-emerald-700", m: "correct" as const },
                  { l: "Incorrect", v: num(s.incorrect), Icon: IconCross, cls: "bg-rose-50 text-rose-700", m: "incorrect" as const },
                  { l: "Skipped", v: skipped, Icon: IconChart, cls: "bg-slate-100 text-slate-600", m: "unattempted" as const },
                ].map((x) => (
                  <button key={x.l} onClick={() => open({ title: `${s.subject} · ${x.l.toLowerCase()}`, metric: x.m, params: { subject: s.subject }, subtitle: `${x.v} questions` })}
                    className={`rounded-xl p-2 text-center dash-clickable ${x.cls}`}>
                    <p className="text-sm font-black tabular-nums">{x.v}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wide opacity-80">{x.l}</p>
                  </button>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1">
                  <span>Score progress</span><span style={{ color: subjectColor(s.subject) }}>{scoreProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${scoreProgress}%`, backgroundColor: subjectColor(s.subject) }} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Accuracy by difficulty</p>
                <div className="space-y-1.5">
                  {DIFFS.map((d) => {
                    const v = diffAcc(s.subject, d);
                    const c = d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444";
                    return (
                      <button key={d} disabled={v == null}
                        onClick={() => open({
                          title: `${s.subject} · ${d[0].toUpperCase()}${d.slice(1)} questions`,
                          subtitle: `${v == null ? "—" : `${v.toFixed(0)}%`} accuracy at this difficulty`,
                          metric: "attempted",
                          params: { subject: s.subject, difficulty: d },
                          note: "Every question you attempted here — correct and incorrect. Tap one for its solution.",
                        })}
                        className="w-full flex items-center gap-2 group disabled:opacity-50">
                        <span className="text-[10px] font-bold text-slate-500 capitalize w-12 text-left shrink-0">{d}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full group-hover:brightness-110 transition-all" style={{ width: `${v ?? 0}%`, backgroundColor: c }} />
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-slate-600 w-9 text-right shrink-0">{v == null ? "—" : `${v.toFixed(0)}%`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ADD per doc: chapters covered by weightage */}
              <WeightageCoverageRow data={weightageCoverage?.[s.subject] || weightageCoverage?.[s.subject?.toLowerCase()]} />

              {weakZones.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-2.5 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 flex items-center gap-1 mb-1">
                    <IconAlertTriangle className="w-3 h-3" /> Weak zone: {weakZones.map((t) => t.topic).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SectionCard title="Subject Comparison Radar" subtitle="One shape per subject — five fronts. Tap a subject in the legend to show/hide." icon={IconChart}>
        <RadarChart axes={[...RADAR_AXES]} series={radarSeries} size={320} showScale valueSuffix="%" />
        <p className="mt-3 text-[11px] font-semibold text-slate-500 leading-snug flex items-start gap-1.5">
          <IconInfo className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
          Every spoke is a 0–100 score. Bigger and more even = strong and consistent; a spoke pulled toward the centre is a weak spot.
        </p>
      </SectionCard>
    </div>
  );
}
