"use client";

import React, { useEffect, useState } from "react";
import { studentService, type PlanAccess } from "../../../services/apiServices";
import {
  IconSearch, IconBook, IconLock, IconRocket, CardSkeleton, PaginationControls, CustomSelectMenu,
} from "../../common/UIComponents";
import { SectionCard, FilterPills, EmptyState } from "../../common/DashboardUI";
import type { ExamStartMeta } from "./types";

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "major", label: "Major" },
  { value: "semi-major", label: "Semi-Major" },
  { value: "minor", label: "Minor" },
  { value: "full", label: "Full Syllabus" },
] as const;

export function TestsSection({
  sprintId,
  sprintName,
  onStartExam,
  onViewAttempt,
  onUpgrade,
}: {
  sprintId: string;
  sprintName: string;
  onStartExam: (id: string, title: string, dur: number, meta?: ExamStartMeta) => void;
  onViewAttempt: (id: string) => void;
  onUpgrade: () => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("all");
  const [attemptStatus, setAttemptStatus] = useState("");
  const [exams, setExams] = useState<Record<string, unknown>[]>([]);
  const [access, setAccess] = useState<PlanAccess | null>(null);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [dSearch, category, attemptStatus, sprintId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentService.getMyExams({
      page, limit: 8,
      sprintId: sprintId || undefined,
      search: dSearch || undefined,
      category: category === "all" ? undefined : category,
      attemptStatus: (attemptStatus || undefined) as "not_attempted" | "in_progress" | "completed" | undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data?.exams || res?.exams || [];
        setExams(Array.isArray(raw) ? raw : []);
        setAccess((res?.data?.access as PlanAccess) || null);
        setPagination(res?.pagination || null);
      })
      .catch(() => { if (!cancelled) { setExams([]); setPagination(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, dSearch, category, attemptStatus, sprintId]);

  return (
    <div className="space-y-4 animate-dash-in">
      <SectionCard
        title="My Tests"
        subtitle={sprintName}
        icon={IconBook}
        bodyClassName="space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests…"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <div className="sm:w-48">
            <CustomSelectMenu
              value={attemptStatus}
              onChange={setAttemptStatus}
              placeholder="All Statuses"
              options={[
                { value: "", label: "All Statuses" },
                { value: "not_attempted", label: "Not Attempted" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
              ]}
              buttonClassName="!py-2.5 !text-xs"
            />
          </div>
        </div>
        <FilterPills value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
      </SectionCard>

      {access?.capped && (
        <div className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          access.atLimit ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-indigo-50 border-indigo-200 text-indigo-900"
        }`}>
          <p className="text-xs font-black leading-snug">
            {access.plan?.name || "Free Trial"} — {access.remaining ?? 0} of {access.testsIncluded} test{access.testsIncluded === 1 ? "" : "s"} remaining
            {access.atLimit && " · unlock the full test series with a plan"}
          </p>
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-900 border border-slate-200 px-3.5 py-2 text-[11px] font-bold shadow-sm hover:bg-slate-50 cursor-pointer shrink-0"
          >
            <IconRocket className="w-3.5 h-3.5" /> {access.atLimit ? "Upgrade now" : "See plans"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : exams.length === 0 ? (
        <SectionCard><EmptyState icon={IconBook} title="No tests found" desc="No tests match your filters, or none are scheduled for this sprint yet." /></SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exams.map((e) => <ExamCard key={String(e._id || e.id)} exam={e} onStartExam={onStartExam} onViewAttempt={onViewAttempt} onUpgrade={onUpgrade} />)}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <PaginationControls currentPage={page} totalPages={pagination.totalPages} totalItems={pagination.total} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function ExamCard({
  exam,
  onStartExam,
  onViewAttempt,
  onUpgrade,
}: {
  exam: Record<string, unknown>;
  onStartExam: (id: string, title: string, dur: number, meta?: ExamStartMeta) => void;
  onViewAttempt: (id: string) => void;
  onUpgrade: () => void;
}) {
  const id = String(exam._id || exam.id);
  const title = String(exam.title || "NEET Test");
  const dur = Number(exam.durationMinutes || 180);
  const totalQ = Number(exam.totalQuestions || (Array.isArray(exam.questions) ? (exam.questions as unknown[]).length : 0) || 0);
  const draft = String(exam.status || "published").toLowerCase() === "draft";
  const locked = Boolean(exam.locked);
  const att = exam.attempt as Record<string, unknown> | null | undefined;
  const inProg = att ? String(att.status || "").toLowerCase() === "in_progress" : false;
  const attemptCount = Number(exam.attemptCount ?? 0);
  const attemptsRemaining = Number(exam.attemptsRemaining ?? (attemptCount > 0 ? 0 : 2));
  const canReattempt = Boolean(exam.canReattempt);
  const best = exam.bestScore as Record<string, unknown> | null | undefined;
  const score = best?.score != null ? Number(best.score) : null;
  const tMarks = Number(best?.totalMarks ?? exam?.totalMarks ?? 720);
  const pct = best?.percentage != null ? `${Number(best.percentage).toFixed(0)}%` : null;

  const start = () => onStartExam(id, title, dur, {
    totalQuestions: totalQ || undefined,
    totalMarks: Number(exam.totalMarks) || undefined,
    instructions: typeof exam.instructions === "string" ? exam.instructions : undefined,
  });
  const revisit = () => { const a = String(best?._id || att?._id || ""); if (a) onViewAttempt(a); };

  return (
    <div className={`dash-card p-4 flex flex-col gap-3 ${locked ? "opacity-95" : ""}`}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="text-sm font-black text-slate-900 leading-tight">{title}</h4>
          {locked && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black"><IconLock className="w-2.5 h-2.5" />Locked</span>}
          {inProg && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">In Progress</span>}
          {draft && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Coming Soon</span>}
          {attemptCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">{attemptCount}/{attemptCount + attemptsRemaining} attempts</span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 font-semibold">{dur} min{totalQ > 0 ? ` · ${totalQ} questions` : ""}</p>
        {attemptCount > 0 && score != null && (
          <p className="text-[11px] font-bold">Best: <span className="text-emerald-600 font-black">{score}</span><span className="text-slate-400">/{tMarks}</span>{pct && <span className="text-slate-400 ml-1">({pct})</span>}</p>
        )}
      </div>

      {locked ? (
        <button onClick={onUpgrade} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5">
          <IconLock className="w-3.5 h-3.5" /> Upgrade to unlock
        </button>
      ) : draft ? (
        <button disabled className="w-full py-2.5 opacity-50 cursor-not-allowed bg-slate-200 text-slate-500 text-xs font-bold rounded-xl">Coming Soon</button>
      ) : inProg ? (
        <button onClick={start} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">Resume</button>
      ) : attemptCount === 0 ? (
        <button onClick={start} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">Start Test</button>
      ) : canReattempt ? (
        <div className="flex gap-2">
          <button onClick={revisit} className="flex-1 py-2.5 border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-xl cursor-pointer">Revisit</button>
          <button onClick={start} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">Reattempt</button>
        </div>
      ) : (
        <button onClick={revisit} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">View Results</button>
      )}
    </div>
  );
}
