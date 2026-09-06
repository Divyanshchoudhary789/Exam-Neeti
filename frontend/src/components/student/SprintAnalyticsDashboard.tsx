"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { studentService } from "../../services/apiServices";
import {
  IconChart, IconBook, IconCheck, IconClock,
  IconAlertTriangle, IconChevronLeft, IconRefresh, Spinner, IconTarget,
} from "../common/UIComponents";
import { AreaLineChart, RadialMeter, DonutChart, HBarChart } from "../common/Charts";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconChevronDown = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sprintId?: string;
  sprintName?: string;
  activeSprints?: SprintItem[];
  onSelectSprint?: (sprintId: string) => void;
  onBack: () => void;
  onViewAttempt: (attemptId: string) => void;
}

export interface SprintItem {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  attemptCount?: number;
  lastAttemptedAt?: string | null;
  isActive?: boolean;
}

type Tab = "overview" | "subjects" | "chapters" | "topics" | "timeline";

interface TimelineEntry {
  examId?: string;
  examTitle?: string;
  examNumber?: number;
  attemptedAt?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  accuracy?: number;
  attemptRate?: number;
  totalNegativeMarks?: number;
  improvementFromPrev?: number;
}

interface SubjectEntry {
  subject?: string;
  accuracy?: number;
  marksObtained?: number;
  correct?: number;
  incorrect?: number;
  totalQuestions?: number;
  attempted?: number;
  attemptRate?: number;
}

interface ChapterEntry {
  subject?: string;
  chapter?: string;
  accuracy?: number;
  correct?: number;
  incorrect?: number;
  totalQuestions?: number;
  attempted?: number;
  marksObtained?: number;
  attemptRate?: number;
}

interface DifficultyBand {
  accuracy?: number;
  attemptRate?: number;
  totalQuestions?: number;
  attempted?: number;
  correct?: number;
}

interface TopicEntry {
  subject?: string;
  chapter?: string;
  topic?: string;
  accuracy?: number;
  correct?: number;
  totalQuestions?: number;
  attempted?: number;
  isWeak?: boolean;
  isStrong?: boolean;
  /** Attempt-rate / accuracy split by difficulty for this topic — absent on
   *  attempts computed before this breakdown existed. */
  byDifficulty?: Record<string, DifficultyBand>;
}

interface DifficultyPerfEntry {
  difficulty?: string;
  subject?: string;
  totalQuestions?: number;
  attempted?: number;
  correct?: number;
  accuracy?: number;
  attemptRate?: number;
  avgTimeSeconds?: number;
}

interface ErrorAnalysis {
  silly?: number;
  concept?: number;
  guess?: number;
  total?: number;
}

interface WeightageBand {
  covered: number;
  total: number;
}

interface WeightageCoverage {
  [subject: string]: { high: WeightageBand; medium: WeightageBand; low: WeightageBand };
}

interface ConsistencyAcrossTests {
  scoreStdDev?: number;
  accuracyStdDevPercent?: number;
  interpretation?: string;
}

interface TopicProgressionEntry {
  subject?: string;
  chapter?: string;
  topic?: string;
  trend?: number;
  series?: { examTitle?: string; examNumber?: number; accuracy?: number }[];
}

interface AnalyticsData {
  summary: {
    totalTests: number;
    totalScore: number;
    highestScore: number;
    averageScore: number;
    overallAccuracy: number;
    overallAttemptRate: number;
    overallPercentage: number;
    consistencyAcrossTests?: ConsistencyAcrossTests;
  } | null;
  subjectPerformance: SubjectEntry[];
  chapterPerformance: ChapterEntry[];
  topicPerformance: {
    all: TopicEntry[];
    weak: TopicEntry[];
    strong: TopicEntry[];
  } | null;
  topicProgression: TopicProgressionEntry[];
  timeline: TimelineEntry[];
  coverageMetrics: {
    syllabusCoverage?: number;
    conceptCoverage?: number;
  } | null;
  difficultyPerformance: DifficultyPerfEntry[];
  subjectDifficultyPerformance: DifficultyPerfEntry[];
  errorAnalysis: ErrorAnalysis | null;
  weightageCoverage: WeightageCoverage | null;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const SUB_BADGE: Record<string, string> = {
  physics:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  chemistry: "bg-violet-50 text-violet-700 border-violet-200",
  biology:   "bg-teal-50 text-teal-700 border-teal-200",
};
const SUB_GRAD: Record<string, string> = {
  physics:   "from-indigo-500 to-indigo-600",
  chemistry: "from-violet-500 to-violet-600",
  biology:   "from-teal-500 to-teal-600",
};

const accColor = (n: number) =>
  n >= 70 ? "text-emerald-600" : n >= 40 ? "text-amber-600" : "text-red-600";
const accBar = (n: number) =>
  n >= 70 ? "bg-emerald-500" : n >= 40 ? "bg-amber-500" : "bg-red-500";

const mergeSprintsById = (...groups: SprintItem[][]) => {
  const map = new Map<string, SprintItem>();
  for (const group of groups) {
    for (const sprint of group) {
      const id = String(sprint._id || sprint.id || "");
      if (!id) continue;
      const previous = map.get(id);
      map.set(id, {
        ...previous,
        ...sprint,
        _id: sprint._id || previous?._id || id,
        name: sprint.name || previous?.name || "Sprint",
        status: sprint.status || previous?.status || "active",
        attemptCount: Number(sprint.attemptCount ?? previous?.attemptCount ?? 0),
        isActive: Boolean(sprint.isActive ?? previous?.isActive ?? String(sprint.status || previous?.status || "").toLowerCase() === "active"),
      });
    }
  }
  return Array.from(map.values());
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SprintAnalyticsDashboard({ sprintId, sprintName, activeSprints = [], onSelectSprint, onBack }: Props) {
  const [sprintsList, setSprintsList]           = useState<SprintItem[]>([]);
  const [loadingSprints, setLoadingSprints]     = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState<string>(sprintId || "");
  const [selectedSprintName, setSelectedSprintName] = useState<string>(sprintName || "Sprint Analytics");

  const [loading, setLoading]                 = useState(true);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState("");
  const [data, setData]                       = useState<AnalyticsData | null>(null);
  const [tab, setTab]                         = useState<Tab>("overview");
  const [topicF, setTopicF]                   = useState<"all" | "weak" | "strong">("all");
  const [chapSub, setChapSub]                 = useState("all");
  const [chapSort, setChapSort]               = useState<"lowest" | "highest" | "mistakes" | "time">("lowest");
  const [chapBand, setChapBand]               = useState<"all" | "excellent" | "good" | "average" | "weak" | "critical">("all");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch attempted sprints on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSprints() {
      setLoadingSprints(true);
      try {
        const res = await studentService.getStudentAttemptedSprints();
        const attemptedList: SprintItem[] = res?.data?.sprints || res?.sprints || [];
        const list = mergeSprintsById(activeSprints, Array.isArray(attemptedList) ? attemptedList : []);
        if (isMounted) {
          setSprintsList(list);
          if (list.length > 0) {
            const match = sprintId
              ? list.find(s => String(s._id || s.id) === sprintId)
              : null;
            const chosen = match || list.find(s => s.isActive) || list[0];
            const chosenId = String(chosen._id || chosen.id);
            setSelectedSprintId(chosenId);
            setSelectedSprintName(chosen.name || "Sprint Analytics");
          }
        }
      } catch (err) {
        console.error("Failed to load attempted sprints:", err);
      } finally {
        if (isMounted) setLoadingSprints(false);
      }
    }
    loadSprints();
    return () => { isMounted = false; };
  }, [activeSprints, sprintId]);

  const hasDataRef = useRef(false);

  // 2. Fetch analytics for selected sprint (seamless loading state)
  const fetchData = useCallback(async (targetSprintId: string, silent = false) => {
    if (!targetSprintId) return null;
    
    // If we already have data, show non-destructive inline fetching state instead of clearing page
    if (hasDataRef.current && !silent) {
      setFetchingAnalytics(true);
    } else if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");
    try {
      const res = await studentService.getSprintAnalyticsMe(targetSprintId);
      const payload = res?.data?.summary !== undefined ? res.data : res?.data ?? res;

      const normalized: AnalyticsData = {
        summary: payload?.summary ?? null,
        subjectPerformance: Array.isArray(payload?.subjectPerformance) ? payload.subjectPerformance : [],
        chapterPerformance: Array.isArray(payload?.chapterPerformance) ? payload.chapterPerformance : [],
        topicPerformance: payload?.topicPerformance ?? null,
        topicProgression: Array.isArray(payload?.topicProgression) ? payload.topicProgression : [],
        timeline: Array.isArray(payload?.timeline) ? payload.timeline : [],
        coverageMetrics: payload?.coverageMetrics ?? null,
        difficultyPerformance: Array.isArray(payload?.difficultyPerformance) ? payload.difficultyPerformance : [],
        subjectDifficultyPerformance: Array.isArray(payload?.subjectDifficultyPerformance) ? payload.subjectDifficultyPerformance : [],
        errorAnalysis: payload?.errorAnalysis ?? null,
        weightageCoverage: payload?.weightageCoverage && Object.keys(payload.weightageCoverage).length > 0 ? payload.weightageCoverage : null,
      };
      hasDataRef.current = true;
      setData(normalized);
      return normalized;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || "Failed to load sprint analytics.";
      if ((e as { response?: { status?: number } })?.response?.status === 404) {
        setData({
          summary: null, subjectPerformance: [], chapterPerformance: [], topicPerformance: null,
          topicProgression: [], timeline: [], coverageMetrics: null, difficultyPerformance: [],
          subjectDifficultyPerformance: [], errorAnalysis: null, weightageCoverage: null,
        });
      } else {
        setError(msg);
      }
      return null;
    } finally {
      setLoading(false);
      setFetchingAnalytics(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSprintId) {
      fetchData(selectedSprintId);
    } else {
      setLoading(false);
    }
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [selectedSprintId, fetchData]);

  const handleSelectSprint = (newSprintId: string) => {
    if (newSprintId === selectedSprintId) return;
    const found = sprintsList.find(s => String(s._id || s.id) === newSprintId);
    if (found) {
      setSelectedSprintId(newSprintId);
      setSelectedSprintName(found.name || "Sprint Analytics");
      onSelectSprint?.(newSprintId);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (selectedSprintId) {
      await fetchData(selectedSprintId, true);
    }
  }, [selectedSprintId, fetchData]);

  // ── Loading Sprints initial state ──────────────────────────────────────────
  if (loadingSprints && !sprintsList.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner className="w-8 h-8 text-indigo-600" />
        <p className="text-xs font-bold text-slate-500">Loading your attempted sprints…</p>
      </div>
    );
  }

  // ── Initial Loading Analytics state ────────────────────────────────────────
  if (loading && !data) return (
    <div className="space-y-4">
      <PageHeader
        selectedSprintId={selectedSprintId}
        sprintsList={sprintsList}
        onSelectSprint={handleSelectSprint}
        onBack={onBack}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        fetchingAnalytics={fetchingAnalytics}
      />
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner className="w-8 h-8 text-indigo-600" />
        <p className="text-xs font-bold text-slate-500">Fetching analytics for {selectedSprintName}…</p>
      </div>
    </div>
  );

  // ── Error State ────────────────────────────────────────────────────────────
  if (error) return (
    <div className="space-y-4">
      <PageHeader
        selectedSprintId={selectedSprintId}
        sprintsList={sprintsList}
        onSelectSprint={handleSelectSprint}
        onBack={onBack}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        fetchingAnalytics={fetchingAnalytics}
      />
      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <IconAlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-base font-black text-slate-900">Analytics Unavailable</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">{error}</p>
          <div className="flex gap-2">
            <button onClick={onBack} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">
              Back
            </button>
            <button onClick={handleRefresh} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── No data for selected sprint ────────────────────────────────────────────
  if (!data || (!data.summary && data.timeline.length === 0)) return (
    <div className="space-y-4">
      <PageHeader
        selectedSprintId={selectedSprintId}
        sprintsList={sprintsList}
        onSelectSprint={handleSelectSprint}
        onBack={onBack}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        fetchingAnalytics={fetchingAnalytics}
      />
      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
            <IconChart className="w-7 h-7 text-indigo-500" />
          </div>
          <h3 className="text-base font-black text-slate-900">No Analytics for {selectedSprintName}</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            You have not submitted any test attempts for this sprint yet, or analytics are still being processed. Submit an exam to see your subject breakdown and timeline metrics!
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={onBack} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">
              Back to Dashboard
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5">
              {refreshing ? <Spinner className="w-3.5 h-3.5 text-white" /> : <IconRefresh className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Derived Analytics ──────────────────────────────────────────────────────
  const { summary, subjectPerformance: subjects, chapterPerformance: chapters,
          topicPerformance: topicsObj, topicProgression, timeline, coverageMetrics,
          difficultyPerformance, subjectDifficultyPerformance, errorAnalysis, weightageCoverage } = data;

  // 5-band performance classification (image-2 style) — accuracy thresholds,
  // client-side since the backend only exposes the raw weak/strong booleans.
  const perfBand = (acc: number): "excellent" | "good" | "average" | "weak" | "critical" =>
    acc >= 85 ? "excellent" : acc >= 70 ? "good" : acc >= 50 ? "average" : acc >= 30 ? "weak" : "critical";
  const PERF_BAND_META: Record<string, { label: string; dot: string; text: string }> = {
    excellent: { label: "Excellent", dot: "bg-emerald-500", text: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    good:      { label: "Good",      dot: "bg-blue-500",    text: "text-blue-700 bg-blue-50 border-blue-200" },
    average:   { label: "Average",   dot: "bg-amber-500",   text: "text-amber-700 bg-amber-50 border-amber-200" },
    weak:      { label: "Weak",      dot: "bg-orange-500",  text: "text-orange-700 bg-orange-50 border-orange-200" },
    critical:  { label: "Critical",  dot: "bg-red-500",     text: "text-red-700 bg-red-50 border-red-200" },
  };

  const chapSubjects  = ["all", ...Array.from(new Set(chapters.map(c => String(c.subject || ""))))];
  const filteredChaps = chapters
    .filter(c => chapSub === "all" || String(c.subject || "").toLowerCase() === chapSub)
    .filter(c => chapBand === "all" || perfBand(Number(c.accuracy ?? 0)) === chapBand)
    .sort((a, b) => {
      if (chapSort === "highest")   return Number(b.accuracy ?? 0) - Number(a.accuracy ?? 0);
      if (chapSort === "mistakes")  return Number(b.incorrect ?? 0) - Number(a.incorrect ?? 0);
      if (chapSort === "time")      return Number(b.totalQuestions ?? 0) - Number(a.totalQuestions ?? 0);
      return Number(a.accuracy ?? 0) - Number(b.accuracy ?? 0); // lowest accuracy first (default)
    });

  const currentTopics: TopicEntry[] = topicsObj
    ? (topicF === "weak" ? topicsObj.weak : topicF === "strong" ? topicsObj.strong : topicsObj.all)
    : [];

  // Group every topic under its chapter — powers each chapter card's
  // expandable topic list (with per-difficulty bars) in the Chapters tab.
  const topicsByChapterKey: Record<string, TopicEntry[]> = {};
  for (const t of (topicsObj?.all ?? [])) {
    const key = `${t.subject}__${t.chapter}`;
    (topicsByChapterKey[key] = topicsByChapterKey[key] || []).push(t);
  }

  const toggleChapter = (key: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const TABS: { id: Tab; label: string; short: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview",  label: "Overview",  short: "Overview",  Icon: IconChart },
    { id: "subjects",  label: "Subjects",  short: "Subjects",  Icon: IconBook },
    { id: "chapters",  label: "Chapters",  short: "Chapters",  Icon: IconAlertTriangle },
    { id: "topics",    label: "Topics",    short: "Topics",    Icon: IconCheck },
    { id: "timeline",  label: "Timeline",  short: "Timeline",  Icon: IconClock },
  ];

  const scColor = (s: number, max: number) => {
    const r = s / Math.max(max, 1);
    return r >= 0.65 ? "text-emerald-600" : r >= 0.4 ? "text-amber-600" : "text-red-600";
  };

  return (
    <div className="space-y-4 font-sans text-slate-800 pb-6 relative">

      {/* ── Header with Custom Sprint Selector ───────────────────────── */}
      <PageHeader
        selectedSprintId={selectedSprintId}
        sprintsList={sprintsList}
        onSelectSprint={handleSelectSprint}
        onBack={onBack}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        fetchingAnalytics={fetchingAnalytics}
      />

      {/* ── Content Container with Translucent Loading Overlay ───────────── */}
      <div className="relative space-y-4">
        {fetchingAnalytics && (
          <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[2px] rounded-2xl flex items-start justify-center pt-24 transition-opacity duration-300">
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 text-xs font-bold animate-in fade-in zoom-in-95 duration-200">
              <Spinner className="w-4 h-4 text-indigo-400" />
              <span>Updating analytics for {selectedSprintName}…</span>
            </div>
          </div>
        )}

        {/* ── Summary stat cards ─────────────────────────────────────────── */}
        {summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Tests Attempted", val: String(summary.totalTests),                                  color: "text-slate-900" },
              { label: "Avg Score",       val: String(Number(summary.averageScore).toFixed(0)), color: "text-indigo-600" },
              { label: "Best Score",      val: String(summary.highestScore),                                  color: "text-emerald-600" },
              { label: "Avg Accuracy",    val: `${Number(summary.overallAccuracy).toFixed(1)}%`,              color: "text-amber-600" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 px-3 py-3.5 shadow-sm text-center">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
                <p className={`text-xl font-black mt-1 ${color} tabular-nums leading-tight`}>{val}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 px-3 py-3.5 shadow-sm text-center animate-pulse">
                <div className="h-2.5 w-16 bg-slate-100 rounded mx-auto mb-2" />
                <div className="h-7 w-12 bg-slate-100 rounded mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Refresh hint when analytics still computing */}
        {summary && summary.totalTests < timeline.length && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
            <IconAlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Analytics for some recent tests are still being calculated. Tap Refresh in a moment.
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        )}

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                tab === id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />{label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-in fade-in duration-300">

            {/* Coverage */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconBook className="w-4 h-4 text-indigo-600 shrink-0" />Sprint Coverage
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Syllabus Coverage", pct: Number(coverageMetrics?.syllabusCoverage ?? 0), color: "bg-indigo-500" },
                  { label: "Concept Mastery",   pct: Number(coverageMetrics?.conceptCoverage  ?? 0), color: "bg-teal-500" },
                ].map(({ label, pct, color }) => (
                  <div key={label} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{label}</span>
                      <span className="text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 group-hover:brightness-110 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconChart className="w-4 h-4 text-violet-600 shrink-0" />Performance Summary
              </h3>
              {summary ? (
                <div className="flex items-center gap-4">
                  <RadialMeter value={Number(summary.overallAccuracy)} size={84} strokeWidth={8} label="Avg Accuracy" />
                  <div className="grid grid-cols-2 gap-2.5 flex-1 min-w-0">
                    {[
                      { label: "Tests",        val: String(summary.totalTests),                                 color: "text-slate-900" },
                      { label: "Best Score",   val: String(summary.highestScore),                               color: "text-emerald-600" },
                      { label: "Attempt Rate", val: `${Number(summary.overallAttemptRate).toFixed(1)}%`,        color: "text-amber-600" },
                      {
                        label: "Consistency",
                        val: summary.consistencyAcrossTests
                          ? String(summary.consistencyAcrossTests.interpretation || "—").replace(/_/g, " ")
                          : "—",
                        color: "text-violet-600",
                        sub: summary.consistencyAcrossTests ? `±${Number(summary.consistencyAcrossTests.accuracyStdDevPercent ?? 0).toFixed(1)}% accuracy` : undefined,
                      },
                    ].map(({ label, val, color, sub }) => (
                      <div key={label} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <p className="text-[9px] font-extrabold uppercase text-slate-400">{label}</p>
                        <p className={`text-base font-black mt-0.5 ${color} tabular-nums capitalize truncate`}>{val}</p>
                        {sub && <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{sub}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-medium">No data yet. Refresh after submitting a test.</p>
              )}
            </div>

            {/* Error Analysis — silly mistake / concept error / guess mix */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />Error Analysis
              </h3>
              {errorAnalysis && (errorAnalysis.total ?? 0) > 0 ? (
                <DonutChart
                  size={128}
                  strokeWidth={18}
                  centerLabel={String(errorAnalysis.total)}
                  centerSublabel="of Errors"
                  data={[
                    { label: "Conceptual Error", value: Number(errorAnalysis.concept ?? 0), color: "#4f46e5" },
                    { label: "Silly Mistake",    value: Number(errorAnalysis.silly   ?? 0), color: "#7c3aed" },
                    { label: "Guessing",         value: Number(errorAnalysis.guess   ?? 0), color: "#f59e0b" },
                  ]}
                />
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-medium">No errors recorded yet — great consistency!</p>
              )}
            </div>

            {/* Difficulty Type Performance */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconTarget className="w-4 h-4 text-indigo-600 shrink-0" />Difficulty Type Performance
              </h3>
              {difficultyPerformance.length > 0 ? (
                <HBarChart
                  data={(["easy", "medium", "hard"] as const)
                    .map(diff => difficultyPerformance.find(d => String(d.difficulty || "").toLowerCase() === diff))
                    .filter((d): d is DifficultyPerfEntry => Boolean(d))
                    .map(d => ({
                      label: String(d.difficulty),
                      value: Number(d.accuracy ?? 0),
                      color: String(d.difficulty).toLowerCase() === "easy" ? "#10b981" : String(d.difficulty).toLowerCase() === "medium" ? "#f59e0b" : "#ef4444",
                      detail: `${d.correct ?? 0}/${d.attempted ?? 0} correct`,
                    }))}
                />
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-medium">No difficulty data available yet.</p>
              )}
            </div>

            {/* Chapters to Focus On — lowest-accuracy chapters with real attempt volume */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />Chapters to Focus On
              </h3>
              {chapters.filter(c => Number(c.attempted ?? 0) > 0).length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {[...chapters]
                    .filter(c => Number(c.attempted ?? 0) > 0)
                    .sort((a, b) => Number(a.accuracy ?? 0) - Number(b.accuracy ?? 0))
                    .slice(0, 5)
                    .map((c, i) => {
                      const badge = SUB_BADGE[String(c.subject || "").toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-200";
                      const recoverableMarks = Math.round((Number(c.totalQuestions ?? 0) - Number(c.correct ?? 0)) * 4 * 0.5);
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{String(c.chapter || "")}</p>
                              <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border mt-0.5 ${badge}`}>{c.subject}</span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-red-600 tabular-nums shrink-0">− {recoverableMarks} mks</span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center font-medium">Not enough chapter data yet.</p>
              )}
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 font-semibold">
                Improving in these chapters can boost your score significantly.
              </p>
            </div>
          </div>
        )}

        {/* ══ SUBJECTS ════════════════════════════════════════════════════ */}
        {tab === "subjects" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
            <h3 className="text-sm font-black text-slate-900">Subject-wise Performance</h3>
            {subjects.length === 0 ? (
              <EmptyTab label="No subject data available yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((s, i) => {
                  const sub     = String(s.subject || `Subject ${i + 1}`);
                  const subKey  = sub.toLowerCase();
                  const acc     = Number(s.accuracy ?? 0);
                  const marks   = Number(s.marksObtained ?? 0);
                  const correct = Number(s.correct ?? 0);
                  const wrong   = Number(s.incorrect ?? 0);
                  const skipped = Math.max(0, Number(s.totalQuestions ?? 0) - correct - wrong);
                  const attR    = Number(s.attemptRate ?? 0);
                  const grad    = SUB_GRAD[subKey] || "from-slate-400 to-slate-500";
                  const badge   = SUB_BADGE[subKey] || "bg-slate-50 text-slate-700 border-slate-200";

                  const diffRows = (["easy", "medium", "hard"] as const)
                    .map(diff => subjectDifficultyPerformance.find(d => String(d.subject).toLowerCase() === subKey && String(d.difficulty).toLowerCase() === diff))
                    .filter((d): d is DifficultyPerfEntry => Boolean(d) && Number(d?.attempted ?? 0) > 0);

                  const weightage = weightageCoverage?.[subKey];

                  const weakestChapter = [...chapters]
                    .filter(c => String(c.subject || "").toLowerCase() === subKey && Number(c.attempted ?? 0) > 0)
                    .sort((a, b) => Number(a.accuracy ?? 0) - Number(b.accuracy ?? 0))[0];

                  return (
                    <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-extrabold uppercase ${badge}`}>{sub}</span>
                        <span className="text-xl font-black text-slate-900 tabular-nums">
                          {marks}<span className="text-xs font-bold text-slate-400 ml-0.5">pts</span>
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-500">Score progress</span>
                          <span className={accColor(acc) + " tabular-nums"}>{acc.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${grad}`} style={{ width: `${Math.min(acc, 100)}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        {[
                          { label: "Correct",   val: correct,               cls: "text-emerald-600" },
                          { label: "Incorrect", val: wrong,                 cls: "text-red-500" },
                          { label: "Skipped",   val: skipped,               cls: "text-slate-500" },
                        ].map(({ label, val, cls }) => (
                          <div key={label} className="bg-slate-50 rounded-xl p-2">
                            <p className={`text-sm font-black ${cls} tabular-nums`}>{val}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                        <span>Attempt Rate</span>
                        <span className="text-indigo-600 tabular-nums">{attR.toFixed(0)}%</span>
                      </div>

                      {diffRows.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                          <p className="text-[9px] font-extrabold uppercase text-slate-400">Accuracy by Difficulty</p>
                          {diffRows.map(d => (
                            <div key={d.difficulty} className="flex items-center gap-2 text-[10px]">
                              <span className="w-12 shrink-0 font-bold text-slate-500 capitalize">{d.difficulty}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${accBar(Number(d.accuracy ?? 0))}`} style={{ width: `${Math.min(Number(d.accuracy ?? 0), 100)}%` }} />
                              </div>
                              <span className="w-9 text-right font-bold text-slate-600 tabular-nums shrink-0">{Number(d.accuracy ?? 0).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {weightage && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                          <p className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1">
                            Chapters Covered by Weightage
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([["High", weightage.high, "bg-red-50 text-red-700 border-red-200"], ["Medium", weightage.medium, "bg-amber-50 text-amber-700 border-amber-200"], ["Low", weightage.low, "bg-emerald-50 text-emerald-700 border-emerald-200"]] as const).map(([label, band, cls]) => (
                              <div key={label} className={`rounded-xl border px-2 py-1.5 text-center ${cls}`}>
                                <p className="text-[9px] font-black uppercase">{label}</p>
                                <p className="text-xs font-black tabular-nums">{band.covered} / {band.total}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {weakestChapter && (
                        <p className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                          Weak zone: {String(weakestChapter.chapter)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ CHAPTERS ════════════════════════════════════════════════════ */}
        {tab === "chapters" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900">Chapter &amp; Topic Analytics</h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
                  {chapters.filter(c => perfBand(Number(c.accuracy ?? 0)) === "critical" || perfBand(Number(c.accuracy ?? 0)) === "weak").length > 0 && (
                    <> · <span className="text-red-600 font-black">{chapters.filter(c => perfBand(Number(c.accuracy ?? 0)) === "critical" || perfBand(Number(c.accuracy ?? 0)) === "weak").length} need attention</span></>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                {chapSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setChapSub(sub)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold capitalize cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                      chapSub === sub ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {sub === "all" ? "All Subjects" : sub}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {([["lowest", "Lowest Accuracy"], ["highest", "Highest Accuracy"], ["mistakes", "Most Mistakes"], ["time", "Most Questions"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setChapSort(id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold whitespace-nowrap cursor-pointer transition-all ${
                      chapSort === id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <span className="text-[9px] font-extrabold uppercase text-slate-400 shrink-0 mr-0.5">Performance:</span>
                {(["all", "excellent", "good", "average", "weak", "critical"] as const).map(band => (
                  <button
                    key={band}
                    onClick={() => setChapBand(band)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold capitalize whitespace-nowrap cursor-pointer transition-all shrink-0 border ${
                      chapBand === band ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {band !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${PERF_BAND_META[band].dot}`} />}
                    {band === "all" ? "All" : PERF_BAND_META[band].label}
                  </button>
                ))}
              </div>
            </div>

            {filteredChaps.length === 0 ? (
              <EmptyTab label="No chapter data matches these filters yet." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredChaps.map((c, i) => {
                  const acc      = Number(c.accuracy ?? 0);
                  const sub      = String(c.subject || "");
                  const subKey   = sub.toLowerCase();
                  const chapKey  = `${sub}__${c.chapter}`;
                  const badge    = SUB_BADGE[subKey] || "bg-slate-50 text-slate-600 border-slate-200";
                  const band     = perfBand(acc);
                  const topics   = topicsByChapterKey[chapKey] || [];
                  const expanded = expandedChapters.has(chapKey);
                  const attR     = Number(c.attemptRate ?? (Number(c.attempted ?? 0) / Math.max(Number(c.totalQuestions ?? 0), 1)) * 100);
                  return (
                    <div key={i} className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${band === "critical" || band === "weak" ? "border-red-200" : "border-slate-200"}`}>
                      <div className={`h-1 ${accBar(acc)}`} />
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${badge}`}>{sub}</span>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${PERF_BAND_META[band].text}`}>{PERF_BAND_META[band].label}</span>
                            </div>
                            <p className="text-sm font-black text-slate-900 leading-tight">{String(c.chapter || "")}</p>
                          </div>
                          <RadialMeter value={acc} size={48} strokeWidth={5} />
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs font-black text-slate-900 tabular-nums">{attR.toFixed(0)}%</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Attempt</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs font-black text-slate-900 tabular-nums">{Number(c.marksObtained ?? 0)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Marks</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs font-black text-slate-900 tabular-nums">{Number(c.totalQuestions ?? 0)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Questions</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 text-[10px] font-semibold text-slate-500">
                          <span className="text-emerald-600 font-bold">{Number(c.correct ?? 0)} correct</span>
                          <span className="text-red-500 font-bold">{Number(c.incorrect ?? 0)} incorrect</span>
                        </div>

                        {topics.length > 0 && (
                          <button
                            onClick={() => toggleChapter(chapKey)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-600 cursor-pointer transition-all"
                          >
                            {expanded ? "Hide topics" : `View ${topics.length} topic${topics.length !== 1 ? "s" : ""} inside`}
                            <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                        )}

                        {expanded && topics.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {topics.map((t, ti) => {
                              const tAcc = Number(t.accuracy ?? 0);
                              const tBand = perfBand(tAcc);
                              return (
                                <div key={ti} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold text-slate-800 truncate">{String(t.topic || "")}</p>
                                    <span className={`shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${PERF_BAND_META[tBand].text}`}>{PERF_BAND_META[tBand].label}</span>
                                  </div>
                                  {t.byDifficulty && Object.keys(t.byDifficulty).length > 0 ? (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                      <div className="space-y-1">
                                        <p className="text-[8px] font-extrabold uppercase text-slate-400 flex items-center gap-1">Attempt Rate by Difficulty</p>
                                        {(["easy", "medium", "hard"] as const).map(diff => {
                                          const band2 = t.byDifficulty?.[diff];
                                          if (!band2) return null;
                                          return (
                                            <div key={diff} className="flex items-center gap-1.5 text-[9px]">
                                              <span className="w-9 shrink-0 font-bold text-slate-500 capitalize">{diff}</span>
                                              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(Number(band2.attemptRate ?? 0), 100)}%` }} />
                                              </div>
                                              <span className="w-7 text-right font-bold text-slate-500 tabular-nums shrink-0">{Number(band2.attemptRate ?? 0).toFixed(0)}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[8px] font-extrabold uppercase text-slate-400 flex items-center gap-1">Accuracy by Difficulty</p>
                                        {(["easy", "medium", "hard"] as const).map(diff => {
                                          const band2 = t.byDifficulty?.[diff];
                                          if (!band2) return null;
                                          return (
                                            <div key={diff} className="flex items-center gap-1.5 text-[9px]">
                                              <span className="w-9 shrink-0 font-bold text-slate-500 capitalize">{diff}</span>
                                              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${accBar(Number(band2.accuracy ?? 0))}`} style={{ width: `${Math.min(Number(band2.accuracy ?? 0), 100)}%` }} />
                                              </div>
                                              <span className="w-7 text-right font-bold text-slate-500 tabular-nums shrink-0">{Number(band2.accuracy ?? 0).toFixed(0)}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-slate-400 font-semibold">
                                      {Number(t.correct ?? 0)}/{Number(t.attempted ?? 0)} correct · difficulty split not available for older attempts
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TOPICS ══════════════════════════════════════════════════════ */}
        {tab === "topics" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900">Topic Analysis</h3>
              <div className="flex items-center gap-1.5">
                {(["all", "weak", "strong"] as const).map(f => {
                  const cnt = f === "weak" ? (topicsObj?.weak.length ?? 0) : f === "strong" ? (topicsObj?.strong.length ?? 0) : null;
                  return (
                    <button
                      key={f}
                      onClick={() => setTopicF(f)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold capitalize cursor-pointer transition-all whitespace-nowrap ${
                        topicF === f
                          ? f === "weak" ? "bg-red-600 text-white" : f === "strong" ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f}{cnt !== null ? ` (${cnt})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {topicF === "weak" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                <IconAlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                Focus revision here — these topics have below-threshold accuracy.
              </div>
            )}
            {topicF === "strong" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
                <IconCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                Keep these strong — you consistently score well here.
              </div>
            )}

            {currentTopics.length === 0 ? (
              <EmptyTab label="No topic data in this category yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[32rem] overflow-y-auto pr-0.5">
                {currentTopics.map((t, i) => {
                  const acc   = Number(t.accuracy ?? 0);
                  const sub   = String(t.subject || "");
                  const badge = SUB_BADGE[sub.toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-200";
                  const tag   = acc >= 70
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : acc >= 40
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-red-50 border-red-200 text-red-700";
                  return (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-white space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${badge}`}>{sub}</span>
                          <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{String(t.topic || "")}</p>
                          <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{String(t.chapter || "")}</p>
                        </div>
                        <span className={`text-sm font-black px-2 py-1 rounded-xl border shrink-0 tabular-nums ${tag}`}>{acc.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold tabular-nums">
                        <span className="text-emerald-600">{Number(t.correct ?? 0)} correct</span>
                        <span>{Number(t.attempted ?? 0)} attempted</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Topic Progression — accuracy trend across tests in this sprint (needs 2+ tests on a topic) */}
            {topicProgression.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <h4 className="text-xs font-black text-slate-800">Topic Progression Across Tests</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {topicProgression.slice(0, 8).map((tp, i) => {
                    const trend = Number(tp.trend ?? 0);
                    const improving = trend > 0;
                    const flat = trend === 0;
                    return (
                      <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{String(tp.topic || "")}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{String(tp.subject || "")} • {tp.series?.length ?? 0} tests</p>
                        </div>
                        <span className={`text-xs font-black tabular-nums shrink-0 px-2 py-1 rounded-lg ${
                          flat ? "text-slate-500 bg-slate-100" : improving ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
                        }`}>
                          {improving ? "+" : ""}{trend.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TIMELINE ════════════════════════════════════════════════════ */}
        {tab === "timeline" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Performance Timeline</h3>
              <span className="text-[10px] font-extrabold text-slate-400 tabular-nums">{timeline.length} test{timeline.length !== 1 ? "s" : ""}</span>
            </div>

            {timeline.length === 0 ? (
              <EmptyTab label="No test attempts yet in this sprint." />
            ) : (
              <>
                {/* Score trend */}
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Score Trend</p>
                  <AreaLineChart
                    color="#4f46e5"
                    valueSuffix=" pts"
                    height={160}
                    data={timeline.map((t, i) => ({
                      label: `T${i + 1}`,
                      value: Number(t.score ?? 0),
                      detail: `${String(t.examTitle || `Test ${i + 1}`)} • ${t.attemptedAt ? new Date(String(t.attemptedAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}`,
                    }))}
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-0.5">
                  <table className="text-xs text-left w-full" style={{ minWidth: "520px" }}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["#", "Exam", "Score", "Accuracy", "Att. Rate", "Δ Score", "Date"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {timeline.map((t, i) => {
                        const s    = Number(t.score ?? 0);
                        const tot  = Number(t.totalMarks ?? 720);
                        const acc  = Number(t.accuracy ?? 0).toFixed(1);
                        const att  = Number(t.attemptRate ?? 0).toFixed(0);
                        const diff = Number(t.improvementFromPrev ?? 0);
                        const date = t.attemptedAt
                          ? new Date(String(t.attemptedAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : "—";
                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 font-extrabold text-slate-400 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-700 max-w-[140px]">
                              <span className="block truncate">{String(t.examTitle || `Test ${i + 1}`)}</span>
                            </td>
                            <td className={`px-3 py-2.5 font-extrabold tabular-nums ${scColor(s, tot)}`}>
                              {s}<span className="text-slate-400 font-semibold text-[10px]">/{tot}</span>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-600 tabular-nums">{acc}%</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-600 tabular-nums">{att}%</td>
                            <td className={`px-3 py-2.5 font-extrabold tabular-nums ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-400"}`}>
                              {i === 0 ? "—" : diff > 0 ? `+${diff}` : String(diff)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 font-semibold whitespace-nowrap">{date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({
  selectedSprintId,
  sprintsList,
  onSelectSprint,
  onBack,
  onRefresh,
  refreshing,
  fetchingAnalytics,
}: {
  selectedSprintId: string;
  sprintsList: SprintItem[];
  onSelectSprint: (sprintId: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  fetchingAnalytics: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition-colors cursor-pointer shrink-0"
            aria-label="Back to Dashboard"
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Sprint Analytics</h1>
              {sprintsList.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-100">
                  {sprintsList.length} {sprintsList.length === 1 ? "Sprint" : "Sprints"} Available
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select a sprint below to view your test results & performance insights
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing || fetchingAnalytics}
          className="self-end sm:self-center flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0"
          aria-label="Refresh analytics"
          title="Refresh analytics"
        >
          {refreshing
            ? <Spinner className="w-3.5 h-3.5 text-slate-500" />
            : <IconRefresh className="w-3.5 h-3.5" />
          }
          <span>Refresh</span>
        </button>
      </div>

      {/* Interactive Custom Sprint Dropdown Selector (No emojis, full SVG badges & responsive popover) */}
      {sprintsList.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
            <IconChart className="w-4 h-4 text-indigo-600" />
            Analytics Sprint View:
          </span>
          <SprintDropdownSelector
            sprintsList={sprintsList}
            selectedSprintId={selectedSprintId}
            onSelectSprint={onSelectSprint}
            fetchingAnalytics={fetchingAnalytics}
          />
        </div>
      )}
    </div>
  );
}

function SprintDropdownSelector({
  sprintsList,
  selectedSprintId,
  onSelectSprint,
  fetchingAnalytics,
}: {
  sprintsList: SprintItem[];
  selectedSprintId: string;
  onSelectSprint: (sprintId: string) => void;
  fetchingAnalytics: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSprint = sprintsList.find((s) => String(s._id || s.id) === selectedSprintId) || sprintsList[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!sprintsList.length) return null;

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl px-3.5 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
            {selectedSprint?.name || "Select Sprint"}
          </span>

          {/* Status Badge */}
          {selectedSprint?.isActive ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
              Completed
            </span>
          )}

          {/* Attempt Count Badge */}
          <span className="hidden sm:inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {selectedSprint?.attemptCount || 0} {(selectedSprint?.attemptCount === 1) ? "Test" : "Tests"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {fetchingAnalytics && <Spinner className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
          <IconChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180 text-indigo-600" : ""}`} />
        </div>
      </button>

      {/* Custom Dropdown Menu Popover */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden py-1.5 max-h-72 overflow-y-auto font-sans animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
            <span>Attempted Sprints</span>
            <span>{sprintsList.length} Total</span>
          </div>

          <div className="divide-y divide-slate-50">
            {sprintsList.map((sp) => {
              const sid = String(sp._id || sp.id);
              const isSelected = sid === selectedSprintId;
              const dateStr = sp.lastAttemptedAt
                ? new Date(sp.lastAttemptedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                : null;

              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => {
                    onSelectSprint(sid);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors cursor-pointer ${
                    isSelected ? "bg-indigo-50/80 text-indigo-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-xs sm:text-sm font-black truncate ${isSelected ? "text-indigo-900" : "text-slate-900"}`}>
                        {sp.name}
                      </p>
                      {sp.isActive ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                          Completed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold flex-wrap">
                      <span className="text-indigo-600 font-bold">
                        {sp.attemptCount} {sp.attemptCount === 1 ? "Test Attempted" : "Tests Attempted"}
                      </span>
                      {dateStr && <span>• Last attempt: {dateStr}</span>}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <IconCheck className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="py-12 text-center rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-xs text-slate-400 font-semibold">{label}</p>
    </div>
  );
}
