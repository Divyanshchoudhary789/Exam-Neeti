"use client";

import React, { useEffect, useState } from "react";
import { studentService } from "../../../services/apiServices";
import { IconSearch, IconClock, CardSkeleton, PaginationControls, CustomSelectMenu, IconChevronRight } from "../../common/UIComponents";
import { SectionCard, EmptyState, StatusBadge2 } from "../../common/DashboardUI";

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function HistorySection({ onViewAttempt }: { onViewAttempt: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const [sprintFilter, setSprintFilter] = useState("");
  const [scoreBand, setScoreBand] = useState("");
  const [sprintOptions, setSprintOptions] = useState<{ value: string; label: string }[]>([]);
  const [attempts, setAttempts] = useState<Record<string, unknown>[]>([]);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getStudentAttemptedSprints()
      .then((res) => {
        const list = res?.data?.sprints || res?.sprints || [];
        setSprintOptions((Array.isArray(list) ? list : []).map((s: Record<string, unknown>) => ({ value: String(s._id || s.id), label: String(s.name || "Sprint") })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [dSearch, sprintFilter, scoreBand]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentService.getMyAttempts({
      page, limit: 10,
      sprintId: sprintFilter || undefined,
      search: dSearch || undefined,
      scoreBand: (scoreBand || undefined) as "high" | "medium" | "low" | undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data?.attempts || res?.attempts || [];
        setAttempts(Array.isArray(raw) ? raw : []);
        setPagination(res?.pagination || null);
      })
      .catch(() => { if (!cancelled) { setAttempts([]); setPagination(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, dSearch, sprintFilter, scoreBand]);

  return (
    <div className="space-y-4 animate-dash-in">
      <SectionCard title="Attempt History" subtitle={pagination ? `${pagination.total} record${pagination.total !== 1 ? "s" : ""}` : undefined} icon={IconClock} bodyClassName="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by test name…"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10" />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <div className="sm:w-52">
              <CustomSelectMenu value={sprintFilter} onChange={setSprintFilter}
                options={[{ value: "", label: "All Sprints" }, ...sprintOptions]} placeholder="All Sprints" buttonClassName="!py-2.5 !text-xs" />
            </div>
            <div className="sm:w-44">
              <CustomSelectMenu value={scoreBand} onChange={setScoreBand}
                options={[{ value: "", label: "All Scores" }, { value: "high", label: "High (≥65%)" }, { value: "medium", label: "Medium (40–64%)" }, { value: "low", label: "Low (<40%)" }]}
                placeholder="All Scores" buttonClassName="!py-2.5 !text-xs" />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : attempts.length === 0 ? (
          <EmptyState icon={IconClock} title="No attempts yet" desc="Start a test to see your results and analysis here." />
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => {
              const attId = String(a._id || a.id);
              const score = Number(a.score ?? 0);
              const maxScore = Number(a.totalMarks ?? a.maxScore ?? (a.exam as Record<string, unknown>)?.totalMarks ?? 720);
              const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
              const date = a.submittedAt || a.createdAt ? new Date(String(a.submittedAt || a.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";
              const title = String((a.exam as Record<string, unknown>)?.title || "NEET Test");
              const attemptNumber = Number(a.attemptNumber ?? 1);
              const tone = pct >= 65 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-rose-600";
              return (
                <button key={attId} onClick={() => onViewAttempt(attId)}
                  className="w-full dash-inset dash-clickable p-3.5 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">{title}</h4>
                      {attemptNumber > 1 && <span className="text-[9px] font-black px-1 rounded bg-violet-50 text-violet-700">A{attemptNumber}</span>}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      {date} · <span className={`font-black ${tone}`}>{score}</span>/{maxScore} · {pct.toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge2 pct={pct} />
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-indigo-600">Analysis <IconChevronRight className="w-3.5 h-3.5" /></span>
                  </div>
                </button>
              );
            })}
            {pagination && pagination.totalPages > 1 && (
              <PaginationControls currentPage={page} totalPages={pagination.totalPages} totalItems={pagination.total} onPageChange={setPage} />
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
