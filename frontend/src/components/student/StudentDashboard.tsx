"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import { studentService, adminService } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import {
  IconBook, IconChart, IconClock, IconCheck,
  IconChevronRight, IconRefresh,
  Spinner, MiniStatCard, StatusBadge, CardSkeleton,
  ToastContainer, type Toast,
} from "../common/UIComponents";
import { ProbabilitySurveyModal } from "./ProbabilitySurveyModal";
import { SprintAnalyticsDashboard } from "./SprintAnalyticsDashboard";
import { ReportsPanel } from "./ReportsPanel";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";
import { AttemptAnalyticsView } from "./AttemptAnalyticsView";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const I = {
  Home: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Test: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  History: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Analytics: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Reports: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Profile: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Logout: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Menu: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Close: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Bell: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Target: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Zap: ({ c = "w-5 h-5" }: { c?: string }) => (
    <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = "home" | "tests" | "history" | "analytics" | "reports" | "profile";

interface Props {
  onStartExam: (examId: string, examTitle: string, durationMinutes: number) => void;
  onViewAttempt: (attemptId: string) => void;
  onLogout: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function StudentDashboard({ onStartExam, onViewAttempt, onLogout }: Props) {
  const { user } = useAuthStore();
  const uid = useId();

  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("home");
  const [viewingAttemptId, setViewingAttemptId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Data
  const [activeSprint, setActiveSprint] = useState<Record<string, unknown> | null>(null);
  const [examsList, setExamsList] = useState<Record<string, unknown>[]>([]);
  const [attemptsList, setAttemptsList] = useState<Record<string, unknown>[]>([]);
  const [coverageData, setCoverageData] = useState<Record<string, unknown> | null>(null);
  const [probabilityData, setProbabilityData] = useState<Record<string, unknown> | null>(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = `${uid}-${Date.now()}`;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, [uid]);

  const removeToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const spRes = await adminService.getActiveSprint().catch(() => null);
      const sp = spRes?.data?.sprint || spRes?.sprint || spRes?.data || spRes;
      if (sp && typeof sp === "object" && !Array.isArray(sp)) {
        const s = sp as Record<string, unknown>;
        setActiveSprint(s);
        const sid = String(s._id || s.id || "");
        const [exR, covR, probR] = await Promise.allSettled([
          studentService.getMyExams(),
          sid ? studentService.getSyllabusCoverageMe(sid) : Promise.resolve(null),
          sid ? studentService.getProbabilitySprint(sid) : Promise.resolve(null),
        ]);
        if (exR.status === "fulfilled") {
          const raw = exR.value?.data?.exams || exR.value?.exams || exR.value?.data || exR.value || [];
          setExamsList(Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []);
        }
        if (covR.status === "fulfilled" && covR.value) {
          const c = covR.value?.data?.coverage || covR.value?.data || covR.value;
          setCoverageData(c && typeof c === "object" ? (c as Record<string, unknown>) : null);
        }
        if (probR.status === "fulfilled" && probR.value) {
          const p = probR.value?.data?.probability || probR.value?.data || probR.value;
          setProbabilityData(p && typeof p === "object" ? (p as Record<string, unknown>) : null);
        }
      } else {
        const exR = await studentService.getMyExams().catch(() => null);
        if (exR) {
          const raw = exR?.data?.exams || exR?.exams || exR?.data || exR || [];
          setExamsList(Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []);
        }
      }
      const attR = await studentService.getMyAttempts().catch(() => null);
      const rawA = attR?.data?.attempts || attR?.attempts || attR?.data || attR || [];
      setAttemptsList(Array.isArray(rawA) ? (rawA as Record<string, unknown>[]) : []);
    } catch (e) {
      console.error("[Dashboard] load error:", e);
      if (!silent) addToast("error", "Failed to load dashboard data. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const sylPct = Number(coverageData?.syllabusCoverage ?? 0).toFixed(0);
  const conPct = Number(coverageData?.conceptCoverage ?? 0).toFixed(0);
  const probScore = Number(probabilityData?.readinessIndex ?? 0).toFixed(0);
  const submitted = attemptsList.filter(a => String(a.status || "").toLowerCase() === "submitted");
  const sprintId = String(activeSprint?._id || activeSprint?.id || "");
  const sprintName = String(activeSprint?.name || "Active Sprint");
  const pending = examsList.filter(e => {
    const att = e.attempt as Record<string, unknown> | null | undefined;
    return !att || String(att.status || "") === "in_progress";
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  const go = (s: Section) => {
    setViewingAttemptId(null);
    setSection(s);
    setDrawerOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewAttemptInternal = (attId: string) => {
    setViewingAttemptId(attId);
    if (onViewAttempt) onViewAttempt(attId);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Nav items ──────────────────────────────────────────────────────────────
  type NavItem = { id: Section; label: string; shortLabel: string; Icon: React.ComponentType<{ c?: string }>; badge?: number };
  const NAV: NavItem[] = [
    { id: "home", label: "Dashboard", shortLabel: "Home", Icon: I.Home },
    { id: "tests", label: "My Tests", shortLabel: "Tests", Icon: I.Test, badge: pending.length || undefined },
    { id: "history", label: "Attempt History", shortLabel: "History", Icon: I.History, badge: submitted.length || undefined },
    { id: "analytics", label: "Sprint Analytics", shortLabel: "Analytics", Icon: I.Analytics },
    { id: "reports", label: "Reports", shortLabel: "Reports", Icon: I.Reports },
    { id: "profile", label: "Profile", shortLabel: "Profile", Icon: I.Profile },
  ];

  // ── Sidebar content ────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-[18px] border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0 select-none">EN</div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 leading-tight">Exam Neeti</p>
            <p className="text-[10px] font-semibold text-slate-400 leading-tight">NEET Student Portal</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {NAV.map(({ id, label, Icon, badge }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer select-none group ${active
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon c={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${active ? "" : ""}`} />
                <span className="truncate">{label}</span>
              </span>
              {!!badge && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0 tabular-nums ${active ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-2 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0 select-none">
            {(user?.name || "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-slate-900 truncate leading-tight">{user?.name || "Student"}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email || ""}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer"
        >
          <I.Logout c="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  // ── Bottom mobile nav ──────────────────────────────────────────────────────
  const BOTTOM_NAV: NavItem[] = NAV.slice(0, 5); // Home, Tests, History, Analytics, Reports

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f3f5f9] antialiased text-slate-900">

      {/* ── Desktop sidebar (fixed, always visible) ────────────── */}
      <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col bg-white border-r border-slate-200/80 fixed inset-y-0 left-0 z-30 shadow-sm">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer backdrop ─────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[82vw] bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <I.Close c="w-4 h-4" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-60 xl:ml-64 min-w-0 overflow-x-hidden">

        {/* Mobile top header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2">
            {/* Left: hamburger + brand */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
                aria-label="Open menu"
              >
                <I.Menu c="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-[10px] flex items-center justify-center shadow shrink-0 select-none">EN</div>
                <span className="text-sm font-black text-slate-900 truncate">Exam Neeti</span>
              </div>
            </div>

            {/* Right: current section pill + assessment button */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden xs:inline-block text-[10px] font-extrabold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-1 rounded-lg truncate max-w-[80px]">
                {NAV.find(n => n.id === section)?.shortLabel}
              </span>
              <button
                onClick={() => setShowSurvey(true)}
                disabled={!sprintId}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Assessment
              </button>
            </div>
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────── */}
        <main className="flex-1 w-full pb-20 lg:pb-0 min-w-0 overflow-x-hidden">
          <div className="max-w-5xl xl:max-w-6xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5 min-w-0 overflow-x-hidden">

            {viewingAttemptId ? (
              <AttemptAnalyticsView
                attemptId={viewingAttemptId}
                onBack={() => setViewingAttemptId(null)}
              />
            ) : (
              <>
                {section === "home" && (
                  <HomeSection
                    user={user}
                    loading={loading}
                    sprintName={sprintName}
                    sprintId={sprintId}
                    probScore={probScore}
                    sylPct={sylPct}
                    conPct={conPct}
                    probabilityData={probabilityData}
                    submitted={submitted}
                    activeSprint={activeSprint}
                    examsList={examsList}
                    onGoSection={go}
                    onViewAttempt={handleViewAttemptInternal}
                    onSurvey={() => setShowSurvey(true)}
                    onRefresh={() => {
                      load(true);
                      addToast("info", "Dashboard refreshed.");
                    }}
                  />
                )}

                {section === "tests" && (
                  <TestsSection
                    loading={loading}
                    sprintName={sprintName}
                    activeSprint={activeSprint}
                    examsList={examsList}
                    attemptsList={attemptsList}
                    onStartExam={onStartExam}
                    onViewAttempt={handleViewAttemptInternal}
                  />
                )}

                {section === "history" && (
                  <HistorySection
                    loading={loading}
                    attemptsList={attemptsList}
                    onViewAttempt={handleViewAttemptInternal}
                  />
                )}

                {section === "analytics" && (
                  <SprintAnalyticsDashboard sprintId={sprintId} sprintName={sprintName} onBack={() => go("home")} onViewAttempt={handleViewAttemptInternal} />
                )}

                {section === "reports" && (
                  sprintId
                    ? <ReportsPanel sprintId={sprintId} onBack={() => go("home")} />
                    : <EmptySection label="Reports" desc="Reports will be available once a sprint is active." Icon={I.Reports} />
                )}

                {section === "profile" && (
                  <ProfileSettingsPanel onBack={() => go("home")} />
                )}
              </>
            )}

          </div>
        </main>

        {/* ── Mobile bottom navigation bar ────────────────────── */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          aria-label="Bottom navigation"
        >
          <div className="flex items-stretch h-16">
            {BOTTOM_NAV.map(({ id, shortLabel, Icon, badge }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  onClick={() => go(id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 pb-2 transition-colors cursor-pointer select-none relative ${active ? "text-indigo-600" : "text-slate-400 hover:text-slate-700"
                    }`}
                >
                  {/* Active indicator pill */}
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-600" />
                  )}
                  <div className="relative">
                    <Icon c="w-5 h-5" />
                    {!!badge && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums leading-none">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold leading-none ${active ? "text-indigo-600" : "text-slate-400"}`}>
                    {shortLabel}
                  </span>
                </button>
              );
            })}

            {/* Profile — last item */}
            <button
              onClick={() => go("profile")}
              aria-current={section === "profile" ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 pb-2 transition-colors cursor-pointer select-none relative ${section === "profile" ? "text-indigo-600" : "text-slate-400 hover:text-slate-700"
                }`}
            >
              {section === "profile" && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-600" />
              )}
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 select-none">
                {(user?.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <span className={`text-[10px] font-bold leading-none ${section === "profile" ? "text-indigo-600" : "text-slate-400"}`}>
                Profile
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* Survey modal */}
      {sprintId && (
        <ProbabilitySurveyModal
          isOpen={showSurvey}
          onClose={() => setShowSurvey(false)}
          sprintId={sprintId}
          initialData={probabilityData}
          onSuccess={() => {
            setShowSurvey(false);
            load(true);
            addToast("success", "Chapter assessment submitted successfully.");
          }}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME SECTION
// ─────────────────────────────────────────────────────────────────────────────
function HomeSection({
  user, loading, sprintName, sprintId, probScore, sylPct, conPct, probabilityData,
  submitted, activeSprint, examsList, onGoSection, onViewAttempt, onSurvey, onRefresh,
}: {
  user: { name?: string; email?: string } | null;
  loading: boolean;
  sprintName: string;
  sprintId: string;
  probScore: string;
  sylPct: string;
  conPct: string;
  probabilityData?: Record<string, unknown> | null;
  submitted: Record<string, unknown>[];
  activeSprint: Record<string, unknown> | null;
  examsList: Record<string, unknown>[];
  onGoSection: (s: Section) => void;
  onViewAttempt: (id: string) => void;
  onSurvey: () => void;
  onRefresh: () => void;
}) {
  // Calculate real performance metrics from submitted attempts
  let highestScoreVal = 0;
  let totalMaxMarks = 720;
  let accuracySum = 0;
  let accuracyCount = 0;

  submitted.forEach((att) => {
    const sc = Number(att.score ?? att.obtainedMarks ?? att.totalScore ?? 0);
    const max = Number(att.totalMarks ?? (att.exam as Record<string, unknown>)?.totalMarks ?? 720);
    if (sc > highestScoreVal) {
      highestScoreVal = sc;
      totalMaxMarks = max;
    }

    const acc = Number(att.accuracy ?? att.overallAccuracy ?? 0);
    if (acc > 0) {
      accuracySum += acc;
      accuracyCount++;
    }
  });

  const avgAccStr = accuracyCount > 0 ? `${(accuracySum / accuracyCount).toFixed(1)}%` : (submitted.length > 0 ? "0%" : "0%");
  const bestScoreStr = submitted.length > 0 ? `${highestScoreVal}/${totalMaxMarks}` : "0/720";
  const probValStr = probScore && probScore !== "0" ? `${probScore}%` : (submitted.length > 0 ? avgAccStr : "0%");
  const sylValStr = sylPct && sylPct !== "0" ? `${sylPct}%` : (conPct && conPct !== "0" ? `${conPct}%` : "0%");

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-5 sm:p-7 lg:p-8 text-white shadow-xl shadow-indigo-900/20">
        <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-indigo-100 bg-white/15 px-2.5 py-1 rounded-full border border-white/20">
                  NEET Candidate Workspace
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-200 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-300/30">
                  <I.Target c="w-3 h-3 text-amber-300" /> Target Exam: NEET UG
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-tight">
                Welcome back, {user?.name?.split(" ")[0] || "Student"}
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100 font-medium opacity-90">
                Track your preparation level, diagnostic scores, and chapter accuracy in real-time.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                onClick={onSurvey}
                disabled={!sprintId}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <IconBook className="w-3.5 h-3.5" />Chapter Assessment
              </button>
              <button
                onClick={onRefresh}
                className="p-2.5 bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                title="Refresh dashboard"
                aria-label="Refresh dashboard"
              >
                <IconRefresh className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStatCard
            title="Readiness"
            value={probValStr}
            subtitle={probScore && probScore !== "0" ? "NEET Probability" : "Average Accuracy"}
            icon={IconChart}
            ringValue={Number(probValStr.replace("%", "")) || 0}
            trend={
              probScore !== "0"
                ? `${Number(probabilityData?.assessedCount || (probabilityData?.chapters as unknown[])?.length || 0)} of 86 chapters assessed`
                : (submitted.length > 0 ? "From test attempts" : undefined)
            }
          />
          <MiniStatCard
            title="Syllabus"
            value={sylValStr}
            subtitle="Covered Chapters"
            icon={IconBook}
            ringValue={Number(sylValStr.replace("%", "")) || 0}
          />
          <MiniStatCard
            title="Best Score"
            value={bestScoreStr}
            subtitle="Highest Attempt Mark"
            icon={IconCheck}
          />
          <MiniStatCard
            title="Tests Done"
            value={submitted.length}
            subtitle="Submitted Attempts"
            icon={IconClock}
          />
        </div>
      )}

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { Icon: I.Analytics, label: "Sprint Analytics", desc: "Performance across all tests", cls: "text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100", s: "analytics" as Section, dis: !sprintId || submitted.length === 0, hint: "Complete a test to unlock" },
          { Icon: I.Reports, label: "Download Reports", desc: "Generate PDF or Excel reports", cls: "text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100", s: "reports" as Section, dis: !sprintId, hint: "Requires an active sprint" },
          { Icon: I.Profile, label: "Profile & Settings", desc: "Update info, change password", cls: "text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100", s: "profile" as Section, dis: false },
        ].map(({ Icon, label, desc, cls, s, dis, hint }) => (
          <button
            key={label}
            onClick={() => onGoSection(s)}
            disabled={dis}
            title={dis && hint ? hint : undefined}
            className={`relative flex items-start gap-3 p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98] ${cls}`}
          >
            <div className="mt-0.5 shrink-0"><Icon c="w-5 h-5" /></div>
            <div className="min-w-0 flex-1 pr-4">
              <p className="text-sm font-extrabold leading-tight">{label}</p>
              <p className="text-[11px] font-medium mt-0.5 opacity-75 leading-snug">{desc}</p>
            </div>
            <IconChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-hover:opacity-70 transition-opacity shrink-0" />
          </button>
        ))}
      </div>

      {/* Recent results */}
      {!loading && submitted.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-black text-slate-900">Recent Results</h2>
            <button
              onClick={() => onGoSection("history")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors shrink-0"
            >
              View All
            </button>
          </div>
          <div className="px-4 sm:px-6 py-2 divide-y divide-slate-50">
            {submitted.slice(0, 4).map(att => (
              <AttemptRow key={String(att._id || att.id)} att={att} onView={onViewAttempt} />
            ))}
          </div>
        </div>
      )}

      {/* No tests placeholder */}
      {!loading && activeSprint && examsList.length === 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
            <I.Test c="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">No tests scheduled yet</p>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            Tests will appear once your admin publishes them for <span className="font-bold text-slate-600">{sprintName}</span>.
          </p>
        </div>
      )}

      {/* No sprint placeholder */}
      {!loading && !activeSprint && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <I.Bell c="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">No Active Sprint</p>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            Your dashboard will show tests and analytics once an admin activates a sprint for your batch.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function TestsSection({
  loading, sprintName, activeSprint, examsList, attemptsList, onStartExam, onViewAttempt,
}: {
  loading: boolean;
  sprintName: string;
  activeSprint: Record<string, unknown> | null;
  examsList: Record<string, unknown>[];
  attemptsList: Record<string, unknown>[];
  onStartExam: (id: string, title: string, dur: number) => void;
  onViewAttempt: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 sm:pt-7 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
        <div className="min-w-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Current Program</span>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 truncate">{loading ? "Loading..." : sprintName}</h2>
        </div>
        {!loading && activeSprint && <StatusBadge status={String(activeSprint.status || "Active")} />}
      </div>
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Available Tests &amp; Schedule</p>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : examsList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {examsList.map(exam => (
              <ExamCard
                key={String(exam._id || exam.id)}
                exam={exam}
                attemptsList={attemptsList}
                onStartExam={onStartExam}
                onViewAttempt={onViewAttempt}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <I.Test c="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">No tests scheduled for your batch yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAM CARD
// ─────────────────────────────────────────────────────────────────────────────
function ExamCard({
  exam, attemptsList, onStartExam, onViewAttempt,
}: {
  exam: Record<string, unknown>;
  attemptsList: Record<string, unknown>[];
  onStartExam: (id: string, title: string, dur: number) => void;
  onViewAttempt: (id: string) => void;
}) {
  const id = String(exam._id || exam.id);
  const title = String(exam.title || "NEET Test");
  const dur = Number(exam.durationMinutes || 180);
  const totalQ = Number(exam.totalQuestions || (Array.isArray(exam.questions) ? (exam.questions as unknown[]).length : 0) || 0);
  const status = String(exam.status || "published").toLowerCase();
  const att = exam.attempt as Record<string, unknown> | null | undefined;
  const attSt = att ? String(att.status || "").toLowerCase() : null;
  const done = attSt === "submitted";
  const inProg = attSt === "in_progress";
  const draft = status === "draft";
  const score = att?.score != null ? Number(att.score) : null;
  const tMarks = Number(att?.totalMarks ?? exam?.totalMarks ?? 720);
  const pct = att?.percentage != null ? `${Number(att.percentage).toFixed(0)}%` : null;

  let btnLabel = "Start Test";
  let btnCls = "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20";
  if (done) { btnLabel = "View Results"; btnCls = "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"; }
  if (inProg) { btnLabel = "Resume"; btnCls = "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20"; }

  const handle = () => {
    if (done) {
      const found = attemptsList.find(a => String((a.exam as Record<string, unknown>)?._id || a.exam) === id);
      if (found) onViewAttempt(String(found._id || found.id));
      else if (att?._id) onViewAttempt(String(att._id));
    } else {
      onStartExam(id, title, dur);
    }
  };

  return (
    <div className="group p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col gap-3 hover:bg-white hover:border-indigo-300 hover:shadow-lg transition-all duration-300 active:scale-[0.99]">
      <div className="flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors leading-tight">{title}</h4>
            {done && <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black border border-emerald-200">Submitted</span>}
            {inProg && <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black border border-amber-200 animate-pulse">In Progress</span>}
            {draft && <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">Coming Soon</span>}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold">
            {dur}&nbsp;min{totalQ > 0 && <>&nbsp;&bull;&nbsp;{totalQ}&nbsp;questions</>}
          </p>
          {done && score != null && (
            <p className="text-[11px] font-bold">
              Score: <span className="text-emerald-600 font-extrabold">{score}</span>
              <span className="text-slate-400">/{tMarks}</span>
              {pct && <span className="text-slate-400 ml-1">({pct})</span>}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handle}
        disabled={draft}
        className={`w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98] ${btnCls}`}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY SECTION
// ─────────────────────────────────────────────────────────────────────────────
function HistorySection({
  loading, attemptsList, onViewAttempt,
}: {
  loading: boolean;
  attemptsList: Record<string, unknown>[];
  onViewAttempt: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-black text-slate-900">Attempt History</h2>
        {attemptsList.length > 0 && (
          <span className="text-[10px] font-extrabold text-slate-400 shrink-0">
            {attemptsList.length} record{attemptsList.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="px-4 sm:px-6 py-4 space-y-2.5">
        {loading ? (
          [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
        ) : attemptsList.length > 0 ? (
          attemptsList.map(att => {
            const attId = String(att._id || att.id);
            const score = Number(att.score ?? 0);
            const maxScore = Number(att.totalMarks ?? att.maxScore ?? (att.exam as Record<string, unknown>)?.totalMarks ?? 720);
            const pct = maxScore > 0 ? ((score / maxScore) * 100).toFixed(0) : "0";
            const status = String(att.status || "submitted");
            const date = att.submittedAt || att.createdAt
              ? new Date(String(att.submittedAt || att.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "Recent";
            const examTitle = String((att.exam as Record<string, unknown>)?.title || "NEET Test");
            const ratio = score / maxScore;
            const sc = ratio >= 0.65 ? "text-emerald-600" : ratio >= 0.4 ? "text-amber-600" : "text-red-600";
            return (
              <div key={attId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">{examTitle}</h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-semibold">
                    <span>{date}</span>
                    <span>&bull;</span>
                    <span>Score: <strong className={`font-extrabold ${sc}`}>{score}</strong><span className="text-slate-400">/{maxScore}</span></span>
                    <span className="text-slate-400">({pct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={status} />
                  <button
                    onClick={() => onViewAttempt(attId)}
                    className="flex items-center gap-1 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
                  >
                    Analysis <IconChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
            <I.History c="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">No attempts yet. Start a test to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTEMPT ROW (home recent results)
// ─────────────────────────────────────────────────────────────────────────────
function AttemptRow({ att, onView }: { att: Record<string, unknown>; onView: (id: string) => void }) {
  const id = String(att._id || att.id);
  const score = Number(att.score ?? 0);
  const maxScore = Number(att.totalMarks ?? att.maxScore ?? (att.exam as Record<string, unknown>)?.totalMarks ?? 720);
  const pct = maxScore > 0 ? ((score / maxScore) * 100).toFixed(0) : "0";
  const title = String((att.exam as Record<string, unknown>)?.title || "NEET Test");
  const date = att.submittedAt
    ? new Date(String(att.submittedAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const ratio = score / maxScore;
  const sc = ratio >= 0.65 ? "text-emerald-600" : ratio >= 0.4 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 -mx-1 px-1 rounded-xl transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 truncate">{title}</p>
        <p className="text-[10px] font-semibold text-slate-400">{date}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right tabular-nums">
          <span className={`text-sm font-extrabold ${sc}`}>{score}</span>
          <span className="text-xs text-slate-400 font-semibold">/{maxScore}</span>
          <p className="text-[10px] text-slate-400">{pct}%</p>
        </div>
        <button
          onClick={() => onView(id)}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap active:scale-[0.97]"
        >
          View
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE (no sprint)
// ─────────────────────────────────────────────────────────────────────────────
function EmptySection({ label, desc, Icon }: {
  label: string;
  desc: string;
  Icon: React.ComponentType<{ c?: string }>;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-10 sm:p-14 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
        <Icon c="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-700">{label} Unavailable</p>
      <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">{desc}</p>
    </div>
  );
}
