"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MathRenderer } from "../common/MathRenderer";
import {
  IconChart, IconClock, IconCross,
  IconChevronLeft, IconChevronRight,
  IconCheck, IconEye, Spinner,
} from "../common/UIComponents";
import { studentService } from "../../services/apiServices";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CloudinaryImage {
  url?: string | null;
  publicId?: string | null;
}

interface OptionItem {
  key: string;
  text: string;
  image?: CloudinaryImage | null;
}

interface SolutionObj {
  text?: string;
  hasLatex?: boolean;
  image?: CloudinaryImage | null;
  images?: CloudinaryImage[];
}

interface QuestionData {
  _id?: string;
  id?: string;
  text?: string;
  hasLatex?: boolean;
  subject?: string;
  chapter?: string;
  topic?: string;
  questionImage?: CloudinaryImage | null;
  options?: OptionItem[];
  solution?: SolutionObj | null;
  correctAnswer?: string;         // may come from question bank (admin view)
}

interface ResponseItem {
  _id?: string;
  question?: string;              // ObjectId ref
  questionId?: string;
  slotPosition?: number;
  selectedAnswer?: string | null;
  correctAnswer?: string;         // stored on the attempt response after scoring
  isCorrect?: boolean;
  isAttempted?: boolean;
  marksAwarded?: number;
  timeSpentSeconds?: number;
  wasReattempted?: boolean;
  answerChanges?: number;
  confidence?: number;
  // populated
  questionData?: QuestionData;
  // flat fields from some API shapes
  text?: string;
  subject?: string;
  chapter?: string;
}

interface AttemptAnalyticsViewProps {
  attemptDetails?: Record<string, unknown> | null;
  attemptId?: string;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (secs: number) =>
  `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;

const imgUrl = (img?: CloudinaryImage | null): string | null =>
  img?.url || null;

// ─── Main component ───────────────────────────────────────────────────────────

export function AttemptAnalyticsView({
  attemptDetails: initialAttemptDetails,
  attemptId,
  onBack,
}: AttemptAnalyticsViewProps) {
  const [attemptDetails, setAttemptDetails] = useState<Record<string, unknown> | null>(
    initialAttemptDetails || null,
  );
  const [loading, setLoading]             = useState(!initialAttemptDetails && Boolean(attemptId));
  const [activeTab, setActiveTab]         = useState<"overview" | "responses">("overview");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialAttemptDetails) {
      setAttemptDetails(initialAttemptDetails);
      setLoading(false);
      return;
    }
    if (!attemptId) return;

    setLoading(true);
    Promise.allSettled([
      studentService.getAttemptWithQuestions(attemptId),
      studentService.getAttemptAnalytics(attemptId),
    ]).then(([withQRes, analyticsRes]) => {
      let attemptBase: Record<string, unknown> = {};
      if (withQRes.status === "fulfilled") {
        const val = withQRes.value;
        const att = val?.data?.attempt || val?.attempt || val?.data || val;
        if (att && typeof att === "object") attemptBase = att as Record<string, unknown>;
      }
      let analyticsBase: Record<string, unknown> = {};
      if (analyticsRes.status === "fulfilled") {
        const val   = analyticsRes.value;
        const analy = val?.data?.analytics || val?.analytics || val?.data || val;
        if (analy && typeof analy === "object") analyticsBase = analy as Record<string, unknown>;
      }
      const merged: Record<string, unknown> = {
        ...attemptBase,
        totalScore:            analyticsBase.score           ?? attemptBase.score,
        maxScore:              analyticsBase.totalMarks      ?? attemptBase.totalMarks ?? (attemptBase.exam as Record<string, unknown>)?.totalMarks ?? (analyticsBase.exam as Record<string, unknown>)?.totalMarks ?? 720,
        accuracy:              analyticsBase.overallAccuracy ?? attemptBase.accuracy,
        percentile:            analyticsBase.percentile      ?? attemptBase.percentile,
        totalTimeSpentSeconds: analyticsBase.totalTimeSeconds ?? attemptBase.totalTimeSeconds,
        strategyRho:           analyticsBase.strategyRho     ?? attemptBase.strategyRho,
        subjectBreakdown:      analyticsBase.subjectAccuracy ?? attemptBase.subjectBreakdown ?? [],
        basicAnalytics: {
          totalAttempted:   analyticsBase.totalAttempted   ?? "—",
          totalUnattempted: analyticsBase.totalUnattempted ?? "—",
          correctCount:     analyticsBase.totalCorrect     ?? "—",
          incorrectCount:   analyticsBase.totalIncorrect   ?? "—",
        },
        examTitle:
          (attemptBase.exam as Record<string, unknown>)?.title  ||
          (analyticsBase.exam as Record<string, unknown>)?.title ||
          attemptBase.examTitle,
      };
      setAttemptDetails(Object.keys(merged).length > 0 ? merged : null);
    })
    .catch(err => console.error("[AttemptAnalytics] fetch error:", err))
    .finally(() => setLoading(false));
  }, [initialAttemptDetails, attemptId]);

  // ── Modal keyboard nav ────────────────────────────────────────────────────
  const closeModal = useCallback(() => setSelectedIdx(null), []);
  const goPrev = useCallback(() =>
    setSelectedIdx(p => p !== null ? Math.max(0, p - 1) : null), []);
  const goNext = useCallback((len: number) =>
    setSelectedIdx(p => p !== null ? Math.min(len - 1, p + 1) : null), []);

  useEffect(() => {
    if (selectedIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "ArrowRight") goNext(enrichedResponses.length);
      if (e.key === "Escape")     closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, closeModal, goPrev, goNext]);

  // ── Loading / empty ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner className="w-8 h-8 text-indigo-600" />
      <p className="text-xs font-bold text-slate-500">Loading attempt analytics…</p>
    </div>
  );

  if (!attemptDetails) return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Attempt details not available.</p>
        <button
          onClick={onBack}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const examTitle    = String(attemptDetails.examTitle || attemptDetails.title || "Exam Analysis");
  const score        = Number(attemptDetails.totalScore ?? attemptDetails.score ?? 0);
  const maxScore     = Number(attemptDetails.maxScore ?? attemptDetails.totalMarks ?? (attemptDetails.exam as Record<string, unknown>)?.totalMarks ?? 720);
  const accuracy     = Number(attemptDetails.accuracy ?? 0).toFixed(1);
  const percentile   = Number(attemptDetails.percentile ?? 0).toFixed(1);
  const totalTimeSec = Number(attemptDetails.totalTimeSpentSeconds ?? 0);
  const orderRho     = Number(attemptDetails.strategyRho ?? 0).toFixed(2);

  const rawResponses = (attemptDetails.responses as ResponseItem[]) || [];
  const rawQuestions = (attemptDetails.questions  as QuestionData[]) || [];

  // Build a map from question _id → QuestionData for fast lookup
  const qDataMap: Record<string, QuestionData> = {};
  for (const q of rawQuestions) {
    const key = String(q._id || q.id || "");
    if (key) qDataMap[key] = q;
  }

  // Enrich each response with its question data
  const enrichedResponses: ResponseItem[] = rawResponses.map(r => {
    const qId = String(r.question || r.questionId || "");
    const matched = qId ? qDataMap[qId] : undefined;
    return {
      ...r,
      questionData: (r.questionData as QuestionData | undefined) || matched || {},
    } as ResponseItem;
  });

  const subjectBreakdown = (attemptDetails.subjectBreakdown as Record<string, unknown>[]) || [];
  const basicAnalytics   = attemptDetails.basicAnalytics as Record<string, unknown> | undefined;

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredResponses = enrichedResponses.filter(r => {
    const sub = String(r.questionData?.subject || r.subject || "").toLowerCase();
    if (subjectFilter !== "all" && sub !== subjectFilter.toLowerCase()) return false;
    if (statusFilter === "correct"     && !r.isCorrect)                           return false;
    if (statusFilter === "incorrect"   && (r.isCorrect || !r.selectedAnswer))     return false;
    if (statusFilter === "unattempted" && Boolean(r.selectedAnswer))              return false;
    return true;
  });

  const statusMeta = (r: ResponseItem) => {
    if (r.isCorrect)      return { label: "Correct",     cls: "bg-emerald-50 border-emerald-300 text-emerald-800" };
    if (r.selectedAnswer) return { label: "Incorrect",   cls: "bg-red-50 border-red-300 text-red-800" };
    return                       { label: "Unattempted", cls: "bg-slate-100 border-slate-200 text-slate-600" };
  };

  const SUBJECT_COLORS: Record<string, string> = {
    physics:   "bg-indigo-500",
    chemistry: "bg-violet-500",
    biology:   "bg-teal-500",
  };

  // ── Selected response for modal ───────────────────────────────────────────
  const selectedResp = selectedIdx !== null ? enrichedResponses[selectedIdx] : null;
  const qData        = selectedResp?.questionData as QuestionData | undefined;
  const solObj       = qData?.solution;
  const solText      = solObj?.text || "";
  const solImgUrl    = imgUrl(solObj?.image) || (solObj?.images?.[0] ? imgUrl(solObj.images[0]) : null);
  const qImgUrl      = imgUrl(qData?.questionImage);

  // correctAnswer comes either from the response (scored attempt) or question data (admin view)
  const correctAnswer = String(
    selectedResp?.correctAnswer || qData?.correctAnswer || ""
  ).toUpperCase();

  return (
    <div className="space-y-4 text-slate-800 font-sans pb-8">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-6 py-4 shadow-sm">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 mb-2 cursor-pointer transition-colors"
        >
          <IconChevronLeft className="w-3.5 h-3.5" />Back to Dashboard
        </button>
        <h1 className="text-base sm:text-xl font-black text-slate-900 leading-tight">{examTitle}</h1>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">Attempt Analysis &amp; Detailed Solutions</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Score */}
        <div className="col-span-1 p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-center shadow-lg flex flex-col justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-200">Score</p>
          <div className="my-1">
            <h2 className="text-2xl sm:text-3xl font-black tabular-nums leading-tight">{score}</h2>
            <p className="text-xs font-bold text-indigo-300 tabular-nums">/ {maxScore}</p>
          </div>
          {Number(percentile) > 0 ? (
            <p className="text-[10px] font-bold text-emerald-300 tabular-nums">{percentile}th %ile</p>
          ) : <div className="h-3" />}
        </div>

        {/* Accuracy */}
        <StatCard label="Accuracy" value={`${accuracy}%`} sub="Target: 80%" color="text-emerald-600" />

        {/* Time */}
        <StatCard
          label="Time Used"
          value={formatTime(totalTimeSec)}
          sub={`Avg ${enrichedResponses.length > 0 ? (totalTimeSec / enrichedResponses.length).toFixed(0) : 0}s/Q`}
          color="text-slate-900"
          valueSmall
        />

        {/* Order quality */}
        <StatCard label="Order Quality" value={orderRho} sub="Spearman ρ" color="text-indigo-600" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { id: "overview"  as const, label: "Performance Overview", icon: IconChart },
          { id: "responses" as const, label: `Solutions (${enrichedResponses.length} Qs)`, icon: IconEye },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === id
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />{label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

          {/* Subject performance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <IconChart className="w-4 h-4 text-indigo-600 shrink-0" />Subject Performance
            </h3>
            {subjectBreakdown.length > 0 ? (
              subjectBreakdown.map((s, i) => {
                const subj    = String(s.subject || `Subject ${i + 1}`);
                const marks   = Number(s.marksObtained ?? s.marks ?? 0);
                const acc     = Number(s.accuracy ?? 0).toFixed(0);
                const correct = Number(s.correct ?? 0);
                const wrong   = Number(s.incorrect ?? 0);
                const total   = Number(s.totalQuestions ?? 1);
                const pct     = Math.min(Math.round((marks / Math.max(total * 4, 1)) * 100), 100);
                const barCls  = SUBJECT_COLORS[subj.toLowerCase()] || "bg-indigo-500";
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-800">
                      <span className="capitalize">{subj}</span>
                      <div className="flex items-center gap-2 text-[10px] tabular-nums shrink-0">
                        <span className="text-emerald-600 font-black">{marks} pts</span>
                        <span className="text-slate-400">{acc}%</span>
                        <span className="text-slate-400">{correct}✓ {wrong}✗</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              ["Physics", "Chemistry", "Biology"].map(subj => (
                <div key={subj} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>{subj}</span><span className="text-[10px]">No data</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full" />
                </div>
              ))
            )}
          </div>

          {/* Attempt summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <IconClock className="w-4 h-4 text-amber-500 shrink-0" />Attempt Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { label: "Attempted",   value: String(basicAnalytics?.totalAttempted   ?? "—"), color: "text-indigo-600" },
                { label: "Unattempted", value: String(basicAnalytics?.totalUnattempted ?? "—"), color: "text-slate-500" },
                { label: "Correct",     value: String(basicAnalytics?.correctCount     ?? "—"), color: "text-emerald-600" },
                { label: "Incorrect",   value: String(basicAnalytics?.incorrectCount   ?? "—"), color: "text-red-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
                  <p className={`text-xl font-black mt-1 ${color} tabular-nums`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ SOLUTIONS TAB ════════════════════════════════════════════════ */}
      {activeTab === "responses" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Filter bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Subjects</option>
                <option value="physics">Physics</option>
                <option value="chemistry">Chemistry</option>
                <option value="biology">Biology</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="correct">Correct</option>
                <option value="incorrect">Incorrect</option>
                <option value="unattempted">Unattempted</option>
              </select>
            </div>
            <span className="text-[10px] font-extrabold text-slate-400 whitespace-nowrap shrink-0">
              {filteredResponses.length} / {enrichedResponses.length} shown
            </span>
          </div>

          {/* Response rows */}
          <div className="divide-y divide-slate-50">
            {filteredResponses.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400 font-medium">
                No questions match the selected filters.
              </p>
            ) : filteredResponses.map((resp, i) => {
              const globalIdx = enrichedResponses.indexOf(resp);
              const qd        = resp.questionData as QuestionData | undefined;
              const qText     = String(qd?.text || resp.text || "");
              const subject   = String(qd?.subject || resp.subject || "");
              const chapter   = String(qd?.chapter || resp.chapter || "");
              const yourAns   = String(resp.selectedAnswer || "—");
              const { label, cls } = statusMeta(resp);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedIdx(globalIdx)}
                  className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {/* Status badge */}
                    <span className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                      resp.isCorrect ? "bg-emerald-600 text-white"
                      : resp.selectedAnswer ? "bg-red-500 text-white"
                      : "bg-slate-200 text-slate-600"
                    }`}>
                      {globalIdx + 1}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
                        <MathRenderer
                          text={qText ? (qText.length > 120 ? qText.slice(0, 120) + "…" : qText) : "Question text"}
                          inline
                        />
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        {subject && <span className="uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{subject}</span>}
                        {chapter && <span className="text-slate-400">{chapter}</span>}
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${cls}`}>
                          {label}
                        </span>
                        <span className="text-slate-500">Ans: <b>{yourAns}</b></span>
                      </div>
                    </div>

                    {/* View button */}
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedIdx(globalIdx); }}
                      className="shrink-0 px-2.5 sm:px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Solution
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ SOLUTION MODAL ═══════════════════════════════════════════════ */}
      {selectedResp !== null && selectedIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Solution and analysis"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Panel — bottom sheet on mobile, centred on sm+ */}
          <div className="relative w-full sm:max-w-2xl h-[92dvh] sm:h-auto sm:max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-white shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`w-8 h-8 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 ${
                  selectedResp.isCorrect ? "bg-emerald-600"
                  : selectedResp.selectedAnswer ? "bg-red-500"
                  : "bg-slate-400"
                }`}>
                  {selectedIdx + 1}
                </span>
                <p className="text-xs sm:text-sm font-black text-slate-900 truncate">Solution &amp; Analysis</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={goPrev}
                  disabled={selectedIdx === 0}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
                  aria-label="Previous question"
                >
                  <IconChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-extrabold text-slate-400 px-1 tabular-nums whitespace-nowrap">
                  {selectedIdx + 1}/{enrichedResponses.length}
                </span>
                <button
                  onClick={() => goNext(enrichedResponses.length)}
                  disabled={selectedIdx === enrichedResponses.length - 1}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
                  aria-label="Next question"
                >
                  <IconChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500 flex items-center justify-center cursor-pointer transition-colors ml-1"
                  aria-label="Close"
                >
                  <IconCross className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 space-y-4">

              {/* Status + stats banner */}
              <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-2xl border text-xs font-bold ${statusMeta(selectedResp).cls}`}>
                <div className="flex items-center gap-2">
                  {selectedResp.isCorrect
                    ? <IconCheck className="w-4 h-4" />
                    : selectedResp.selectedAnswer
                      ? <IconCross className="w-4 h-4" />
                      : null
                  }
                  <span className="font-black uppercase text-sm">{statusMeta(selectedResp).label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  <span>Marks: <b>{Number(selectedResp.marksAwarded ?? 0)}</b></span>
                  <span>Time: <b>{Number(selectedResp.timeSpentSeconds ?? 0)}s</b></span>
                  {selectedResp.confidence != null && (
                    <span>Confidence: <b>{selectedResp.confidence}%</b></span>
                  )}
                </div>
              </div>

              {/* Question */}
              <section className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">Question</p>
                {qData?.text ? (
                  <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                    <MathRenderer text={qData.text} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Question text not available</p>
                )}
                {qImgUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                    <img
                      src={qImgUrl}
                      alt="Question diagram"
                      className="w-full max-h-56 sm:max-h-64 object-contain p-2"
                      loading="lazy"
                    />
                  </div>
                )}
              </section>

              {/* Options */}
              {qData?.options && qData.options.length > 0 && (
                <section className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Options</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {qData.options.map(opt => {
                      const yourAns       = String(selectedResp.selectedAnswer || "").toUpperCase();
                      const isCorrectOpt  = opt.key.toUpperCase() === correctAnswer;
                      const isWrongPick   = opt.key.toUpperCase() === yourAns && !isCorrectOpt;
                      const optCls        = isCorrectOpt
                        ? "bg-emerald-50 border-emerald-400 shadow-sm"
                        : isWrongPick
                          ? "bg-red-50 border-red-400"
                          : "bg-white border-slate-200";
                      const keyBg         = isCorrectOpt
                        ? "bg-emerald-600 text-white"
                        : isWrongPick
                          ? "bg-red-500 text-white"
                          : "bg-slate-100 text-slate-600";
                      const optImgUrl     = imgUrl(opt.image);

                      return (
                        <div key={opt.key} className={`p-3 rounded-2xl border flex items-start gap-2.5 ${optCls}`}>
                          <span className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${keyBg}`}>
                            {opt.key}
                          </span>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            {opt.text && (
                              <div className="text-xs font-semibold leading-snug">
                                <MathRenderer text={opt.text} inline />
                              </div>
                            )}
                            {optImgUrl && (
                              <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                                <img
                                  src={optImgUrl}
                                  alt={`Option ${opt.key}`}
                                  className="max-h-24 object-contain p-1 mx-auto block"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>
                          {isCorrectOpt && <IconCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Correct answer callout when user didn't attempt or got it wrong */}
                  {!selectedResp.isCorrect && correctAnswer && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                      <IconCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Correct Answer: <span className="font-black ml-1">{correctAnswer}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Solution */}
              {(solText || solImgUrl) ? (
                <section className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <p className="text-xs font-black uppercase text-indigo-700 tracking-wider border-b border-indigo-100 pb-2">
                    Solution Explanation
                  </p>
                  {solText && (
                    <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white/70 p-3.5 rounded-xl border border-indigo-100">
                      <MathRenderer text={solText} />
                    </div>
                  )}
                  {/* All solution images */}
                  {[
                    solImgUrl,
                    ...(solObj?.images?.slice(1).map(imgUrl).filter(Boolean) ?? []),
                  ].filter(Boolean).map((url, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-indigo-200 bg-white">
                      <img
                        src={url!}
                        alt={`Solution diagram ${idx + 1}`}
                        className="w-full max-h-56 sm:max-h-64 object-contain p-2"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </section>
              ) : (
                <div className="px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-400 font-medium text-center">
                  Solution explanation not available for this question.
                </div>
              )}

              {/* Telemetry */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Time Spent",    value: `${Number(selectedResp.timeSpentSeconds ?? 0)}s` },
                  { label: "Reattempted",   value: selectedResp.wasReattempted ? "Yes" : "No" },
                  { label: "Ans Changes",   value: String(selectedResp.answerChanges ?? 0) },
                  { label: "Confidence",    value: selectedResp.confidence != null ? `${selectedResp.confidence}%` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-400">{label}</p>
                    <p className="text-sm font-black text-slate-700 mt-0.5 tabular-nums">{value}</p>
                  </div>
                ))}
              </section>

              {/* Safe-area spacer for iOS */}
              <div className="h-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small reusable stat card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, valueSmall = false,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  valueSmall?: boolean;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center flex flex-col justify-between">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="my-1">
        <h2 className={`font-black tabular-nums leading-tight ${valueSmall ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"} ${color}`}>
          {value}
        </h2>
      </div>
      <p className="text-[10px] text-slate-400 font-semibold">{sub}</p>
    </div>
  );
}
