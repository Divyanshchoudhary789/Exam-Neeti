"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminService, type PlanOverviewRow } from "../../services/apiServices";
import { IconRocket, IconBook, IconUsers, Spinner } from "../common/UIComponents";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
  /** Jump to the Exams tab filtered to this plan's batch. */
  onViewExams: (batchId: string) => void;
}

/**
 * Admin "Plans & Tiers" — shows the self-serve plan catalog (free tier + paid)
 * with how many tests each currently has and how many students are on it.
 * An exam "given to a plan" is just an exam created against that plan's batch
 * (pick it as the Audience in Create Exam).
 */
export function PlanTiersPanel({ showToast, onViewExams }: Props) {
  const [rows, setRows] = useState<PlanOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getPlanOverview();
      const list = res?.data?.overview || res?.overview || [];
      setRows(Array.isArray(list) ? list : []);
    } catch {
      showToast("Failed to load plan overview", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const totalExams = rows.reduce((n, r) => n + r.publishedCount, 0);
  const totalStudents = rows.reduce((n, r) => n + r.studentCount, 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-black text-slate-900">Plans &amp; Tiers</h2>
        <p className="text-xs text-slate-500 font-semibold">
          Self-serve pricing catalog. Create a test for a tier by picking it as the <b>Audience</b> in Create Exam.
          Prices &amp; included test counts are set centrally by the platform team.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MiniStat label="Plans" value={rows.length} icon={IconRocket} />
        <MiniStat label="Published tests across tiers" value={totalExams} icon={IconBook} />
        <MiniStat label="Students on self-serve plans" value={totalStudents} icon={IconUsers} />
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">
          No plans are configured yet. The platform team sets these up centrally.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.key} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 flex flex-col justify-between ${r.isFreeTier ? "border-emerald-200" : "border-slate-200/90"}`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900">{r.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                    r.isFreeTier ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}>
                    {r.isFreeTier ? "Free tier" : `₹${r.priceRupees.toLocaleString("en-IN")}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold">
                  {r.durationDays ? `${r.durationDays}-day access` : "One-time access"} · {r.testsIncluded} test{r.testsIncluded === 1 ? "" : "s"} included
                  {!r.isActive && <span className="text-red-600"> · inactive</span>}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
                    {r.publishedCount} published{r.examCount > r.publishedCount ? ` · ${r.examCount - r.publishedCount} draft` : ""}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600">
                    {r.studentCount} student{r.studentCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => r.batchId && onViewExams(r.batchId)}
                disabled={!r.batchId}
                className="w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                View / add this tier&apos;s tests
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.FC<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
    </div>
  );
}
