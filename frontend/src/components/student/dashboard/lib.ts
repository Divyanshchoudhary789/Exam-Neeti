import type { SprintAnalytics, TimelineEntry } from "./useDashboardData";

// ─── "vs last month" delta from the sprint timeline ────────────────────────
// Compares the mean of the last-30-day window against the 30 days before it.
export function monthlyDelta(timeline: TimelineEntry[], pick: (t: TimelineEntry) => number | undefined): number | null {
  const withDates = timeline
    .filter((t) => t.attemptedAt && Number.isFinite(Number(pick(t))))
    .map((t) => ({ at: new Date(t.attemptedAt as string).getTime(), v: Number(pick(t)) }))
    .sort((a, b) => a.at - b.at);
  if (withDates.length < 2) return null;

  const now = withDates[withDates.length - 1].at;
  const month = 30 * 24 * 3600 * 1000;
  const recent = withDates.filter((d) => d.at > now - month);
  const prior = withDates.filter((d) => d.at <= now - month && d.at > now - 2 * month);
  const mean = (arr: { v: number }[]) => (arr.length ? arr.reduce((s, x) => s + x.v, 0) / arr.length : null);

  const r = mean(recent);
  // Fall back to "latest vs first half" when there isn't a clean 2-month split.
  const p = prior.length ? mean(prior) : mean(withDates.slice(0, Math.ceil(withDates.length / 2)));
  if (r == null || p == null) return null;
  return parseFloat((r - p).toFixed(1));
}

export type Tone = "good" | "warn" | "risk" | "neutral";

export function pctStatus(pct: number, delta: number | null): { label: string; tone: Tone } {
  if (delta != null && delta <= -3) return { label: "Watch", tone: "risk" };
  if (pct >= 80) return { label: "Strong", tone: "good" };
  if (pct >= 60) return { label: delta != null && delta > 0 ? "Improving" : "On Track", tone: "good" };
  if (pct >= 40) return { label: delta != null && delta > 0 ? "Rising" : "Building", tone: "warn" };
  return { label: "Focus", tone: "risk" };
}

// ─── Time-range filtering of the timeline ──────────────────────────────────
export type RangeKey = "1m" | "3m" | "6m" | "all";
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "1m", label: "1M" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" }, { value: "all", label: "All" },
];

export function filterByRange(timeline: TimelineEntry[], range: RangeKey): TimelineEntry[] {
  if (range === "all") return timeline;
  const months = range === "1m" ? 1 : range === "3m" ? 3 : 6;
  const cutoff = Date.now() - months * 30 * 24 * 3600 * 1000;
  const filtered = timeline.filter((t) => t.attemptedAt && new Date(t.attemptedAt).getTime() >= cutoff);
  return filtered.length >= 2 ? filtered : timeline.slice(-Math.max(2, Math.min(timeline.length, months * 2)));
}

// ─── Aggregate question outcomes from subject rows ─────────────────────────
export function questionOutcomes(subjects: SprintAnalytics["subjectPerformance"]) {
  return subjects.reduce(
    (acc, s) => {
      acc.correct += s.correct || 0;
      acc.incorrect += s.incorrect || 0;
      acc.skipped += Math.max(0, (s.totalQuestions || 0) - (s.attempted || 0));
      acc.total += s.totalQuestions || 0;
      return acc;
    },
    { correct: 0, incorrect: 0, skipped: 0, total: 0 },
  );
}

export const SUBJECT_ORDER = ["physics", "chemistry", "biology"];
export const orderSubjects = <T extends { subject: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => SUBJECT_ORDER.indexOf(a.subject?.toLowerCase()) - SUBJECT_ORDER.indexOf(b.subject?.toLowerCase()));

export const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const pct1 = (v: unknown) => `${num(v).toFixed(1)}%`;
export const pct0 = (v: unknown) => `${num(v).toFixed(0)}%`;
