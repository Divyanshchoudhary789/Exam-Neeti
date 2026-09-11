"use client";

import React, { useEffect, useMemo, useState } from "react";
import { studentService, type PlanAccess } from "../../../services/apiServices";
import {
  IconSearch, IconBook, IconLock, IconRocket, IconRefresh, IconClock, IconFileText,
  IconChevronRight, IconArrowRight, CardSkeleton, PaginationControls, CustomSelectMenu,
} from "../../common/UIComponents";
import { SectionCard, EmptyState } from "../../common/DashboardUI";
import type { ExamStartMeta } from "./types";

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

const CATEGORIES = [
  { value: "all", label: "All Tests" },
  { value: "major", label: "Major" },
  { value: "semi-major", label: "Semi-Major" },
  { value: "minor", label: "Minor" },
  { value: "done", label: "Completed" },
] as const;
type CategoryValue = (typeof CATEGORIES)[number]["value"];

const PER_PAGE = 8;

const inferCategory = (title: string): "major" | "semi-major" | "minor" | "full" | null => {
  const t = title.toLowerCase();
  if (/full[\s-]?syllabus|grand test|full test/.test(t)) return "full";
  if (/semi[\s-]?major/.test(t)) return "semi-major";
  if (/\bmajor\b/.test(t)) return "major";
  if (/\bminor\b/.test(t)) return "minor";
  return null;
};

type Att = { status?: string; _id?: string };
const sprintOf = (e: Record<string, unknown>) => {
  const sp = e.sprint as Record<string, unknown> | string | undefined;
  if (!sp) return { id: "", name: "", active: false };
  if (typeof sp === "string") return { id: sp, name: "", active: false };
  return { id: String(sp._id || sp.id || ""), name: String(sp.name || "Sprint"), active: String(sp.status || "").toLowerCase() === "active" };
};
export function TestsSection({
  onStartExam,
  onViewAttempt,
  onUpgrade,
}: {
  onStartExam: (id: string, title: string, dur: number, meta?: ExamStartMeta) => void;
  onViewAttempt: (id: string) => void;
  onUpgrade: () => void;
}) {
  const [allExams, setAllExams] = useState<Record<string, unknown>[]>([]);
  const [access, setAccess] = useState<PlanAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const [sprintFilter, setSprintFilter] = useState("all");
  const [category, setCategory] = useState<CategoryValue>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    studentService.getMyExams({ page: 1, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data?.exams || res?.exams || [];
        setAllExams(Array.isArray(raw) ? raw : []);
        setAccess((res?.data?.access as PlanAccess) || null);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) { setAllExams([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadTick]);

  const reload = () => { setLoading(true); setReloadTick((t) => t + 1); };

  const sprintOptions = useMemo(() => {
    const m = new Map<string, { value: string; label: string; active: boolean }>();
    for (const e of allExams) {
      const s = sprintOf(e);
      if (!s.id || m.has(s.id)) continue;
      m.set(s.id, { value: s.id, label: s.name || "Sprint", active: s.active });
    }
    const rows = [...m.values()].sort((a, b) => (a.active === b.active ? a.label.localeCompare(b.label) : a.active ? -1 : 1));
    return [
      { value: "all", label: "All sprints" },
      ...rows.map((r) => ({ value: r.value, label: r.label, sublabel: r.active ? "Active" : "Past" })),
    ];
  }, [allExams]);

  const counts = useMemo(() => {
    const c: Record<CategoryValue, number> = { all: allExams.length, major: 0, "semi-major": 0, minor: 0, done: 0 };
    for (const e of allExams) {
      const cat = inferCategory(String(e.title || ""));
      if (cat === "major") c.major++;
      else if (cat === "semi-major") c["semi-major"]++;
      else if (cat === "minor") c.minor++;
      if (Number(e.attemptCount ?? 0) > 0) c.done++;
    }
    return c;
  }, [allExams]);

  const filtered = useMemo(() => {
    let list = allExams.slice();
    if (sprintFilter !== "all") list = list.filter((e) => sprintOf(e).id === sprintFilter);
    if (category === "done") list = list.filter((e) => Number(e.attemptCount ?? 0) > 0);
    else if (category !== "all") list = list.filter((e) => inferCategory(String(e.title || "")) === category);
    if (dSearch.trim()) {
      const q = dSearch.trim().toLowerCase();
      list = list.filter((e) => String(e.title || "").toLowerCase().includes(q) || sprintOf(e).name.toLowerCase().includes(q));
    }

    const rank = (e: Record<string, unknown>) => {
      const st = String((e.attempt as Att | null)?.status || "").toLowerCase();
      if (st === "in_progress") return 0;
      if (e.locked) return 4;
      if (Number(e.attemptCount ?? 0) === 0) return 1;
      if (e.canReattempt) return 2;
      return 3;
    };
    list.sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r) return r;
      const da = new Date(String(a.scheduledAt || a.createdAt || 0)).getTime();
      const db = new Date(String(b.scheduledAt || b.createdAt || 0)).getTime();
      if (da !== db) return db - da;
      return Number(a.examNumber ?? 0) - Number(b.examNumber ?? 0);
    });
    return list;
  }, [allExams, sprintFilter, category, dSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageExams = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const pick = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <div className="space-y-4 animate-dash-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">All Tests</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Choose a test to evaluate your preparation and improve.</p>
        </div>
        <button onClick={reload} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer self-start" aria-label="Refresh" title="Refresh">
          <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-slate-200">
        {CATEGORIES.map((t) => (
          <button key={t.value} data-active={category === t.value} onClick={() => pick(setCategory)(t.value)}
            className={`dash-navitem inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              category === t.value ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"
            }`}>
            {t.label}
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${category === t.value ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"}`}>{counts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search tests…"
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10" />
        </div>
        {sprintOptions.length > 2 && (
          <div className="sm:w-52">
            <CustomSelectMenu value={sprintFilter} onChange={pick(setSprintFilter)} placeholder="All sprints" options={sprintOptions} buttonClassName="!py-2.5 !text-xs" />
          </div>
        )}
      </div>

      {access?.capped && (
        <div className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          access.atLimit ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-indigo-50 border-indigo-200 text-indigo-900"
        }`}>
          <p className="text-xs font-black leading-snug">
            {access.plan?.name || "Free Trial"} — {access.remaining ?? 0} of {access.testsIncluded} test{access.testsIncluded === 1 ? "" : "s"} remaining
            {access.atLimit && " · unlock the full test series with a plan"}
          </p>
          <button onClick={onUpgrade} className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-900 border border-slate-200 px-3.5 py-2 text-[11px] font-bold shadow-sm hover:bg-slate-50 cursor-pointer shrink-0">
            <IconRocket className="w-3.5 h-3.5" /> {access.atLimit ? "Upgrade now" : "See plans"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : failed ? (
        <SectionCard><EmptyState icon={IconBook} title="Couldn't load your tests" desc="Please check your connection and try again."
          action={<button onClick={reload} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Retry</button>} /></SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard><EmptyState icon={IconBook}
          title={allExams.length === 0 ? "No tests assigned yet" : "Nothing matches these filters"}
          desc={allExams.length === 0 ? "Your coaching hasn't scheduled any tests for your batch yet. New tests appear here automatically." : "Try a different sprint, category or search term."} /></SectionCard>
      ) : (
        <>
          <div className="space-y-2.5">
            {pageExams.map((e) => <ExamRow key={String(e._id || e.id)} exam={e} onStartExam={onStartExam} onViewAttempt={onViewAttempt} onUpgrade={onUpgrade} />)}
          </div>
          {totalPages > 1 && <PaginationControls currentPage={safePage} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}

function ExamRow({
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
  const totalMarks = Number(exam.totalMarks || 0);
  const draft = String(exam.status || "published").toLowerCase() === "draft";
  const locked = Boolean(exam.locked);
  const att = exam.attempt as Record<string, unknown> | null | undefined;
  const inProg = att ? String(att.status || "").toLowerCase() === "in_progress" : false;
  const attemptCount = Number(exam.attemptCount ?? 0);
  const attemptsRemaining = Number(exam.attemptsRemaining ?? (attemptCount > 0 ? 0 : 2));
  const maxAttempts = attemptCount + attemptsRemaining;
  const canReattempt = Boolean(exam.canReattempt);
  const best = exam.bestScore as Record<string, unknown> | null | undefined;
  const score = best?.score != null ? Number(best.score) : null;
  const tMarks = Number(best?.totalMarks ?? totalMarks ?? 720);
  const scoreTone = score == null ? "" : (score / tMarks) >= 0.65 ? "text-emerald-600" : (score / tMarks) >= 0.4 ? "text-amber-600" : "text-rose-600";

  const start = () => onStartExam(id, title, dur, {
    totalQuestions: totalQ || undefined,
    totalMarks: totalMarks || undefined,
    instructions: typeof exam.instructions === "string" ? exam.instructions : undefined,
  });
  const revisit = () => { const a = String(best?._id || att?._id || ""); if (a) onViewAttempt(a); };

  return (
    <div className="dash-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="min-w-0 lg:flex-1">
        <h4 className="text-base font-black text-slate-900 leading-snug">{title}</h4>
        <button
          onClick={attemptCount > 0 ? revisit : start}
          disabled={locked || draft}
          className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 cursor-pointer"
        >
          Know Your Challenge / Syllabus <IconChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-5 lg:gap-8 shrink-0">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-slate-600">
          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><IconFileText className="w-4 h-4" /></span>
          {totalQ > 0 ? `${totalQ} Questions` : "—"}
        </span>
        <span className="hidden sm:block w-px h-8 bg-slate-200" />
        <span className="inline-flex items-center gap-2 text-[12px] font-bold text-slate-600">
          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><IconClock className="w-4 h-4" /></span>
          {dur} Minutes
        </span>
      </div>

      <div className="shrink-0 lg:w-56 lg:text-right">
        {locked ? (
          <button onClick={onUpgrade} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 cursor-pointer">
            <IconLock className="w-3.5 h-3.5" /> Upgrade to unlock
          </button>
        ) : draft ? (
          <span className="text-xs font-bold text-slate-400">Coming soon</span>
        ) : inProg ? (
          <button onClick={start} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2.5 cursor-pointer">Resume Test <IconArrowRight className="w-3.5 h-3.5" /></button>
        ) : attemptCount === 0 ? (
          <div>
            <button onClick={start} className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-black cursor-pointer">Start Test <IconArrowRight className="w-4 h-4" /></button>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Not Attempted</p>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <button onClick={revisit} className="rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-bold px-3.5 py-2 cursor-pointer">Revisit</button>
              {canReattempt
                ? <button onClick={start} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 cursor-pointer">Reattempt <IconArrowRight className="w-3.5 h-3.5" /></button>
                : <span className="text-[10px] font-bold text-slate-400 px-2">{attemptCount}/{maxAttempts} attempts used</span>}
            </div>
            {score != null && <p className="text-[11px] font-bold text-slate-500">Score: <span className={`font-black ${scoreTone}`}>{score}</span> / {tMarks}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
