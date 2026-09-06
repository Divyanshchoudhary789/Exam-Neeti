"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  IconChart, IconBook, IconClock, IconFileText, IconCheck, IconChevronRight,
  ToastContainer, type Toast, CustomSelectMenu, IconTarget,
} from "../../common/UIComponents";
import { ProbabilitySurveyModal } from "../ProbabilitySurveyModal";
import { UpgradeModal } from "../UpgradeModal";
import { AttemptAnalyticsView } from "../AttemptAnalyticsView";
import { ReportsPanel } from "../ReportsPanel";
import { ProfileSettingsPanel } from "../ProfileSettingsPanel";
import { DrilldownProvider } from "./drilldown/DrilldownProvider";
import { useDashboardData } from "./useDashboardData";
import { OverviewSection } from "./OverviewSection";
import { AnalyticsHub } from "./analytics/AnalyticsHub";
import { TestsSection } from "./TestsSection";
import { HistorySection } from "./HistorySection";
import { EmptyState, SectionCard } from "../../common/DashboardUI";
import { num } from "./lib";
import type { ExamStartMeta, SectionId } from "./types";

interface Props {
  onStartExam: (examId: string, examTitle: string, durationMinutes: number, meta?: ExamStartMeta) => void;
  onViewAttempt: (attemptId: string) => void;
  onLogout: () => void;
}

const NAV: { id: SectionId; label: string; short: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", short: "Home", Icon: IconChart },
  { id: "analytics", label: "Analytics", short: "Analytics", Icon: IconChart },
  { id: "tests", label: "My Tests", short: "Tests", Icon: IconBook },
  { id: "history", label: "History", short: "History", Icon: IconClock },
  { id: "reports", label: "Reports", short: "Reports", Icon: IconFileText },
  { id: "profile", label: "Profile", short: "Profile", Icon: IconCheck },
];

const SECTION_TITLE: Record<SectionId, string> = {
  overview: "Dashboard",
  analytics: "Analytics",
  tests: "My Tests",
  history: "Attempt History",
  reports: "Reports",
  profile: "Profile & Settings",
};

export function StudentDashboard({ onStartExam, onViewAttempt, onLogout }: Props) {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const uid = useId();
  const data = useDashboardData();
  const { selectedSprintId, selectedSprint, sprints, setSelectedSprintId, pendingCount, analytics, probability, subscription, access } = data;

  const [section, setSection] = useState<SectionId>("overview");
  const [viewingAttemptId, setViewingAttemptId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradePlanKey, setUpgradePlanKey] = useState<string | undefined>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = `${uid}-${Date.now()}`;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, [uid]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    if (!plan) return;
    // One-time read of a deep-link param → open the upgrade modal.
    setUpgradePlanKey(plan);
    setShowUpgrade(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
  }, [searchParams]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (s: SectionId) => {
    setViewingAttemptId(null);
    setSection(s);
    setDrawerOpen(false);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewAttempt = (attId: string) => {
    setViewingAttemptId(attId);
    onViewAttempt?.(attId);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const readiness = num(probability?.readinessIndex);
  const sprintId = selectedSprintId;
  const sprintName = String(selectedSprint?.name || "Active Sprint");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-[17px] border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0">EN</div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 leading-tight">Exam Neeti</p>
            <p className="text-[10px] font-semibold text-slate-400 leading-tight">NEET Student Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = section === id && !viewingAttemptId;
          const badge = id === "tests" ? pendingCount : id === "history" ? analytics.summary?.totalTests : undefined;
          return (
            <button key={id} onClick={() => go(id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer group ${active ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              {!!badge && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums ${active ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-700"}`}>{badge > 99 ? "99+" : badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-slate-100 space-y-2 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0">{(user?.name || "S").slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-slate-900 truncate">{user?.name || "Student"}</p>
            <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email || ""}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <DrilldownProvider sprintId={sprintId} onViewAttempt={handleViewAttempt}>
      <div className="flex min-h-screen antialiased text-slate-900" style={{ background: "var(--dash-bg)" }}>
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col bg-white border-r border-slate-200/80 fixed inset-y-0 left-0 z-30 shadow-sm">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[82vw] bg-white shadow-2xl flex flex-col">
              {sidebarContent}
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-screen lg:ml-60 xl:ml-64 min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
            <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5">
              <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0" aria-label="Open menu">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <h1 className="hidden lg:block font-black text-slate-900 truncate text-base shrink-0 mr-auto">
                {viewingAttemptId ? "Test Analysis" : SECTION_TITLE[section]}
              </h1>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 lg:flex-none justify-end">
                {sprints.length > 0 && (
                  <div className="min-w-0 flex-1 max-w-[190px] lg:max-w-[210px]">
                    <CustomSelectMenu
                      value={selectedSprintId}
                      onChange={(v) => setSelectedSprintId(v)}
                      options={sprints.map((s) => ({
                        value: String(s._id || s.id),
                        label: String(s.name || "Sprint"),
                        sublabel: s.isActive ? "Active sprint" : "Past sprint",
                        badge: (s.attemptCount || 0) > 0 ? `${s.attemptCount}` : undefined,
                      }))}
                      icon={IconTarget}
                      buttonClassName="!py-1.5 !rounded-xl !text-[11px] sm:!text-xs"
                    />
                  </div>
                )}
                {readiness > 0 && (
                  <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                    {readiness.toFixed(0)}% ready
                  </span>
                )}
                <button onClick={() => setShowSurvey(true)} disabled={!sprintId}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0">
                  <span className="hidden sm:inline">Chapter </span>Assessment
                </button>
                <div className="relative shrink-0" ref={menuRef}>
                  <button onClick={() => setMenuOpen((o) => !o)} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center cursor-pointer" aria-label="Profile menu">
                    {(user?.name || "S").slice(0, 1).toUpperCase()}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-30">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-black text-slate-900 truncate">{user?.name || "Student"}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                      </div>
                      <button onClick={() => go("profile")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Profile &amp; Settings</button>
                      <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50">Sign Out</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 w-full pb-24 lg:pb-8 min-w-0 overflow-x-hidden">
            <div className="max-w-5xl xl:max-w-6xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 space-y-4 min-w-0">
              {!viewingAttemptId && subscription && <SubscriptionBanner subscription={subscription} access={access} onUpgrade={() => { setUpgradePlanKey(undefined); setShowUpgrade(true); }} />}

              {viewingAttemptId ? (
                <AttemptAnalyticsView attemptId={viewingAttemptId} onBack={() => setViewingAttemptId(null)} />
              ) : data.error ? (
                <SectionCard><EmptyState icon={IconChart} title="Something went wrong" desc={data.error} action={<button onClick={() => data.refresh()} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Retry</button>} /></SectionCard>
              ) : !sprintId && !data.loading ? (
                <SectionCard><EmptyState icon={IconChart} title="No active sprint" desc="Your dashboard unlocks once an admin activates a sprint for your batch and you take a test." /></SectionCard>
              ) : (
                <>
                  {section === "overview" && (
                    <OverviewSection data={data} user={user} onGoSection={go} onViewAttempt={handleViewAttempt} onOpenSurvey={() => setShowSurvey(true)} />
                  )}
                  {section === "analytics" && <AnalyticsHub data={data} onViewAttempt={handleViewAttempt} />}
                  {section === "tests" && <TestsSection sprintId={sprintId} sprintName={sprintName} onStartExam={onStartExam} onViewAttempt={handleViewAttempt} onUpgrade={() => { setUpgradePlanKey(undefined); setShowUpgrade(true); }} />}
                  {section === "history" && <HistorySection onViewAttempt={handleViewAttempt} />}
                  {section === "reports" && (sprintId ? <div className="animate-dash-in"><ReportsPanel sprintId={sprintId} onBack={() => go("overview")} /></div> : <SectionCard><EmptyState icon={IconFileText} title="Reports unavailable" desc="Reports need an active sprint." /></SectionCard>)}
                  {section === "profile" && <div className="animate-dash-in"><ProfileSettingsPanel onBack={() => go("overview")} /></div>}
                </>
              )}
            </div>
          </main>

          {/* Mobile bottom nav */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-safe">
            <div className="flex items-stretch h-16">
              {NAV.slice(0, 5).map(({ id, short, Icon }) => {
                const active = section === id && !viewingAttemptId;
                return (
                  <button key={id} onClick={() => go(id)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 pb-2 transition-colors cursor-pointer relative ${active ? "text-indigo-600" : "text-slate-400"}`}>
                    {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-600" />}
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold leading-none">{short}</span>
                  </button>
                );
              })}
              <button onClick={() => go("profile")} className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 pb-2 cursor-pointer relative ${section === "profile" ? "text-indigo-600" : "text-slate-400"}`}>
                {section === "profile" && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-600" />}
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-[10px] flex items-center justify-center">{(user?.name || "S").slice(0, 1).toUpperCase()}</div>
                <span className="text-[10px] font-bold leading-none">Profile</span>
              </button>
            </div>
          </nav>
        </div>

        {sprintId && (
          <ProbabilitySurveyModal
            isOpen={showSurvey}
            onClose={() => setShowSurvey(false)}
            sprintId={sprintId}
            initialData={probability}
            onSuccess={() => { setShowSurvey(false); data.refresh(); addToast("success", "Chapter assessment submitted."); }}
          />
        )}
        <UpgradeModal open={showUpgrade} initialPlanKey={upgradePlanKey} onClose={() => setShowUpgrade(false)} onActivated={() => { data.refresh(); addToast("success", "Your plan is active."); }} />
        <ToastContainer toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </div>
    </DrilldownProvider>
  );
}

function SubscriptionBanner({ subscription, access, onUpgrade }: { subscription: NonNullable<ReturnType<typeof useDashboardData>["subscription"]>; access: ReturnType<typeof useDashboardData>["access"]; onUpgrade: () => void }) {
  if (!subscription) return null;
  const status = subscription.status;
  const planName = subscription.plan?.name || access?.plan?.name || (status === "trial" ? "Free Trial" : "Plan");
  const expires = (access?.expiresAt || subscription.expiresAt) ? new Date(access?.expiresAt || subscription.expiresAt!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
  const trialCopy = access?.capped
    ? `${access.remaining ?? 0} of ${access.testsIncluded} free test${access.testsIncluded === 1 ? "" : "s"} remaining. Upgrade anytime for the full test series.`
    : "1 free diagnostic test is available. Upgrade anytime for full access.";
  const copy = status === "active" ? `${planName} active${expires ? ` until ${expires}` : ""}.`
    : status === "expired" ? "Your plan has expired. Renew to continue full access."
    : trialCopy;
  const cls = status === "active" ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : status === "expired" ? "bg-red-50 border-red-200 text-red-900"
    : "bg-indigo-50 border-indigo-200 text-indigo-900";
  return (
    <div className={`rounded-2xl border px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cls}`}>
      <div className="min-w-0">
        <p className="text-sm font-black leading-tight">{copy}</p>
        <p className="text-[11px] font-semibold opacity-75 mt-1">Access continues through your current batch-based test schedule.</p>
      </div>
      {status !== "active" && (
        <button onClick={onUpgrade} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-slate-900 px-4 py-2.5 text-xs font-bold border border-white/80 shadow-sm hover:bg-slate-50 cursor-pointer shrink-0">
          Upgrade <IconChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
