"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  IconChart, IconClock, IconFileText, IconChevronRight,
  ToastContainer, type Toast, CustomSelectMenu, IconTarget, IconRocket, IconShield,
  IconLayers, IconTrendingUp, IconClipboard, IconUserCheck,
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
  { id: "overview", label: "Overview", short: "Home", Icon: IconLayers },
  { id: "analytics", label: "Analytics", short: "Analytics", Icon: IconTrendingUp },
  { id: "tests", label: "My Tests", short: "Tests", Icon: IconClipboard },
  { id: "history", label: "History", short: "History", Icon: IconClock },
  { id: "reports", label: "Reports", short: "Reports", Icon: IconFileText },
  { id: "profile", label: "Profile", short: "Profile", Icon: IconUserCheck },
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
  const { selectedSprintId, sprints, setSelectedSprintId, pendingCount, analytics, probability, subscription, access } = data;

  const [section, setSection] = useState<SectionId>("overview");
  const [viewingAttemptId, setViewingAttemptId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradePlanKey, setUpgradePlanKey] = useState<string | undefined>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Desktop sidebar collapse — remembered per browser.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("student-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("student-sidebar-collapsed", next ? "1" : "0"); } catch { /* private mode */ }
      return next;
    });
  }, []);

  // Track the lg breakpoint so the content margin can animate in lock-step with
  // the fixed sidebar (a `position: fixed` element isn't a flex item, so the
  // layout can't do this on its own). Width/margin are driven by inline px so
  // the CSS transition interpolates cleanly (Tailwind's `w-*` calc() values and
  // `transition-[width]` don't animate reliably).
  const [isLgUp, setIsLgUp] = useState<boolean>(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsLgUp(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const SIDEBAR_W = collapsed ? 76 : 256;
  const sbTransition = "width 260ms cubic-bezier(0.4, 0, 0.2, 1)";

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

  const openUpgrade = () => { setUpgradePlanKey(undefined); setShowUpgrade(true); };

  const brandMark = (
    <span className="w-9 h-9 rounded-xl bg-white ring-1 ring-slate-200 shadow-sm p-1 flex items-center justify-center shrink-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Exam Neeti" className="w-full h-full object-contain" />
    </span>
  );
  const collapseToggle = (mini: boolean) => (
    <button
      onClick={toggleCollapsed}
      title={mini ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
      className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
    >
      <svg className={`w-4 h-4 ${mini ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l-7 7 7 7M18 5l-7 7 7 7" /></svg>
    </button>
  );

  const renderSidebar = (mini: boolean) => (
    <div className="flex flex-col h-full">
      <div className={`border-b border-slate-100 shrink-0 ${mini ? "px-2 py-3 flex flex-col items-center gap-2" : "px-4 py-3 flex items-center gap-2.5"}`}>
        {mini ? (
          <>
            {brandMark}
            {collapseToggle(true)}
          </>
        ) : (
          <>
            {brandMark}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900 leading-tight truncate">Exam Neeti</p>
              <p className="text-[10px] font-semibold text-slate-400 leading-tight truncate">NEET Student Portal</p>
            </div>
            {collapseToggle(false)}
          </>
        )}
      </div>

      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${mini ? "px-2" : "px-3"}`}>
        {NAV.map(({ id, label, Icon }) => {
          const active = section === id && !viewingAttemptId;
          const badge = id === "tests" ? pendingCount : id === "history" ? analytics.summary?.totalTests : undefined;
          return (
            <button key={id} onClick={() => go(id)} title={mini ? label : undefined}
              className={`w-full flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer group relative ${mini ? "justify-center h-10" : "justify-between gap-2 px-3 py-2.5"} ${active ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <span className={`flex items-center min-w-0 ${mini ? "" : "gap-2.5"}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!mini && <span className="truncate">{label}</span>}
              </span>
              {!!badge && (
                mini
                  ? <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${active ? "bg-white" : "bg-indigo-500"}`} />
                  : <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums ${active ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-700"}`}>{badge > 99 ? "99+" : badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-slate-100 shrink-0 space-y-2 py-3 ${mini ? "px-2" : "px-3"}`}>
        <PlanCard subscription={subscription} access={access} mini={mini} onUpgrade={openUpgrade} />

        {mini ? (
          <>
            <button onClick={() => go("profile")} title={user?.name || "Profile"}
              className="mx-auto w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-[11px] flex items-center justify-center">{(user?.name || "S").slice(0, 1).toUpperCase()}</span>
            </button>
            <button onClick={onLogout} title="Sign out"
              className="mx-auto w-10 h-10 rounded-xl text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => go("profile")} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer text-left">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shrink-0">{(user?.name || "S").slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-slate-900 truncate">{user?.name || "Student"}</span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">{user?.email || ""}</span>
              </span>
            </button>
            <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <DrilldownProvider sprintId={sprintId} onViewAttempt={handleViewAttempt}>
      <div className="flex min-h-screen antialiased text-slate-900" style={{ background: "var(--dash-bg)" }}>
        {/* Desktop sidebar */}
        <aside
          style={{ width: SIDEBAR_W, transition: sbTransition }}
          className="hidden lg:flex shrink-0 flex-col bg-white border-r border-slate-200/80 fixed inset-y-0 left-0 z-30 shadow-sm overflow-hidden"
        >
          {renderSidebar(collapsed)}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[82vw] bg-white shadow-2xl flex flex-col">
              {renderSidebar(false)}
            </aside>
          </div>
        )}

        <div
          style={{ marginLeft: isLgUp ? SIDEBAR_W : 0, transition: "margin-left 260ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          className="flex-1 flex flex-col min-h-screen min-w-0"
        >
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
            <div className={`${collapsed ? "max-w-6xl xl:max-w-7xl" : "max-w-5xl xl:max-w-6xl"} mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 space-y-4 min-w-0`}>
              {viewingAttemptId ? (
                <AttemptAnalyticsView attemptId={viewingAttemptId} onBack={() => setViewingAttemptId(null)} />
              ) : data.error ? (
                <SectionCard><EmptyState icon={IconChart} title="Something went wrong" desc={data.error} action={<button onClick={() => data.refresh()} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Retry</button>} /></SectionCard>
              ) : !sprintId && !data.loading && section !== "tests" && section !== "history" ? (
                <SectionCard><EmptyState icon={IconChart} title="No active sprint" desc="Your dashboard unlocks once an admin activates a sprint for your batch and you take a test. Your assigned tests are always available under My Tests." /></SectionCard>
              ) : (
                <>
                  {section === "overview" && (
                    <OverviewSection data={data} user={user} onGoSection={go} onViewAttempt={handleViewAttempt} onOpenSurvey={() => setShowSurvey(true)} />
                  )}
                  {section === "analytics" && <AnalyticsHub data={data} onViewAttempt={handleViewAttempt} />}
                  {section === "tests" && <TestsSection onStartExam={onStartExam} onViewAttempt={handleViewAttempt} onUpgrade={openUpgrade} />}
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

/**
 * Plan / access summary — lives in the student sidebar just above the user card.
 * `mini` renders a single icon button for the collapsed rail.
 */
function PlanCard({ subscription, access, mini, onUpgrade }: {
  subscription: ReturnType<typeof useDashboardData>["subscription"];
  access: ReturnType<typeof useDashboardData>["access"];
  mini: boolean;
  onUpgrade: () => void;
}) {
  const coaching = !subscription && access?.tier === "coaching";
  if (!subscription && !coaching) return null;

  const status = coaching ? "active" : subscription!.status;
  const isActive = status === "active";
  const planName = coaching
    ? "Coaching Access"
    : subscription!.plan?.name || access?.plan?.name || (status === "trial" ? "Free Trial" : "Your Plan");
  const statusLabel = coaching ? "Included" : isActive ? "Active" : status === "expired" ? "Expired" : status === "cancelled" ? "Cancelled" : "Free trial";

  const expiryRaw = access?.expiresAt || subscription?.expiresAt;
  const expires = expiryRaw ? new Date(expiryRaw).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
  const capped = !!access?.capped;
  const total = capped ? (access!.testsIncluded ?? 0) : 0;
  const remaining = capped ? (access!.remaining ?? 0) : 0;
  const used = Math.max(0, total - remaining);

  const theme = isActive
    ? { ring: "border-emerald-200 bg-emerald-50/60", tile: "bg-emerald-100 text-emerald-700", ink: "text-emerald-700", pill: "bg-emerald-600 text-white", bar: "bg-emerald-500", dot: "bg-emerald-500" }
    : status === "expired"
      ? { ring: "border-rose-200 bg-rose-50/60", tile: "bg-rose-100 text-rose-700", ink: "text-rose-700", pill: "bg-rose-600 text-white", bar: "bg-rose-500", dot: "bg-rose-500" }
      : { ring: "border-indigo-200 bg-indigo-50/60", tile: "bg-indigo-100 text-indigo-700", ink: "text-indigo-700", pill: "bg-indigo-600 text-white", bar: "bg-indigo-500", dot: "bg-indigo-500" };

  const line = coaching
    ? "Full test series & analytics included with your batch."
    : isActive
      ? (expires ? `Full access · valid until ${expires}` : "Full access to the complete test series.")
      : status === "expired"
        ? "Renew to unlock the full test series again."
        : capped
          ? `${remaining} of ${total} free test${total === 1 ? "" : "s"} left`
          : "1 free diagnostic test available.";

  if (mini) {
    return (
      <button
        onClick={onUpgrade}
        title={`${planName} — ${statusLabel}`}
        className={`relative mx-auto w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer ${theme.ring} ${theme.ink}`}
      >
        {isActive ? <IconShield className="w-4 h-4" /> : <IconRocket className="w-4 h-4" />}
        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${theme.dot}`} />
      </button>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${theme.ring}`}>
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme.tile}`}>
          {isActive ? <IconShield className="w-4 h-4" /> : <IconRocket className="w-4 h-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-900 leading-tight truncate">{planName}</p>
          <span className={`inline-block mt-0.5 text-[8.5px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${theme.pill}`}>{statusLabel}</span>
        </div>
      </div>
      <p className="text-[10px] font-semibold text-slate-500 leading-snug mt-2">{line}</p>
      {capped && total > 0 && (
        <div className="mt-1.5 h-1.5 rounded-full bg-white/70 border border-slate-200/60 overflow-hidden">
          <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
        </div>
      )}
      {!isActive && !coaching && (
        <button onClick={onUpgrade} className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-[11px] font-bold hover:bg-slate-800 cursor-pointer">
          {status === "expired" ? "Renew plan" : "See plans"} <IconChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
