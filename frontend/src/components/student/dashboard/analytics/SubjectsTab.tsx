"use client";

import React, { useMemo } from "react";
import { IconBook, IconChart, IconInfo } from "../../../common/UIComponents";
import { RadarChart, type RadarSeries } from "../../../common/Charts";
import { SectionCard, EmptyState, subjectColor } from "../../../common/DashboardUI";
import { useDrilldown } from "../drilldown/DrilldownProvider";
import type { DashboardData } from "../useDashboardData";
import { num, orderSubjects } from "../lib";

const DIFFS = ["easy", "medium", "hard"] as const;
const RADAR_AXES = ["Accuracy", "Attempt rate", "Easy Qs", "Medium Qs", "Hard Qs"] as const;

export function SubjectsTab({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { subjectPerformance, subjectDifficultyPerformance, topicPerformance } = data.analytics;

  const subjects = orderSubjects(subjectPerformance);

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
          num(s.accuracy),
          num(s.attemptRate),
          diffAcc(s.subject, "easy") ?? 0,
          diffAcc(s.subject, "medium") ?? 0,
          diffAcc(s.subject, "hard") ?? 0,
        ],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectPerformance, subjectDifficultyPerformance],
  );

  // Plain-language takeaway per subject — strongest vs weakest spoke on the radar.
  const radarInsights = useMemo(
    () => radarSeries.map((s) => {
      let hi = 0, lo = 0;
      s.values.forEach((v, i) => { if (v > s.values[hi]) hi = i; if (v < s.values[lo]) lo = i; });
      const spread = s.values[hi] - s.values[lo];
      return {
        subject: s.label,
        color: s.color,
        text: spread < 12
          ? `Balanced across the board — no single spoke stands out, so keep building overall accuracy.`
          : `Strongest at ${RADAR_AXES[hi]} (${s.values[hi].toFixed(0)}%), weakest at ${RADAR_AXES[lo]} (${s.values[lo].toFixed(0)}%) — that gap is where the marks are.`,
      };
    }),
    [radarSeries],
  );

  if (subjects.length === 0) {
    return <SectionCard><EmptyState icon={IconBook} title="No subject data" desc="Subject analytics appear once a test is scored." /></SectionCard>;
  }

  const gridCols = subjects.length === 1 ? "md:grid-cols-1" : subjects.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${gridCols} gap-3 sm:gap-4`}>
        {subjects.map((s) => {
          const skipped = Math.max(0, num(s.totalQuestions) - num(s.attempted));
          const weakZones = topicPerformance.weak.filter((t) => t.subject?.toLowerCase() === s.subject.toLowerCase()).slice(0, 3);
          return (
            <SectionCard key={s.subject} className="overflow-hidden" bodyClassName="space-y-3">
              <div className="flex items-center justify-between gap-2 -mt-1">
                <h3 className="text-sm font-black capitalize text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subjectColor(s.subject) }} />
                  {s.subject}
                </h3>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0"
                  style={{ backgroundColor: `${subjectColor(s.subject)}14`, color: subjectColor(s.subject) }}>
                  {num(s.accuracy).toFixed(0)}% acc
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { l: "Marks", v: `${num(s.marksObtained)}` },
                  { l: "Attempt", v: `${num(s.attemptRate).toFixed(0)}%` },
                  { l: "Questions", v: `${num(s.attempted)}/${num(s.totalQuestions)}` },
                ].map((x) => (
                  <div key={x.l} className="dash-inset p-2 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">{x.l}</p>
                    <p className="text-sm font-black text-slate-900 tabular-nums">{x.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { l: "Correct", v: num(s.correct), c: "text-emerald-600", m: "correct" as const },
                  { l: "Incorrect", v: num(s.incorrect), c: "text-rose-600", m: "incorrect" as const },
                  { l: "Skipped", v: skipped, c: "text-slate-500", m: "unattempted" as const },
                ].map((x) => (
                  <button key={x.l} onClick={() => open({ title: `${s.subject} · ${x.l.toLowerCase()}`, metric: x.m, params: { subject: s.subject }, subtitle: `${x.v} questions` })}
                    className="dash-inset dash-clickable p-2 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">{x.l}</p>
                    <p className={`text-sm font-black tabular-nums ${x.c}`}>{x.v}</p>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Accuracy by difficulty</p>
                <div className="space-y-1.5">
                  {DIFFS.map((d) => {
                    const v = diffAcc(s.subject, d);
                    return (
                      <button key={d} disabled={v == null}
                        onClick={() => open({ title: `${s.subject} · ${d} · incorrect`, metric: "incorrect", params: { subject: s.subject, difficulty: d } })}
                        className="w-full flex items-center gap-2 group disabled:opacity-50">
                        <span className="text-[10px] font-bold text-slate-500 capitalize w-14 text-left shrink-0">{d}</span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full group-hover:brightness-110 transition-all" style={{ width: `${v ?? 0}%`, backgroundColor: subjectColor(s.subject) }} />
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-slate-600 w-9 text-right shrink-0">{v == null ? "—" : `${v.toFixed(0)}%`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {weakZones.length > 0 && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-rose-500 mb-1.5">Weak zones</p>
                  <div className="flex flex-wrap gap-1">
                    {weakZones.map((t) => (
                      <button key={t.topic}
                        onClick={() => open({ title: t.topic, subtitle: `${t.subject} · ${t.chapter} · ${num(t.accuracy).toFixed(0)}% accuracy`, metric: "incorrect", params: { subject: t.subject, topic: t.topic } })}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors">
                        {t.topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      <SectionCard title="Subject Comparison" subtitle="One shape per subject — how you perform on five fronts. Tap a subject in the legend to show/hide it." icon={IconChart}>
        <RadarChart
          axes={[...RADAR_AXES]}
          series={radarSeries}
          size={320}
          showScale
          valueSuffix="%"
        />

        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-slate-500 leading-snug flex items-start gap-1.5">
            <IconInfo className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
            Every spoke is a score from 0 to 100. <b className="font-bold text-slate-700">Bigger and more even</b> = strong and consistent. A spoke pulled toward the centre is a weak spot. <span className="text-slate-400">Easy / Medium / Hard Qs = your accuracy on questions of that difficulty.</span>
          </p>
          <div className="space-y-1.5 pt-0.5">
            {radarInsights.map((r) => (
              <p key={r.subject} className="text-[11px] font-semibold text-slate-600 leading-snug flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: r.color }} />
                <span><span className="font-black capitalize text-slate-800">{r.subject}:</span> {r.text}</span>
              </p>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
