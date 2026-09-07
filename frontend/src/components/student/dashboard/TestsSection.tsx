"use client";

import React, { useEffect, useMemo, useState } from "react";
import { studentService, type PlanAccess } from "../../../services/apiServices";
import {
  IconSearch, IconBook, IconLock, IconRocket, IconRefresh, IconClock, IconCheck, IconChevronRight,
  CardSkeleton, PaginationControls, CustomSelectMenu,
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
type CategoryValue = (typeof CATEGORIES)[number]["value"];

const PER_PAGE = 9;

const inferCategory = (title: string): CategoryValue | null => {
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
const isTodo = (e: Record<string, unknown>) =>
  Number(e.attemptCount ?? 0) === 0 || String((e.attempt as Att | null)?.status || "").toLowerCase() === "in_progress";

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
  const [tab, setTab] = useState<"all" | "todo" | "done">("all");
  const [page, setPage] = useState(1);

  // A changed filter always resets to page 1 — done in the setters (event
  // handlers) so there's no cascading state-in-effect. `safePage` (below) also
  // clamps if the active page falls past the end of a newly-filtered list.
  const pick = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  useEffect(() => {
    let cancelled = false;
    // One broad fetch — a student's whole assigned test set is small, so we
    // filter / paginate on the client. This keeps every test (old and new,
    // across every sprint) reachable without depending on the header's
    // selected sprint.
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

  const counts = useMemo(() => ({
    all: allExams.length,
    todo: allExams.filter(isTodo).length,
    done: allExams.filter((e) => Number(e.attemptCount ?? 0) > 0).length,
  }), [allExams]);

  const filtered = useMemo(() => {
    let list = allExams.slice();
    if (sprintFilter !== "all") list = list.filter((e) => sprintOf(e).id === sprintFilter);
    if (category !== "all") list = list.filter((e) => inferCategory(String(e.title || "")) === category);
    if (dSearch.trim()) {
      const q = dSearch.trim().toLowerCase();
      list = list.filter((e) => String(e.title || "").toLowerCase().includes(q) || sprintOf(e).name.toLowerCase().includes(q));
    }
    if (tab === "todo") list = list.filter(isTodo);
    if (tab === "done") list = list.filter((e) => Number(e.attemptCount ?? 0) > 0);

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
  }, [allExams, sprintFilter, category, dSearch, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageExams = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const TABS: { id: typeof tab; label: string; n: number }[] = [
    { id: "all", label: "All", n: counts.all },
    { id: "todo", label: "To-do", n: counts.todo },
    { id: "done", label: "Completed", n: counts.done },
  ];

  return (
    <div className="space-y-4 animate-dash-in">
      <SectionCard
        title="My Tests"
        subtitle="Every test your coaching has assigned — across all sprints"
        icon={IconBook}
        action={
          <button onClick={reload} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer" aria-label="Refresh tests" title="Refresh">
            <IconRefresh className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
        bodyClassName="space-y-3"
      >
        {/* status tabs */}
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              {t.label}
              <span className={`tabular-nums ${tab === t.id ? "text-indigo-200" : "text-slate-400"}`}>{t.n}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tests…"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          {sprintOptions.length > 2 && (
            <div className="sm:w-52">
              <CustomSelectMenu
                value={sprintFilter}
                onChange={pick(setSprintFilter)}
                placeholder="All sprints"
                options={sprintOptions}
                buttonClassName="!py-2.5 !text-xs"
              />
            </div>
          )}
        </div>
        <FilterPills value={category} onChange={pick(setCategory)} options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : failed ? (
        <SectionCard><EmptyState icon={IconBook} title="Couldn't load your tests" desc="Please check your connection and try again."
          action={<button onClick={reload} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Retry</button>} /></SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard><EmptyState icon={IconBook}
          title={allExams.length === 0 ? "No tests assigned yet" : "Nothing matches these filters"}
          desc={allExams.length === 0 ? "Your coaching hasn't scheduled any tests for your batch yet. New tests will appear here automatically." : "Try a different sprint, category or search term."} /></SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pageExams.map((e) => <ExamCard key={String(e._id || e.id)} exam={e} onStartExam={onStartExam} onViewAttempt={onViewAttempt} onUpgrade={onUpgrade} />)}
          </div>
          {totalPages > 1 && (
            <PaginationControls currentPage={safePage} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
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
  const pctNum = best?.percentage != null ? Number(best.percentage) : (score != null && tMarks > 0 ? (score / tMarks) * 100 : null);
  const sp = sprintOf(exam);
  const scheduled = exam.scheduledAt ? new Date(String(exam.scheduledAt)) : null;
  const cat = inferCategory(title);

  const state: "new" | "resume" | "reattempt" | "done" | "locked" | "soon" =
    locked ? "locked" : draft ? "soon" : inProg ? "resume" : attemptCount === 0 ? "new" : canReattempt ? "reattempt" : "done";
  const accent = {
    new: "#059669", resume: "#d97706", reattempt: "#4f46e5", done: "#94a3b8", locked: "#d97706", soon: "#cbd5e1",
  }[state];
  const scoreTone = pctNum == null ? "" : pctNum >= 65 ? "text-emerald-600" : pctNum >= 40 ? "text-amber-600" : "text-rose-600";

  const start = () => onStartExam(id, title, dur, {
    totalQuestions: totalQ || undefined,
    totalMarks: totalMarks || undefined,
    instructions: typeof exam.instructions === "string" ? exam.instructions : undefined,
  });
  const revisit = () => { const a = String(best?._id || att?._id || ""); if (a) onViewAttempt(a); };

  return (
    <div className="dash-card p-0 overflow-hidden flex flex-col">
      <span className="block h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="min-w-0 space-y-1.5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-black text-slate-900 leading-snug min-w-0">{title}</h4>
            {cat && <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-wide capitalize">{cat.replace("-", " ")}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {sp.name && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sp.active ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                {sp.name}
              </span>
            )}
            {inProg && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">In progress</span>}
            {locked && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black"><IconLock className="w-2.5 h-2.5" />Locked</span>}
            {draft && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Coming soon</span>}
            {attemptCount > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">{attemptCount}/{maxAttempts} attempts</span>}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-semibold pt-0.5">
            <span className="inline-flex items-center gap-1"><IconClock className="w-3 h-3" />{dur} min</span>
            {totalQ > 0 && <span>{totalQ} questions</span>}
            {totalMarks > 0 && <span>{totalMarks} marks</span>}
            {scheduled && <span>{scheduled.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>}
          </div>

          {attemptCount > 0 && score != null && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-slate-500">Best score</span>
                <span className={scoreTone}>{score}<span className="text-slate-400 font-semibold">/{tMarks}</span>{pctNum != null && <span className="text-slate-400 font-semibold ml-1">· {pctNum.toFixed(0)}%</span>}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pctNum ?? 0))}%`, backgroundColor: pctNum != null && pctNum >= 65 ? "#059669" : pctNum != null && pctNum >= 40 ? "#d97706" : "#e11d48" }} />
              </div>
            </div>
          )}
        </div>

        {locked ? (
          <button onClick={onUpgrade} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5">
            <IconLock className="w-3.5 h-3.5" /> Upgrade to unlock
          </button>
        ) : draft ? (
          <button disabled className="w-full py-2.5 opacity-50 cursor-not-allowed bg-slate-200 text-slate-500 text-xs font-bold rounded-xl">Coming soon</button>
        ) : inProg ? (
          <button onClick={start} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">Resume test</button>
        ) : attemptCount === 0 ? (
          <button onClick={start} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5">
            Start test <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : canReattempt ? (
          <div className="flex gap-2">
            <button onClick={revisit} className="flex-1 py-2.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer inline-flex items-center justify-center gap-1"><IconCheck className="w-3.5 h-3.5" />Result</button>
            <button onClick={start} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">Reattempt</button>
          </div>
        ) : (
          <button onClick={revisit} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5">
            View results <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
