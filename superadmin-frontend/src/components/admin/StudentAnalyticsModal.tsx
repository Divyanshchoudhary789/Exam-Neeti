"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CommonModal, Spinner,
  IconChart, IconBook, IconClock, IconTarget, IconTrendingUp, IconLayers,
  IconAlertTriangle, IconGraduationCap, IconCalendar, IconDownload,
} from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { RadialMeter, AreaLineChart, DonutChart, HBarChart } from "../common/Charts";
import { adminService, UserProfile } from "../../services/apiServices";

/* ── Shape of GET /dashboard/student/:id/profile ─────────────────────────── */

interface ProfileSummary {
  totalTests: number;
  totalAttempts: number;
  totalScore: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averagePercentage: number;
  averageAccuracy: number;
  averageAttemptRate: number;
  totalNegativeMarks: number;
  totalRecoverableMarks: number;
  consistency: { scoreStdDev: number; accuracyStdDev: number; interpretation: string };
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
}
interface SprintRollup {
  sprintId: string;
  name: string;
  sprintNumber: number | null;
  tests: number;
  averageScore: number;
  averagePercentage: number;
  averageAccuracy: number;
  totalNegativeMarks: number;
  totalRecoverableMarks: number;
  lastAttemptAt: string | null;
}
interface SubjectRow {
  subject: string;
  totalQuestions: number; attempted: number; correct: number; incorrect: number;
  marksObtained: number; negativeMarks: number; accuracy: number; attemptRate: number;
}
interface ChapterRow {
  subject: string; chapter: string;
  totalQuestions: number; attempted: number; correct: number; incorrect: number;
  accuracy: number; attemptRate: number;
}
interface TopicRow {
  subject: string; chapter: string; topic: string;
  totalQuestions: number; attempted: number; correct: number;
  accuracy: number; attemptRate: number;
}
interface DifficultyRow {
  difficulty: string;
  totalQuestions: number; attempted: number; correct: number; incorrect: number;
  unattempted: number; accuracy: number; attemptRate: number; avgTimeSeconds: number;
}
interface TimelineRow {
  attemptId: string | null;
  examId: string | null;
  examTitle: string;
  examNumber: number | null;
  sprintId: string;
  sprintName: string;
  attemptNumber: number;
  attemptedAt: string;
  score: number;
  totalMarks: number;
  percentage: number;
  accuracy: number;
  attemptRate: number;
  negativeMarks: number;
  recoverableMarks: number;
  improvementFromPrev: number;
}
interface StudentProfile {
  student: { _id: string; name: string; email: string; batch?: { name?: string } | null; createdAt?: string; isActive?: boolean; programType?: string };
  scope: string;
  summary: ProfileSummary | null;
  sprints: SprintRollup[];
  subjectPerformance: SubjectRow[];
  chapterPerformance: ChapterRow[];
  topicPerformance: { weak: TopicRow[]; strong: TopicRow[] };
  difficultyPerformance: DifficultyRow[];
  errorAnalysis: { silly: number; concept: number; guess: number; total: number };
  coverage: {
    syllabusCoverage?: number; conceptCoverage?: number;
    weightedCoverage?: number; revisionCoverage?: number;
    coveredTopics?: number; totalTopics?: number; coveredChapters?: number;
  } | null;
  timeline: TimelineRow[];
}

interface StudentAnalyticsModalProps {
  isOpen: boolean;
  student: (UserProfile & { studentId?: string; studentName?: string; studentEmail?: string; batchName?: string; rank?: number; totalScore?: number }) | null;
  /** Kept for call-site compatibility — the modal defaults to the full
   *  cross-sprint view and offers its own scope selector. */
  sprintId?: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const TABS = [
  { id: "overview", label: "Overview", icon: IconChart },
  { id: "subjects", label: "Subjects", icon: IconBook },
  { id: "topics", label: "Chapters & Topics", icon: IconLayers },
  { id: "attempts", label: "Attempts", icon: IconClock },
  { id: "sprints", label: "Sprints", icon: IconTarget },
] as const;
type TabId = typeof TABS[number]["id"];

const SUBJECT_COLOR: Record<string, string> = {
  physics: "#6366f1",
  chemistry: "#10b981",
  biology: "#f59e0b",
  botany: "#22c55e",
  zoology: "#14b8a6",
  mathematics: "#8b5cf6",
};
const subjColor = (s: string) => SUBJECT_COLOR[s?.toLowerCase?.()] || "#64748b";

const CONSISTENCY_LABEL: Record<string, { text: string; cls: string }> = {
  very_consistent:  { text: "Very consistent",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  consistent:       { text: "Consistent",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  variable:         { text: "Variable",         cls: "bg-amber-50 text-amber-700 border-amber-200" },
  highly_variable:  { text: "Highly variable",  cls: "bg-rose-50 text-rose-700 border-rose-200" },
  insufficient_data:{ text: "Not enough tests", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

/* ── Small presentational helpers ───────────────────────────────────────── */

const ACCENT_TEXT: Record<string, string> = {
  slate: "text-slate-900",
  indigo: "text-indigo-600",
  violet: "text-violet-600",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  amber: "text-amber-600",
};

function KpiCard({ label, value, sub, accent = "indigo" }: { label: string; value: React.ReactNode; sub?: string; accent?: keyof typeof ACCENT_TEXT }) {
  return (
    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <h4 className={`text-xl sm:text-2xl font-black mt-1 ${ACCENT_TEXT[accent] || ACCENT_TEXT.indigo}`}>{value}</h4>
      {sub && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, right }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
          <span>{title}</span>
        </h4>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
      <p className="text-xs text-slate-500 font-semibold">{text}</p>
    </div>
  );
}

function AccuracyBar({ value, color = "#6366f1" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function StudentAnalyticsModal({ isOpen, student, onClose, showToast }: StudentAnalyticsModalProps) {
  const studentId = student?._id || student?.studentId || "";
  const fallbackName = student?.name || student?.studentName || "Student";
  const fallbackEmail = student?.email || student?.studentEmail || "";
  const fallbackBatch = student?.batchName || (student?.batch as { name?: string })?.name || "";

  const [scope, setScope] = useState("all");
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  // The sprint list for the scope selector — captured from the first (all-scope)
  // load and kept, since a scoped response only carries its own sprint.
  const [sprintChoices, setSprintChoices] = useState<{ value: string; label: string }[]>([]);

  const fetchProfile = useCallback(async (scopeVal: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await adminService.getStudentPerformanceProfile(studentId, scopeVal === "all" ? undefined : scopeVal);
      const data: StudentProfile = res?.data || res;
      setProfile(data);
      if (scopeVal === "all" && Array.isArray(data?.sprints)) {
        setSprintChoices([
          { value: "all", label: "All Sprints — Overall" },
          ...data.sprints.map((s) => ({ value: s.sprintId, label: `${s.name} (${s.tests} test${s.tests === 1 ? "" : "s"})` })),
        ]);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string })?.message || "Failed to load student analytics";
      showToast(msg, "error");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, showToast]);

  useEffect(() => {
    if (isOpen && studentId) {
      setScope("all");
      setTab("overview");
      fetchProfile("all");
    }
    if (!isOpen) { setProfile(null); setSprintChoices([]); }
  }, [isOpen, studentId, fetchProfile]);

  const onScopeChange = (v: string) => { setScope(v); fetchProfile(v); };

  const handleDownload = async () => {
    if (!studentId || downloading) return;
    setDownloading(true);
    try {
      const { objectUrl, filename } = await adminService.downloadStudentPerformanceReport(
        studentId, scope === "all" ? undefined : scope
      );
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      showToast("Performance report downloaded.", "success");
    } catch (err: unknown) {
      const e = err as { response?: { data?: Blob | { message?: string } }; message?: string };
      let msg = e?.message || "Report download failed";
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try { msg = JSON.parse(await data.text())?.message || msg; } catch { /* keep msg */ }
      } else if (data && typeof data === "object" && "message" in data) {
        msg = (data as { message?: string }).message || msg;
      }
      showToast(msg, "error");
    } finally {
      setDownloading(false);
    }
  };

  const s = profile?.student;
  const name = s?.name || fallbackName;
  const email = s?.email || fallbackEmail;
  const batch = s?.batch?.name || fallbackBatch;
  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "ST";
  const summary = profile?.summary || null;

  const trendData = useMemo(() => {
    if (!profile?.timeline?.length) return [];
    return profile.timeline.map((t, i) => ({
      label: `T${i + 1}`,
      value: t.percentage,
      detail: `${t.examTitle}${t.sprintName ? ` · ${t.sprintName}` : ""} · ${fmtDate(t.attemptedAt)} · ${t.score}/${t.totalMarks}`,
    }));
  }, [profile]);

  const errorSegments = useMemo(() => {
    const e = profile?.errorAnalysis;
    if (!e || e.total === 0) return [];
    return [
      { label: "Silly mistakes", value: e.silly, color: "#f59e0b" },
      { label: "Concept errors", value: e.concept, color: "#ef4444" },
      { label: "Rushed guesses", value: e.guess, color: "#6366f1" },
    ].filter((x) => x.value > 0);
  }, [profile]);

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title="Student Performance Profile" maxWidth="max-w-5xl">
      <div className="space-y-4 text-slate-800">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/30 border border-white/20 flex items-center justify-center text-lg sm:text-xl font-black shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight truncate">{name}</h3>
                {Boolean(student?.rank) && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950">Rank #{student?.rank}</span>
                )}
                {s?.isActive === false && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/90 text-white">Inactive</span>
                )}
              </div>
              {Boolean(email) && <p className="text-xs text-indigo-200 font-medium truncate mt-0.5">{email}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-bold text-indigo-100">
                {Boolean(batch) && <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15">Batch: {batch}</span>}
                {s?.createdAt && (
                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 inline-flex items-center gap-1">
                    <IconCalendar className="w-3 h-3" /> Since {fmtDate(s.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 lg:w-72 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">Analytics scope</p>
              <button
                onClick={handleDownload}
                disabled={downloading || loading || !summary}
                title="Download performance report (PDF)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-[10px] font-bold hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? <Spinner className="w-3 h-3" /> : <IconDownload className="w-3 h-3" />}
                {downloading ? "Preparing…" : "Report"}
              </button>
            </div>
            <CustomSelect
              value={scope}
              onChange={onScopeChange}
              icon={IconTarget}
              options={sprintChoices.length ? sprintChoices : [{ value: "all", label: "All Sprints — Overall" }]}
              buttonClassName="!bg-white/10 !border-white/20 !text-white hover:!border-white/40"
            />
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading performance profile…</p>
          </div>
        ) : !summary ? (
          <EmptyBlock text={`No submitted exams${scope === "all" ? "" : " in this sprint"} for this student yet.`} />
        ) : (
          <>
            {/* ══ OVERVIEW ══ */}
            {tab === "overview" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <KpiCard label="Tests Taken" value={summary.totalTests} sub={`${summary.totalAttempts} attempts`} accent="slate" />
                  <KpiCard label="Avg Score" value={summary.averageScore} sub={`high ${summary.highestScore} · low ${summary.lowestScore}`} accent="indigo" />
                  <KpiCard label="Avg %" value={`${summary.averagePercentage}%`} sub="mean exam %" accent="violet" />
                  <KpiCard label="Avg Accuracy" value={`${summary.averageAccuracy}%`} sub={`attempt rate ${summary.averageAttemptRate}%`} accent="emerald" />
                  <KpiCard label="Negative Marks" value={`−${Math.abs(summary.totalNegativeMarks)}`} sub="lost to wrong answers" accent="rose" />
                  <KpiCard label="Recoverable" value={summary.totalRecoverableMarks} sub="marks within reach" accent="amber" />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Consistency</span>
                  <span className={`px-2.5 py-1 rounded-lg border ${CONSISTENCY_LABEL[summary.consistency.interpretation]?.cls || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                    {CONSISTENCY_LABEL[summary.consistency.interpretation]?.text || summary.consistency.interpretation}
                  </span>
                  <span className="text-slate-400">score σ {summary.consistency.scoreStdDev} · accuracy σ {summary.consistency.accuracyStdDev}%</span>
                  <span className="ml-auto text-slate-400">{fmtDate(summary.firstAttemptAt)} → {fmtDate(summary.lastAttemptAt)}</span>
                </div>

                {trendData.length >= 2 && (
                  <SectionCard title="Percentage Trend Across Attempts" icon={IconTrendingUp}>
                    <AreaLineChart color="#4f46e5" valueSuffix="%" height={150} yMax={100} data={trendData} />
                  </SectionCard>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SectionCard title="Error Analysis" icon={IconAlertTriangle}>
                    {errorSegments.length ? (
                      <div className="flex items-center gap-4">
                        <DonutChart size={130} strokeWidth={18} data={errorSegments}
                          centerLabel={`${profile?.errorAnalysis.total}`} centerSublabel="flagged" />
                        <div className="space-y-1.5 text-xs font-semibold">
                          {errorSegments.map((seg) => (
                            <div key={seg.label} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                              <span className="text-slate-600">{seg.label}</span>
                              <span className="ml-auto font-black text-slate-900">{seg.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyBlock text="No error-classification data computed yet." />
                    )}
                  </SectionCard>

                  <SectionCard title="Syllabus Coverage" icon={IconGraduationCap}>
                    {profile?.coverage ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { k: "syllabusCoverage", label: "Syllabus" },
                          { k: "conceptCoverage", label: "Concept" },
                          { k: "weightedCoverage", label: "Weighted" },
                          { k: "revisionCoverage", label: "Revision" },
                        ].map(({ k, label }) => (
                          <div key={k} className="flex flex-col items-center gap-1">
                            <RadialMeter value={Number((profile.coverage as Record<string, number>)?.[k] || 0)} size={58} strokeWidth={6} />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                          </div>
                        ))}
                        <p className="col-span-2 sm:col-span-4 text-[10px] text-slate-400 font-bold text-center">
                          {profile.coverage.coveredTopics ?? 0} / {profile.coverage.totalTopics ?? 0} topics touched · {profile.coverage.coveredChapters ?? 0} chapters
                        </p>
                      </div>
                    ) : (
                      <EmptyBlock text="No syllabus coverage recorded yet." />
                    )}
                  </SectionCard>
                </div>
              </div>
            )}

            {/* ══ SUBJECTS ══ */}
            {tab === "subjects" && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {!profile?.subjectPerformance?.length ? (
                  <EmptyBlock text="No subject-level data yet." />
                ) : (
                  profile.subjectPerformance.map((sub) => (
                    <div key={sub.subject} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-900 capitalize flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: subjColor(sub.subject) }} />
                          {sub.subject}
                        </span>
                        <span className="text-xs font-black" style={{ color: subjColor(sub.subject) }}>{sub.accuracy}% accuracy</span>
                      </div>
                      <AccuracyBar value={sub.accuracy} color={subjColor(sub.subject)} />
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                        {[
                          { l: "Questions", v: sub.totalQuestions },
                          { l: "Attempted", v: sub.attempted },
                          { l: "Correct", v: sub.correct },
                          { l: "Incorrect", v: sub.incorrect },
                          { l: "Marks", v: sub.marksObtained },
                          { l: "Negative", v: `−${Math.abs(sub.negativeMarks)}` },
                        ].map((x) => (
                          <div key={x.l} className="rounded-xl bg-slate-50 py-2">
                            <p className="text-sm font-black text-slate-900">{x.v}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{x.l}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">Attempt rate {sub.attemptRate}%</p>
                    </div>
                  ))
                )}
                {Boolean(profile?.difficultyPerformance?.length) && (
                  <SectionCard title="Accuracy by Difficulty" icon={IconTarget}>
                    <HBarChart
                      valueSuffix="%"
                      data={profile!.difficultyPerformance.map((d) => ({
                        label: `${d.difficulty} (${d.attempted}/${d.totalQuestions})`,
                        value: d.accuracy,
                        detail: `attempt rate ${d.attemptRate}% · avg ${d.avgTimeSeconds}s`,
                        color: d.accuracy >= 70 ? "#10b981" : d.accuracy >= 45 ? "#f59e0b" : "#ef4444",
                      }))}
                    />
                  </SectionCard>
                )}
              </div>
            )}

            {/* ══ CHAPTERS & TOPICS ══ */}
            {tab === "topics" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SectionCard title={`Weak Topics (${profile?.topicPerformance.weak.length || 0})`} icon={IconAlertTriangle}>
                    {profile?.topicPerformance.weak.length ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {profile.topicPerformance.weak.map((t, i) => (
                          <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 truncate">{t.topic}</span>
                              <span className="text-xs font-black text-rose-600 shrink-0">{t.accuracy}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold capitalize truncate">{t.subject} · {t.chapter} · {t.correct}/{t.attempted} correct</p>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyBlock text="No weak topics — nicely done." />}
                  </SectionCard>
                  <SectionCard title={`Strong Topics (${profile?.topicPerformance.strong.length || 0})`} icon={IconTrendingUp}>
                    {profile?.topicPerformance.strong.length ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {profile.topicPerformance.strong.map((t, i) => (
                          <div key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 truncate">{t.topic}</span>
                              <span className="text-xs font-black text-emerald-600 shrink-0">{t.accuracy}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold capitalize truncate">{t.subject} · {t.chapter} · {t.correct}/{t.attempted} correct</p>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyBlock text="No topic has crossed the strong threshold yet." />}
                  </SectionCard>
                </div>

                <SectionCard title="Chapter Breakdown" icon={IconLayers}>
                  {profile?.chapterPerformance?.length ? (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs min-w-[520px]">
                        <thead>
                          <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 text-left">
                            <th className="py-2 px-1">Chapter</th>
                            <th className="py-2 px-1">Subject</th>
                            <th className="py-2 px-1 text-right">Q</th>
                            <th className="py-2 px-1 text-right">Attempt %</th>
                            <th className="py-2 px-1 w-40">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profile.chapterPerformance.map((c, i) => (
                            <tr key={i}>
                              <td className="py-2 px-1 font-bold text-slate-800">{c.chapter}</td>
                              <td className="py-2 px-1 text-slate-500 capitalize">{c.subject}</td>
                              <td className="py-2 px-1 text-right font-semibold text-slate-600">{c.totalQuestions}</td>
                              <td className="py-2 px-1 text-right font-semibold text-slate-600">{c.attemptRate}%</td>
                              <td className="py-2 px-1">
                                <div className="flex items-center gap-2">
                                  <AccuracyBar value={c.accuracy} color={c.accuracy >= 70 ? "#10b981" : c.accuracy >= 40 ? "#f59e0b" : "#ef4444"} />
                                  <span className="font-black text-slate-700 w-9 text-right">{c.accuracy}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyBlock text="No chapter data yet." />}
                </SectionCard>
              </div>
            )}

            {/* ══ ATTEMPTS ══ */}
            {tab === "attempts" && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                {!profile?.timeline?.length ? (
                  <EmptyBlock text="No exam attempts recorded." />
                ) : (
                  [...profile.timeline].reverse().map((t, i) => {
                    const neg = t.negativeMarks > 0;
                    const imp = t.improvementFromPrev;
                    return (
                      <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{t.examTitle}</p>
                            {t.attemptNumber > 1 && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">Attempt {t.attemptNumber}</span>}
                            {Boolean(t.sprintName) && <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">{t.sprintName}</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{fmtDateTime(t.attemptedAt)}</p>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
                          <Metric label="Score" value={`${t.score}/${t.totalMarks}`} />
                          <Metric label="%" value={`${t.percentage}%`} />
                          <Metric label="Accuracy" value={`${t.accuracy}%`} />
                          <Metric label="Negative" value={`−${Math.abs(t.negativeMarks)}`} tone={neg ? "rose" : "slate"} />
                          {imp !== 0 && (
                            <Metric label="vs prev" value={`${imp > 0 ? "+" : ""}${imp}`} tone={imp > 0 ? "emerald" : "rose"} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ══ SPRINTS ══ */}
            {tab === "sprints" && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                {!profile?.sprints?.length ? (
                  <EmptyBlock text="This student has no analytics in any sprint yet." />
                ) : (
                  profile.sprints.map((sp) => (
                    <button
                      key={sp.sprintId}
                      onClick={() => scope !== sp.sprintId && onScopeChange(sp.sprintId)}
                      className={`w-full text-left bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
                        scope === sp.sprintId ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200/80 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-900 truncate">{sp.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{sp.tests} test{sp.tests === 1 ? "" : "s"} · last {fmtDate(sp.lastAttemptAt)}</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3 text-center">
                        <Metric label="Avg Score" value={sp.averageScore} />
                        <Metric label="Avg %" value={`${sp.averagePercentage}%`} />
                        <Metric label="Accuracy" value={`${sp.averageAccuracy}%`} />
                        <Metric label="Negative" value={`−${Math.abs(sp.totalNegativeMarks)}`} tone="rose" />
                        <Metric label="Recoverable" value={sp.totalRecoverableMarks} tone="amber" />
                      </div>
                      <p className="text-[10px] font-bold text-indigo-500 mt-2">{scope === sp.sprintId ? "Currently viewing this sprint" : "Click to drill into this sprint →"}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </CommonModal>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: React.ReactNode; tone?: "slate" | "rose" | "emerald" | "amber" }) {
  const toneCls =
    tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div>
      <p className={`text-sm font-black ${toneCls}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
