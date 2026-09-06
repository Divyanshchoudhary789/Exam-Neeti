"use client";

import React, { useMemo, useState } from "react";
import { IconTarget, IconChevronDown, IconChart } from "../../../common/UIComponents";
import { SectionCard, EmptyState, FilterPills, subjectColor, bandTone } from "../../../common/DashboardUI";
import { CustomSelectMenu } from "../../../common/UIComponents";
import { useDrilldown } from "../drilldown/DrilldownProvider";
import type { DashboardData, ChapterPerf, TopicPerf } from "../useDashboardData";
import { num } from "../lib";

type SortKey = "acc_desc" | "acc_asc" | "mistakes" | "attempted";
type BandKey = "all" | "excellent" | "good" | "average" | "weak";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "acc_asc", label: "Lowest Accuracy" },
  { value: "acc_desc", label: "Highest Accuracy" },
  { value: "mistakes", label: "Most Mistakes" },
  { value: "attempted", label: "Most Attempted" },
];

const band = (acc: number): Exclude<BandKey, "all"> =>
  acc >= 80 ? "excellent" : acc >= 65 ? "good" : acc >= 45 ? "average" : "weak";

const BAND_STYLE: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-700",
  good: "bg-teal-50 text-teal-700",
  average: "bg-amber-50 text-amber-700",
  weak: "bg-rose-50 text-rose-700",
};

export function ChaptersTab({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { chapterPerformance, topicPerformance } = data.analytics;
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState<SortKey>("acc_asc");
  const [bandFilter, setBandFilter] = useState<BandKey>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const subjects = useMemo(
    () => [...new Set(chapterPerformance.map((c) => c.subject?.toLowerCase()).filter(Boolean))],
    [chapterPerformance],
  );

  const rows = useMemo(() => {
    let r = chapterPerformance.filter((c) => (c.attempted || 0) > 0);
    if (subject !== "all") r = r.filter((c) => c.subject?.toLowerCase() === subject);
    if (bandFilter !== "all") r = r.filter((c) => band(num(c.accuracy)) === bandFilter);
    return [...r].sort((a, b) => {
      if (sort === "acc_desc") return num(b.accuracy) - num(a.accuracy);
      if (sort === "acc_asc") return num(a.accuracy) - num(b.accuracy);
      if (sort === "mistakes") return num(b.incorrect) - num(a.incorrect);
      return num(b.attempted) - num(a.attempted);
    });
  }, [chapterPerformance, subject, sort, bandFilter]);

  const weakCount = chapterPerformance.filter((c) => (c.attempted || 0) > 0 && num(c.accuracy) < 45).length;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Chapter & Topic Analytics"
        subtitle={`${chapterPerformance.filter((c) => (c.attempted || 0) > 0).length} chapters attempted · ${weakCount} need attention`}
        icon={IconTarget}
        bodyClassName="space-y-3"
      >
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
          <div className="sm:w-44">
            <CustomSelectMenu
              value={subject}
              onChange={setSubject}
              options={[{ value: "all", label: "All Subjects" }, ...subjects.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]}
              buttonClassName="!py-2 !text-xs"
            />
          </div>
          <div className="sm:w-52">
            <CustomSelectMenu value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} buttonClassName="!py-2 !text-xs" />
          </div>
        </div>
        <FilterPills
          value={bandFilter}
          onChange={setBandFilter}
          options={[
            { value: "all", label: "All" },
            { value: "excellent", label: "Excellent" },
            { value: "good", label: "Good" },
            { value: "average", label: "Average" },
            { value: "weak", label: "Weak" },
          ]}
        />
      </SectionCard>

      {rows.length === 0 ? (
        <SectionCard><EmptyState icon={IconChart} title="No chapters match" desc="Adjust the filters above." /></SectionCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((c) => (
            <ChapterCard
              key={`${c.subject}-${c.chapter}`}
              c={c}
              topics={topicPerformance.all.filter((t) => t.subject === c.subject && t.chapter === c.chapter)}
              expanded={expanded === `${c.subject}-${c.chapter}`}
              onToggle={() => setExpanded((e) => (e === `${c.subject}-${c.chapter}` ? null : `${c.subject}-${c.chapter}`))}
              onDrill={(params, title, subtitle) => open({ title, subtitle, metric: "incorrect", params })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterCard({
  c,
  topics,
  expanded,
  onToggle,
  onDrill,
}: {
  c: ChapterPerf;
  topics: TopicPerf[];
  expanded: boolean;
  onToggle: () => void;
  onDrill: (params: { subject: string; chapter?: string; topic?: string }, title: string, subtitle: string) => void;
}) {
  const acc = num(c.accuracy);
  const b = band(acc);
  const maxMarks = num(c.totalQuestions) * 4;

  return (
    <div className="dash-card overflow-hidden">
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: `${subjectColor(c.subject)}18`, color: subjectColor(c.subject) }}>{c.subject}</span>
              <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${BAND_STYLE[b]}`}>{b}</span>
            </div>
            <h4 className="text-sm font-black text-slate-900 mt-1 leading-tight">{c.chapter}</h4>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black tabular-nums" style={{ color: subjectColor(c.subject) }}>{acc.toFixed(0)}%</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">accuracy</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => onDrill({ subject: c.subject, chapter: c.chapter }, `${c.chapter} · incorrect`, `${c.incorrect} wrong of ${c.attempted} attempted`)}
            className="dash-inset dash-clickable p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Wrong</p>
            <p className="text-sm font-black text-rose-600 tabular-nums">{num(c.incorrect)}</p>
          </button>
          <div className="dash-inset p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Attempt</p>
            <p className="text-sm font-black text-slate-700 tabular-nums">{num(c.attemptRate).toFixed(0)}%</p>
          </div>
          <div className="dash-inset p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Marks</p>
            <p className="text-sm font-black text-slate-700 tabular-nums">{num(c.marksObtained)}<span className="text-slate-400 text-[10px]">/{maxMarks}</span></p>
          </div>
        </div>

        {topics.length > 0 && (
          <button onClick={onToggle} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 pt-1 cursor-pointer">
            {expanded ? "Hide" : `View ${topics.length} topic${topics.length !== 1 ? "s" : ""} inside`}
            <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {expanded && topics.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
          {topics.map((t) => {
            const ta = num(t.accuracy);
            return (
              <button key={t.topic}
                onClick={() => onDrill({ subject: t.subject, topic: t.topic }, `${t.topic} · incorrect`, `${t.chapter} · ${ta.toFixed(0)}% accuracy`)}
                className="w-full flex items-center gap-2 group text-left">
                <span className="text-[11px] font-bold text-slate-700 truncate flex-1 min-w-0">{t.topic}</span>
                <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden shrink-0">
                  <div className="h-full rounded-full" style={{ width: `${ta}%`, backgroundColor: bandTone(ta) === "good" ? "#059669" : bandTone(ta) === "warn" ? "#d97706" : "#e11d48" }} />
                </div>
                <span className="text-[10px] font-black tabular-nums text-slate-500 w-8 text-right shrink-0">{ta.toFixed(0)}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
