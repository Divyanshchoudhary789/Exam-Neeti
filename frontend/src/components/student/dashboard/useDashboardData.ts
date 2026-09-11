"use client";

import { useCallback, useEffect, useState } from "react";
import {
  studentService,
  subscriptionService,
  type Subscription,
  type PlanAccess,
} from "../../../services/apiServices";

// ─── Types for the unwrapped sprint-analytics payload ───────────────────────
export interface SprintSummary {
  totalTests: number;
  totalScore: number;
  highestScore: number;
  averageScore: number;
  overallAccuracy: number;
  overallAttemptRate: number;
  overallPercentage: number;
  consistencyAcrossTests?: {
    scoreStdDev: number;
    accuracyStdDevPercent: number;
    interpretation: string;
  };
}

export interface TimelineEntry {
  examId?: string;
  examTitle?: string;
  examNumber?: number;
  attemptId?: string;
  attemptNumber?: number;
  attemptedAt?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  accuracy?: number;
  attemptRate?: number;
  totalNegativeMarks?: number;
  totalRecoverable?: number;
  subjectAccuracy?: SubjectPerf[];
  improvementFromPrev?: number;
}

export interface SubjectPerf {
  subject: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted?: number;
  marksObtained: number;
  negativeMarks?: number;
  accuracy: number;
  attemptRate: number;
}

export interface ChapterPerf {
  subject: string;
  chapter: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  marksObtained: number;
  accuracy: number;
  attemptRate: number;
  avgTimeSeconds?: number;
}

export interface DifficultyBand {
  totalQuestions?: number;
  attempted?: number;
  correct?: number;
  accuracy?: number;
  attemptRate?: number;
}

export interface TopicPerf {
  subject: string;
  chapter: string;
  topic: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  accuracy: number;
  attemptRate: number;
  avgTimeSeconds?: number;
  isWeak?: boolean;
  isStrong?: boolean;
  byDifficulty?: Record<string, DifficultyBand>;
}

export interface DifficultyPerf {
  difficulty: string;
  subject?: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect?: number;
  accuracy: number;
  attemptRate: number;
  avgTimeSeconds?: number;
  percentageOfTotal?: number;
}

/** `{ [subject]: { high|medium|low: { covered, total } } }` from getWeightageCoverage */
export type WeightageCoverage = Record<
  string,
  { high: { covered: number; total: number }; medium: { covered: number; total: number }; low: { covered: number; total: number } }
>;

export interface CoverageMetrics {
  syllabusCoverage?: number;
  conceptCoverage?: number;
  weightedCoverage?: number;
  revisionCoverage?: number;
  [k: string]: unknown;
}

export interface SprintAnalytics {
  summary: SprintSummary | null;
  subjectPerformance: SubjectPerf[];
  chapterPerformance: ChapterPerf[];
  topicPerformance: { all: TopicPerf[]; weak: TopicPerf[]; strong: TopicPerf[] };
  topicProgression: Array<{ subject: string; chapter: string; topic: string; trend: number; series: Array<Record<string, unknown>> }>;
  difficultyPerformance: DifficultyPerf[];
  subjectDifficultyPerformance: Array<{ subject: string; difficulty: string; totalQuestions: number; attempted: number; correct: number; accuracy: number; attemptRate: number }>;
  errorAnalysis: { silly: number; concept: number; guess: number; total: number };
  coverageMetrics?: CoverageMetrics;
  weightageCoverage?: WeightageCoverage;
  timeline: TimelineEntry[];
}

export interface SprintItem {
  _id?: string;
  id?: string;
  name?: string;
  status?: string;
  isActive?: boolean;
  attemptCount?: number;
  lastAttemptedAt?: string | null;
}

const EMPTY_ANALYTICS: SprintAnalytics = {
  summary: null,
  subjectPerformance: [],
  chapterPerformance: [],
  topicPerformance: { all: [], weak: [], strong: [] },
  topicProgression: [],
  difficultyPerformance: [],
  subjectDifficultyPerformance: [],
  errorAnalysis: { silly: 0, concept: 0, guess: 0, total: 0 },
  timeline: [],
};

function unwrap<T = Record<string, unknown>>(res: unknown): T {
  const r = res as { data?: unknown } & Record<string, unknown>;
  return (r?.data ?? r ?? {}) as T;
}

function normSprintList(res: unknown): SprintItem[] {
  const r = unwrap<Record<string, unknown>>(res);
  const raw = (r.sprints as unknown) ?? (r.sprint as unknown) ?? r;
  if (Array.isArray(raw)) return raw as SprintItem[];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return [raw as SprintItem];
  return [];
}

const sid = (s?: SprintItem | null) => String(s?._id || s?.id || "");

const LS_KEY = "student-dashboard-sprint";
const readStoredSprint = (): string => {
  try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; }
};
const writeStoredSprint = (id: string) => {
  try { localStorage.setItem(LS_KEY, id); } catch { /* private mode */ }
};

/** Pick the sprint a student should land on: their last-remembered one if it's
 *  still available, else the active sprint with the most recent activity, else
 *  the most recently attempted, else the first active, else the first. */
function pickDefaultSprint(list: SprintItem[]): SprintItem | null {
  if (list.length === 0) return null;
  const stored = readStoredSprint();
  const remembered = stored && list.find((s) => sid(s) === stored);
  if (remembered) return remembered;

  const ts = (s: SprintItem) => (s.lastAttemptedAt ? new Date(s.lastAttemptedAt).getTime() : 0);
  const attempted = list.filter((s) => (s.attemptCount || 0) > 0).sort((a, b) => ts(b) - ts(a));
  const activeAttempted = attempted.filter((s) => s.isActive);
  if (activeAttempted[0]) return activeAttempted[0];
  if (attempted[0]) return attempted[0];
  return list.find((s) => s.isActive) || list[0];
}

export interface DashboardData {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  sprints: SprintItem[];
  activeSprint: SprintItem | null;
  selectedSprintId: string;
  selectedSprint: SprintItem | null;
  setSelectedSprintId: (id: string) => void;
  analytics: SprintAnalytics;
  probability: Record<string, unknown> | null;
  coverage: Record<string, unknown> | null;
  subscription: Subscription | null;
  access: PlanAccess | null;
  badgeExams: Record<string, unknown>[];
  pendingCount: number;
  refresh: (silent?: boolean) => void;
}

export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [activeSprint, setActiveSprint] = useState<SprintItem | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState("");

  const [analytics, setAnalytics] = useState<SprintAnalytics>(EMPTY_ANALYTICS);
  const [probability, setProbability] = useState<Record<string, unknown> | null>(null);
  const [coverage, setCoverage] = useState<Record<string, unknown> | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [access, setAccess] = useState<PlanAccess | null>(null);
  const [badgeExams, setBadgeExams] = useState<Record<string, unknown>[]>([]);

  const [bootstrapped, setBootstrapped] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // ── Bootstrap: sprints + subscription (once) ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [attemptedRes, subRes, accessRes] = await Promise.allSettled([
          studentService.getStudentAttemptedSprints(),
          subscriptionService.getMine(),
          subscriptionService.getMyAccess(),
        ]);

        if (cancelled) return;

        // A student's analytics workspace is scoped to the sprints they have
        // actually attempted an exam in — the backend already enforces this.
        const attempted = attemptedRes.status === "fulfilled" ? normSprintList(attemptedRes.value) : [];

        const merged = attempted
          .filter((s) => sid(s))
          .sort((a, b) => {
            if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
            const ta = a.lastAttemptedAt ? new Date(a.lastAttemptedAt).getTime() : 0;
            const tb = b.lastAttemptedAt ? new Date(b.lastAttemptedAt).getTime() : 0;
            return tb - ta;
          });

        setSprints(merged);
        const chosen = pickDefaultSprint(merged);
        setActiveSprint(merged.find((s) => s.isActive) || chosen);
        setSelectedSprintId((prev) => prev || sid(chosen));

        if (subRes.status === "fulfilled") {
          const s = unwrap<Record<string, unknown>>(subRes.value);
          setSubscription((s.subscription as Subscription) || (subRes.value as { subscription?: Subscription })?.subscription || null);
        }
        if (accessRes.status === "fulfilled") {
          const a = unwrap<Record<string, unknown>>(accessRes.value);
          setAccess((a.access as PlanAccess) || null);
        }
      } catch (e) {
        if (!cancelled) setError("Could not load your workspace. Please retry.");
        console.error("[dashboard] bootstrap", e);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Per-sprint data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!bootstrapped) return;
    if (!selectedSprintId) { setLoading(false); return; }

    let cancelled = false;
    const silent = reloadTick > 0;
    if (silent) setRefreshing(true); else setLoading(true);

    (async () => {
      try {
        const [aRes, pRes, cRes, eRes] = await Promise.allSettled([
          studentService.getSprintAnalyticsMe(selectedSprintId),
          studentService.getProbabilitySprint(selectedSprintId).catch(() => null),
          studentService.getSyllabusCoverageMe(selectedSprintId).catch(() => null),
          studentService.getMyExams({ sprintId: selectedSprintId, limit: 100 }).catch(() => null),
        ]);
        if (cancelled) return;

        if (aRes.status === "fulfilled") {
          const d = unwrap<Record<string, unknown>>(aRes.value);
          setAnalytics({
            ...EMPTY_ANALYTICS,
            ...(d as object),
            summary: (d.summary as SprintSummary) ?? null,
            topicPerformance: (d.topicPerformance as SprintAnalytics["topicPerformance"]) ?? EMPTY_ANALYTICS.topicPerformance,
            errorAnalysis: (d.errorAnalysis as SprintAnalytics["errorAnalysis"]) ?? EMPTY_ANALYTICS.errorAnalysis,
            timeline: Array.isArray(d.timeline) ? (d.timeline as TimelineEntry[]) : [],
          } as SprintAnalytics);
        } else {
          setAnalytics(EMPTY_ANALYTICS);
        }

        if (pRes.status === "fulfilled" && pRes.value) {
          const p = unwrap<Record<string, unknown>>(pRes.value);
          setProbability((p.probability as Record<string, unknown>) || p || null);
        } else setProbability(null);

        if (cRes.status === "fulfilled" && cRes.value) {
          const c = unwrap<Record<string, unknown>>(cRes.value);
          setCoverage((c.coverage as Record<string, unknown>) || c || null);
        } else setCoverage(null);

        if (eRes.status === "fulfilled" && eRes.value) {
          const e = unwrap<Record<string, unknown>>(eRes.value);
          const raw = (e.exams as unknown) ?? e;
          setBadgeExams(Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []);
        } else setBadgeExams([]);

        setError(null);
      } catch (e) {
        if (!cancelled) setError("Could not load analytics for this sprint.");
        console.error("[dashboard] sprint data", e);
      } finally {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [bootstrapped, selectedSprintId, reloadTick]);

  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  const selectSprint = useCallback((id: string) => {
    writeStoredSprint(id);
    setSelectedSprintId(id);
  }, []);

  const selectedSprint = sprints.find((s) => sid(s) === selectedSprintId) || activeSprint;
  const pendingCount = badgeExams.filter((e) => {
    const att = e.attempt as Record<string, unknown> | null | undefined;
    return !att || String(att.status || "") === "in_progress";
  }).length;

  return {
    loading, refreshing, error,
    sprints, activeSprint, selectedSprintId, selectedSprint,
    setSelectedSprintId: selectSprint,
    analytics, probability, coverage, subscription, access,
    badgeExams, pendingCount,
    refresh,
  };
}
