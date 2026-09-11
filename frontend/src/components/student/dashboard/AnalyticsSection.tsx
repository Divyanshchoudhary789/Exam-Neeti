"use client";

import React from "react";
import { IconChart, CardSkeleton } from "../../common/UIComponents";
import { SectionCard, EmptyState } from "../../common/DashboardUI";
import type { DashboardData } from "./useDashboardData";
import { DeepDiveTab } from "./analytics/DeepDiveTab";

/**
 * "Deep Analytics" — the reference's four-lens deep dive
 * (Accuracy Analysis · Negative Marking · Time Utilization · Recoverable Marks).
 * The lens implementations live in ./analytics/DeepDiveTab; this section adds the
 * page header and the no-data / loading guards the old AnalyticsHub used to own.
 */
export function AnalyticsSection({
  data,
  onViewAttempt,
}: {
  data: DashboardData;
  onViewAttempt: (id: string) => void;
}) {
  const { analytics, loading, selectedSprint } = data;
  const hasData = !!analytics.summary && analytics.timeline.length > 0;

  return (
    <div className="space-y-4 animate-dash-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Deep Analytics</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
          Four lenses on the same {analytics.timeline.length || ""} test{analytics.timeline.length !== 1 ? "s" : ""} — pick your angle.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : !hasData ? (
        <SectionCard>
          <EmptyState
            icon={IconChart}
            title="No analytics for this sprint yet"
            desc={`Once a test in "${selectedSprint?.name || "this sprint"}" is submitted and scored, its accuracy, negative-marking, timing and recoverable-marks analytics show up here.`}
          />
        </SectionCard>
      ) : (
        <DeepDiveTab data={data} onViewAttempt={onViewAttempt} />
      )}
    </div>
  );
}
