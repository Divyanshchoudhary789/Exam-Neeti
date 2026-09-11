"use client";

import React, { useMemo, useState } from "react";
import { IconChevronDown, IconChart, IconSearch, IconClock, IconCheck, IconCross, CardSkeleton, CustomSelectMenu } from "../../common/UIComponents";
import { RadialMeter } from "../../common/Charts";
import { SectionCard, EmptyState, FilterPills, subjectColor, subjectGradient, fmtSecs } from "../../common/DashboardUI";
import { useDrilldown } from "./drilldown/DrilldownProvider";
import type { DashboardData, ChapterPerf, TopicPerf } from "./useDashboardData";
import { num } from "./lib";

type SortKey = "acc_desc" | "acc_asc" | "mistakes" | "time";
type BandKey = "all" | "excellent" | "good" | "average" | "weak" | "critical";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "acc_asc", label: "Lowest Accuracy" },
  { value: "acc_desc", label: "Highest Accuracy" },
  { value: "mistakes", label: "Most Mistakes" },
  { value: "time", label: "Most Time Taken" },
];

const band = (acc: number): Exclude<BandKey, "all"> =>
  acc >= 80 ? "excellent" : acc >= 65 ? "good" : acc >= 45 ? "average" : acc >= 30 ? "weak" : "critical";

const BAND_STYLE: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-700",
  good: "bg-teal-50 text-teal-700",
  average: "bg-amber-50 text-amber-700",
  weak: "bg-orange-50 text-orange-700",
  critical: "bg-rose-50 text-rose-700",
};

export function ChaptersSection({ data }: { data: DashboardData }) {
  const { open } = useDrilldown();
  const { analytics, loading } = data;
  const { chapterPerformance, topicPerformance } = analytics;
  const [q, setQ] = useState("");
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
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter((c) =>
        c.chapter?.toLowerCase().includes(needle) ||
        topicPerformance.all.some((t) => t.chapter === c.chapter && t.subject === c.subject && t.topic?.toLowerCase().includes(needle)),
      );
    }
    return [...r].sort((a, b) => {
      if (sort === "acc_desc") return num(b.accuracy) - num(a.accuracy);
      if (sort === "acc_asc") return num(a.accuracy) - num(b.accuracy);
      if (sort === "mistakes") return num(b.incorrect) - num(a.incorrect);
      return num(b.avgTimeSeconds) - num(a.avgTimeSeconds);
    });
  }, [chapterPerformance, topicPerformance, subject, sort, bandFilter, q]);

  const weakCount = chapterPerformance.filter((c) => (c.attempted || 0) > 0 && num(c.accuracy) < 45).length;
  const attemptedCount = chapterPerformance.filter((c) => (c.attempted || 0) > 0).length;

  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  }

  return (
    <div className="space-y-4 animate-dash-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Chapter &amp; Topic Analytics</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
          {attemptedCount} chapters · <span className="text-rose-600 font-bold">{weakCount} need attention</span>
        </p>
      </div>

      <SectionCard bodyClassName="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chapters or topics…"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <div className="sm:w-44">
              <CustomSelectMenu value={subject} onChange={setSubject}
                options={[{ value: "all", label: "All Subjects" }, ...subjects.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]}
                buttonClassName="!py-2.5 !text-xs" />
            </div>
            <div className="sm:w-48">
              <CustomSelectMenu value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} buttonClassName="!py-2.5 !text-xs" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 shrink-0">Performance</span>
          <FilterPills value={bandFilter} onChange={setBandFilter}
            options={[
              { value: "all", label: "All" },
              { value: "excellent", label: "Excellent" },
              { value: "good", label: "Good" },
              { value: "average", label: "Average" },
              { value: "weak", label: "Weak" },
              { value: "critical", label: "Critical" },
            ]} />
        </div>
      </SectionCard>

      {rows.length === 0 ? (
        <SectionCard><EmptyState icon={IconChart} title="No chapters match" desc="Adjust the search or filters above." /></SectionCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
  const avgTime = num(c.avgTimeSeconds);

  return (
    <div className="dash-card dash-accent-card overflow-hidden" style={{ ["--accent" as string]: subjectGradient(c.subject) }}>
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: `${subjectColor(c.subject)}18`, color: subjectColor(c.subject) }}>{c.subject}</span>
              <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${BAND_STYLE[b]}`}>{b}</span>
            </div>
            <h4 className="text-sm font-black text-slate-900 mt-1 leading-tight">{c.chapter}</h4>
          </div>
          <RadialMeter value={acc} size={54} strokeWidth={6} color={subjectColor(c.subject)} />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => onDrill({ subject: c.subject, chapter: c.chapter }, `${c.chapter} · incorrect`, `${c.incorrect} wrong of ${c.attempted} attempted`)}
            className="dash-inset dash-clickable p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Attempt</p>
            <p className="text-sm font-black text-slate-700 tabular-nums">{num(c.attemptRate).toFixed(0)}%</p>
          </button>
          <div className="dash-inset p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Marks</p>
            <p className="text-sm font-black text-slate-700 tabular-nums">{num(c.marksObtained)}<span className="text-slate-400 text-[10px]">/{maxMarks}</span></p>
          </div>
          <div className="dash-inset p-2 text-center">
            <p className="text-[9px] font-extrabold uppercase text-slate-400">Avg Time</p>
            <p className="text-sm font-black text-slate-700 tabular-nums">{avgTime > 0 ? fmtSecs(avgTime) : "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <span className="inline-flex items-center gap-1"><IconCheck className="w-3 h-3 text-slate-400" />{num(c.attempted)} attempted</span>
          <span className="inline-flex items-center gap-1"><IconCross className="w-3 h-3 text-rose-400" />{num(c.incorrect)} incorrect</span>
        </div>

        {topics.length > 0 && (
          <button onClick={onToggle} className="w-full flex items-center justify-between gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 pt-1 cursor-pointer rounded-lg dash-inset px-3 py-2">
            {expanded ? "Hide topics" : `View ${topics.length} topic${topics.length !== 1 ? "s" : ""} inside`}
            <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {expanded && topics.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
          {topics.map((t) => <TopicRow key={t.topic} t={t} onDrill={onDrill} />)}
        </div>
      )}
    </div>
  );
}

function TopicRow({
  t,
  onDrill,
}: {
  t: TopicPerf;
  onDrill: (params: { subject: string; topic?: string }, title: string, subtitle: string) => void;
}) {
  const ta = num(t.accuracy);
  const b = band(ta);
  const [showDiff, setShowDiff] = useState(false);
  const byDiff = t.byDifficulty || {};
  const hasDiff = Object.keys(byDiff).length > 0;
  const DIFF_ORDER = ["easy", "medium", "hard"];

  return (
    <div className="rounded-xl bg-white border border-slate-100 p-2.5">
      <button onClick={() => hasDiff ? setShowDiff((s) => !s) : onDrill({ subject: t.subject, topic: t.topic }, `${t.topic} · incorrect`, `${t.chapter} · ${ta.toFixed(0)}% accuracy`)}
        className="w-full flex items-center gap-2 text-left">
        <span className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: subjectColor(t.subject) }} />
        <span className="text-[11px] font-bold text-slate-700 truncate flex-1 min-w-0">{t.topic}</span>
        <span className={`text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${BAND_STYLE[b]}`}>{b}</span>
        <span className="text-[10px] font-black tabular-nums text-slate-500 w-8 text-right shrink-0">{ta.toFixed(0)}%</span>
        {hasDiff && <IconChevronDown className={`w-3 h-3 text-slate-300 transition-transform ${showDiff ? "rotate-180" : ""}`} />}
      </button>

      {/* ADD per doc: attempt rate by difficulty + accuracy by difficulty */}
      {hasDiff && showDiff && (
        <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-100">
          {[
            { label: "Attempt Rate by Difficulty", key: "attemptRate" as const },
            { label: "Accuracy by Difficulty", key: "accuracy" as const },
          ].map((col) => (
            <div key={col.key}>
              <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><IconClock className="w-2.5 h-2.5" />{col.label}</p>
              <div className="space-y-1">
                {DIFF_ORDER.map((d) => {
                  const dBand = byDiff[d];
                  if (!dBand) return null;
                  const v = num(dBand[col.key]);
                  const c = d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={d} className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-500 capitalize w-9 shrink-0">{d}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: c }} />
                      </div>
                      <span className="text-[9px] font-black tabular-nums text-slate-500 w-7 text-right shrink-0">{v.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={() => onDrill({ subject: t.subject, topic: t.topic }, `${t.topic} · incorrect`, `${t.chapter} · ${ta.toFixed(0)}% accuracy`)}
            className="col-span-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 text-center pt-0.5">
            See the questions →
          </button>
        </div>
      )}
    </div>
  );
}
