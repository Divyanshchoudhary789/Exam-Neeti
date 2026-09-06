"use client";

import React, { useCallback, useEffect, useState } from "react";
import { superAdminService, adminService } from "../../services/apiServices";
import { IconUsers, IconClock, IconChart, IconFilter, MiniStatCard } from "../common/UIComponents";
import { DonutChart } from "../common/Charts";
import { type AuditLogItem, formatRelativeTime, getActionBadgeStyle } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
  /** Jump to another dashboard section. */
  onNavigate: (tab: string) => void;
}

type PlatformStats = {
  team?: { totalAdmins?: number; activeAdmins?: number; inactiveAdmins?: number };
  students?: { total?: number; active?: number; inactive?: number };
  platform?: { totalBatches?: number; activeBatches?: number; totalExams?: number; totalAttempts?: number };
};
type QuestionStats = { total?: number; active?: number; recentlyAdded?: number; bySubject?: Record<string, number> };

/**
 * Platform-health strip shown at the top of the super-admin Dashboard tab:
 * live counts from /admin-team/platform-stats + /questions/stats + a slice of
 * the audit trail. Fetches its own data; nothing here is a placeholder.
 */
export function PlatformHealthPanel({ showToast, onNavigate }: Props) {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogItem[]>([]);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [stats, qStats, activity] = await Promise.allSettled([
      superAdminService.getPlatformStats(),
      adminService.getQuestionStats(),
      superAdminService.getAuditLogs({ page: 1, limit: 6 }),
    ]);
    if (stats.status === "fulfilled" && stats.value?.data) setPlatformStats(stats.value.data);
    else if (stats.status === "rejected") showToast("Failed to load platform overview stats", "error");
    if (qStats.status === "fulfilled" && qStats.value?.data) setQuestionStats(qStats.value.data);
    if (activity.status === "fulfilled" && activity.value?.data) setRecentActivity(activity.value.data.logs || []);
    setLoadedAt(new Date());
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const snapshot = [
    {
      label: "Avg. attempts / exam",
      value: (platformStats?.platform?.totalExams ?? 0) > 0
        ? (Number(platformStats?.platform?.totalAttempts ?? 0) / Number(platformStats?.platform?.totalExams ?? 1)).toFixed(1)
        : "—",
    },
    { label: "Questions this week", value: `+${questionStats?.recentlyAdded ?? 0}` },
    {
      label: "Records governed",
      value: (
        (platformStats?.team?.totalAdmins ?? 0) +
        (platformStats?.students?.total ?? 0) +
        (platformStats?.platform?.totalBatches ?? 0) +
        (questionStats?.total ?? 0)
      ).toLocaleString(),
    },
    {
      label: "Active batch rate",
      value: (platformStats?.platform?.totalBatches ?? 0) > 0
        ? `${Math.round((Number(platformStats?.platform?.activeBatches ?? 0) / Number(platformStats?.platform?.totalBatches ?? 1)) * 100)}%`
        : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MiniStatCard
          title="Admin Team Accounts"
          value={platformStats?.team?.totalAdmins ?? 0}
          subtitle={`${platformStats?.team?.activeAdmins ?? 0} Active • ${platformStats?.team?.inactiveAdmins ?? 0} Deactivated`}
          icon={IconUsers}
          ringValue={platformStats?.team?.totalAdmins ? Math.round((Number(platformStats.team.activeAdmins ?? 0) / Number(platformStats.team.totalAdmins)) * 100) : undefined}
        />
        <MiniStatCard
          title="Total Enrolled Students"
          value={platformStats?.students?.total ?? 0}
          subtitle={`${platformStats?.students?.active ?? 0} Active • ${platformStats?.students?.inactive ?? 0} Inactive`}
          icon={IconUsers}
          ringValue={platformStats?.students?.total ? Math.round((Number(platformStats.students.active ?? 0) / Number(platformStats.students.total)) * 100) : undefined}
        />
        <MiniStatCard
          title="Active Batches"
          value={platformStats?.platform?.activeBatches ?? 0}
          subtitle={`Out of ${platformStats?.platform?.totalBatches ?? 0} total batches`}
          icon={IconClock}
          ringValue={platformStats?.platform?.totalBatches ? Math.round((Number(platformStats.platform.activeBatches ?? 0) / Number(platformStats.platform.totalBatches)) * 100) : undefined}
        />
        <MiniStatCard
          title="Exam Submissions"
          value={platformStats?.platform?.totalAttempts ?? 0}
          subtitle={`${platformStats?.platform?.totalExams ?? 0} Total Exams Created`}
          icon={IconChart}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><IconFilter className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-black text-slate-900">Question Bank Pulse</h2></div>
            <button onClick={() => onNavigate("questions")} className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer shrink-0">Open &rarr;</button>
          </div>
          {!questionStats || !questionStats.bySubject || Object.keys(questionStats.bySubject).length === 0 ? (
            <p className="text-xs text-slate-500 font-semibold p-6 text-center">No questions in the bank yet.</p>
          ) : (
            <>
              <DonutChart
                size={128}
                strokeWidth={16}
                centerLabel={String(questionStats.active ?? 0)}
                centerSublabel="Active Questions"
                data={Object.entries(questionStats.bySubject).map(([label, value], i) => ({
                  label, value, color: ["#4f46e5", "#7c3aed", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"][i % 6],
                }))}
              />
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Added this week</span>
                <span className="text-emerald-600 font-black">+{questionStats.recentlyAdded ?? 0}</span>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><IconClock className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-black text-slate-900">Recent Activity</h2></div>
            <button onClick={() => onNavigate("logs")} className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer shrink-0">View All &rarr;</button>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500 font-semibold p-6 text-center">No recent activity recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivity.map((log) => {
                const badge = getActionBadgeStyle(log.action);
                return (
                  <button key={log._id} onClick={() => onNavigate("logs")} className="w-full py-3 flex items-start gap-2.5 text-left hover:bg-slate-50/80 px-1.5 rounded-xl transition-colors cursor-pointer">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate">
                        <span className="text-indigo-700">{log.actor?.name || "System"}</span>{" "}
                        <span className="text-slate-400 font-semibold">{badge.label.replace(/_/g, " ").toLowerCase()}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><IconChart className="w-5 h-5 text-indigo-600" /><h2 className="text-base font-black text-slate-900">Live Snapshot</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {snapshot.map(({ label, value }) => (
              <div key={label} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60">
                <p className="text-lg font-black text-slate-900 leading-none tabular-nums">{value}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-semibold pt-1">
            Refreshed {loadedAt ? formatRelativeTime(loadedAt.toISOString()) : "just now"}
          </p>
        </div>
      </div>
    </div>
  );
}
