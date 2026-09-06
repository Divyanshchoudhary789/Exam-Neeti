"use client";

import React, { useState } from "react";
import { IconChart, IconBook, IconTarget, IconAlertTriangle, CardSkeleton } from "../../../common/UIComponents";
import { SegmentedControl, EmptyState, SectionCard } from "../../../common/DashboardUI";
import { RANGE_OPTIONS, type RangeKey } from "../lib";
import type { DashboardData } from "../useDashboardData";
import { PerformanceTab } from "./PerformanceTab";
import { SubjectsTab } from "./SubjectsTab";
import { ChaptersTab } from "./ChaptersTab";
import { DeepDiveTab } from "./DeepDiveTab";

type InnerTab = "performance" | "subjects" | "chapters" | "deepdive";

const TABS: { id: InnerTab; label: string; Icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "performance", label: "Performance", Icon: IconChart, hint: "Scores, accuracy & trends across every test" },
  { id: "subjects", label: "Subjects", Icon: IconBook, hint: "How you do in each subject and at each difficulty" },
  { id: "chapters", label: "Chapters", Icon: IconTarget, hint: "Chapter- and topic-level strengths and gaps" },
  { id: "deepdive", label: "Deep Dive", Icon: IconAlertTriangle, hint: "Negative marking, timing & recoverable marks" },
];

export function AnalyticsHub({
  data,
  onViewAttempt,
}: {
  data: DashboardData;
  onViewAttempt: (id: string) => void;
}) {
  const [tab, setTab] = useState<InnerTab>("performance");
  const [range, setRange] = useState<RangeKey>("all");
  const { selectedSprint, loading, analytics } = data;

  const hasData = !!analytics.summary && analytics.timeline.length > 0;
  const testCount = analytics.timeline.length;
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-4 animate-dash-in">
      {/* Hub header */}
      <div className="dash-card px-4 sm:px-5 py-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">{activeTab.label}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 truncate max-w-[180px]">
                {selectedSprint?.name || "Sprint"}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">{activeTab.hint}</p>
          </div>
          {hasData && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-[11px] font-bold text-slate-400">{testCount} test{testCount !== 1 ? "s" : ""}</span>
              <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} size="md" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mb-1 pb-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                tab === id ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !hasData ? (
        <SectionCard>
          <EmptyState
            icon={IconChart}
            title="No analytics for this sprint yet"
            desc={`Once a test in "${selectedSprint?.name || "this sprint"}" is submitted and scored, its performance, subject, chapter and deep-dive analytics show up here. Switch sprints from the picker up top if you have activity elsewhere.`}
          />
        </SectionCard>
      ) : (
        <>
          {tab === "performance" && <PerformanceTab data={data} range={range} onViewAttempt={onViewAttempt} />}
          {tab === "subjects" && <SubjectsTab data={data} />}
          {tab === "chapters" && <ChaptersTab data={data} />}
          {tab === "deepdive" && <DeepDiveTab data={data} onViewAttempt={onViewAttempt} />}
        </>
      )}
    </div>
  );
}
