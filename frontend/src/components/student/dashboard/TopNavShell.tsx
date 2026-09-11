"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  IconChart, IconFileText, IconChevronDown,
  CustomSelectMenu, IconTarget, IconLayers, IconTrendingUp,
  IconClipboard, IconClock, IconBook, IconUserCheck,
  IconRocket, IconShield, IconChevronRight,
} from "../../common/UIComponents";
import { toast } from "../../common/feedback";
import { ProbabilitySurveyModal } from "../ProbabilitySurveyModal";
import { UpgradeModal } from "../UpgradeModal";
import { AttemptAnalyticsView } from "../AttemptAnalyticsView";
import { ReportsPanel } from "../ReportsPanel";
import { ProfileSettingsPanel } from "../ProfileSettingsPanel";
import { DrilldownProvider } from "./drilldown/DrilldownProvider";
import { useDashboardData } from "./useDashboardData";
import { OverviewSection } from "./OverviewSection";
import { PerformanceSection } from "./PerformanceSection";
import { SubjectsSection } from "./SubjectsSection";
import { ChaptersSection } from "./ChaptersSection";
import { AnalyticsSection } from "./AnalyticsSection";
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

const PRIMARY_NAV: { id: SectionId; label: string; short: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", short: "Home", Icon: IconLayers },
  { id: "performance", label: "Performance", short: "Perf", Icon: IconChart },
  { id: "subjects", label: "Subjects", short: "Subjects", Icon: IconBook },
  { id: "chapters", label: "Chapters", short: "Chapters", Icon: IconTarget },
  { id: "tests", label: "Tests", short: "Tests", Icon: IconClipboard },
  { id: "analytics", label: "Analytics", short: "Deep", Icon: IconTrendingUp },
];

const REPORT_LINKS = [
  { label: "Overall Performance", hint: "All tests · trends & history" },
  { label: "Subject Report", hint: "Physics · Chemistry · Biology" },
  { label: "Chapter Report", hint: "Chapters × priority order" },
  { label: "Topic Report", hint: "Topics · weakest first" },
  { label: "Accuracy Report", hint: "Difficulty bands · heatmap" },
  { label: "Recoverable Marks", hint: "Score recovery plan" },
];

export function StudentDashboard({ onStartExam, onViewAttempt, onLogout }: Props) {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const data = useDashboardData();
  const {
    selectedSprintId, sprints, setSelectedSprintId, pendingCount,
    probability, subscription, access,
  } = data;

  const [section, setSection] = useState<SectionId>("overview");
  const [viewingAttemptId, setViewingAttemptId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  // `?plan=<key>` deep-link → open the upgrade modal on that plan. The lazy
  // initialisers capture the value on first render; the effect strips the param.
  const planParam = searchParams.get("plan") || undefined;
  const [showUpgrade, setShowUpgrade] = useState<boolean>(() => !!planParam);
  const [upgradePlanKey, setUpgradePlanKey] = useState<string | undefined>(() => planParam);
  const strippedParamRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (planParam && !strippedParamRef.current && typeof window !== "undefined") {
      strippedParamRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [planParam]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) setReportsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback((s: SectionId) => {
    setViewingAttemptId(null);
    setSection(s);
    setMenuOpen(false);
    setReportsOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleViewAttempt = (attId: string) => {
    setViewingAttemptId(attId);
    onViewAttempt?.(attId);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openUpgrade = () => { setUpgradePlanKey(undefined); setShowUpgrade(true); };

  const readiness = num(probability?.readinessIndex);
  const sprintId = selectedSprintId;
  const goal = user?.programType || null;
  const initial = (user?.name || "S").slice(0, 1).toUpperCase();

  // Sections that stand on their own without a sprint (they render their own
  // empty/onboarding state): Overview greets the student, the rest are global.
  const noSprintGuard =
    !sprintId && !data.loading &&
    !["overview", "tests", "history", "profile", "reports"].includes(section);

  // A student with coaching/batch access OR a live paid subscription already
  // *has* a plan — clicking the plan control shows their plan details
  // (Profile), never the "buy a plan" panel. Only trial / expired / none opens
  // the upgrade panel.
  const isCoaching = access?.tier === "coaching";
  const hasActivePlan = isCoaching || subscription?.status === "active";
  const planBadge = (() => {
    if (isCoaching) return { label: "Coaching Access", tone: "emerald" as const };
    if (subscription?.status === "active") return { label: subscription.plan?.name || "Active Plan", tone: "emerald" as const };
    if (subscription?.status === "expired") return { label: "Plan Expired", tone: "rose" as const };
    if (access?.capped) {
      const rem = access.remaining ?? 0;
      return { label: `Free Trial · ${rem} left`, tone: rem > 0 ? ("indigo" as const) : ("rose" as const) };
    }
    if (subscription?.status === "trial") return { label: "Free Trial", tone: "indigo" as const };
    return { label: "No Plan", tone: "indigo" as const };
  })();
  const planChipCls =
    planBadge.tone === "emerald" ? "bg-emerald-50 text-emerald-700"
    : planBadge.tone === "rose" ? "bg-rose-50 text-rose-700"
    : "bg-indigo-50 text-indigo-700";
  // The plan control routes to details when a plan exists, else to the upgrade panel.
  const onPlanClick = () => (hasActivePlan ? go("profile") : openUpgrade());

  return (
    <DrilldownProvider sprintId={sprintId} onViewAttempt={handleViewAttempt}>
      <div className="dash-page min-h-screen antialiased text-slate-900 flex flex-col">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="dash-topbar sticky top-0 z-30">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-3 h-14">
              <button onClick={() => go("overview")} className="flex items-center gap-2 shrink-0 cursor-pointer">
                <span className="w-8 h-8 rounded-xl bg-white ring-1 ring-slate-200 shadow-sm p-1 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Exam Neeti" className="w-full h-full object-contain" />
                </span>
                <span className="text-sm font-black text-slate-900 leading-none whitespace-nowrap">
                  Exam <span className="text-indigo-600">Neeti</span>
                </span>
              </button>

              {/* Context pills — sprint picker is always visible; the rest fill in with width */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {goal && (
                  <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1.5 text-[11px] font-bold shrink-0">
                    <IconTarget className="w-3.5 h-3.5" /> Goal: {goal}
                  </span>
                )}
                {sprints.length > 0 && (
                  <div className="min-w-0 flex-1 max-w-[220px]">
                    <CustomSelectMenu
                      value={selectedSprintId}
                      onChange={(v) => setSelectedSprintId(v)}
                      options={sprints.map((s) => ({
                        value: String(s._id || s.id),
                        label: String(s.name || "Sprint"),
                        sublabel: s.isActive ? "Active sprint" : "Past sprint",
                        badge: (s.attemptCount || 0) > 0 ? `${s.attemptCount}` : undefined,
                      }))}
                      icon={IconLayers}
                      buttonClassName="!py-1.5 !rounded-full !text-[11px]"
                    />
                  </div>
                )}
                {readiness > 0 && (
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 px-3 py-1.5 text-[11px] font-black tabular-nums shrink-0">
                    {readiness.toFixed(0)}% ready
                  </span>
                )}
              </div>

              {/* Right cluster */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onPlanClick}
                  title={hasActivePlan ? "View your plan details" : "See plans"}
                  className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-colors cursor-pointer whitespace-nowrap ${planChipCls}`}
                >
                  <IconShield className="w-3.5 h-3.5" /> {planBadge.label}
                </button>
                <button
                  onClick={() => setShowSurvey(true)}
                  disabled={!sprintId}
                  className="hidden xl:inline-flex px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap"
                >
                  Chapter Assessment
                </button>

                {/* Reports dropdown */}
                <div className="relative" ref={reportsRef}>
                  <button
                    onClick={() => setReportsOpen((o) => !o)}
                    aria-label="Reports"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <IconFileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reports</span>
                    <IconChevronDown className={`w-3 h-3 transition-transform ${reportsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {reportsOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-40">
                      <p className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Download Reports</p>
                      {REPORT_LINKS.map((r) => (
                        <button
                          key={r.label}
                          onClick={() => go("reports")}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                          <p className="text-xs font-bold text-slate-800">{r.label}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{r.hint}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Avatar menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center cursor-pointer"
                    aria-label="Account menu"
                  >
                    {initial}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-40">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-black text-slate-900 truncate">{user?.name || "Student"}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => { setMenuOpen(false); onPlanClick(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 my-1 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          planBadge.tone === "emerald" ? "bg-emerald-100 text-emerald-700" : planBadge.tone === "rose" ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700"
                        }`}>
                          {planBadge.tone === "emerald" ? <IconShield className="w-3.5 h-3.5" /> : <IconRocket className="w-3.5 h-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-[11px] font-black text-slate-800 truncate">{planBadge.label}</span>
                          <span className="block text-[9px] font-bold text-slate-400">{hasActivePlan ? "View plan details" : "See plans"}</span>
                        </span>
                        <IconChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </button>
                      <button onClick={() => { setMenuOpen(false); setShowSurvey(true); }} disabled={!sprintId} className="xl:hidden w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-2">
                        <IconBook className="w-3.5 h-3.5" /> Chapter Assessment
                      </button>
                      <button onClick={() => go("history")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2">
                        <IconClock className="w-3.5 h-3.5" /> Attempt History
                      </button>
                      <button onClick={() => go("reports")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2">
                        <IconFileText className="w-3.5 h-3.5" /> Reports
                      </button>
                      <button onClick={() => go("profile")} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2">
                        <IconUserCheck className="w-3.5 h-3.5" /> Profile &amp; Settings
                      </button>
                      <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50">
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Nav row — desktop/tablet only; mobile uses the bottom bar ── */}
            <nav className="hidden sm:flex items-center gap-1 h-11 overflow-x-auto scrollbar-none border-t border-slate-100">
              {PRIMARY_NAV.map(({ id, label, Icon }) => {
                const active = section === id && !viewingAttemptId;
                const badge = id === "tests" ? pendingCount : undefined;
                return (
                  <button
                    key={id}
                    data-active={active}
                    onClick={() => go(id)}
                    className={`dash-navitem inline-flex items-center gap-1.5 px-3 h-full text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      active ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                    {!!badge && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 tabular-nums">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────── */}
        <main className="flex-1 w-full pb-16 sm:pb-10">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-7">
            {viewingAttemptId ? (
              <AttemptAnalyticsView attemptId={viewingAttemptId} onBack={() => setViewingAttemptId(null)} />
            ) : data.error ? (
              <SectionCard>
                <EmptyState
                  icon={IconChart}
                  title="Something went wrong"
                  desc={data.error}
                  action={<button onClick={() => data.refresh()} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Retry</button>}
                />
              </SectionCard>
            ) : noSprintGuard ? (
              <SectionCard>
                <EmptyState
                  icon={IconChart}
                  title="No analytics yet"
                  desc="Your analytics unlock per sprint as you attempt the tests your coaching assigns. Head to Tests to take your first one."
                  action={<button onClick={() => go("tests")} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Go to Tests</button>}
                />
              </SectionCard>
            ) : (
              <>
                {section === "overview" && (
                  <OverviewSection data={data} user={user} onGoSection={go} onViewAttempt={handleViewAttempt} onOpenSurvey={() => setShowSurvey(true)} />
                )}
                {section === "performance" && <PerformanceSection data={data} onViewAttempt={handleViewAttempt} />}
                {section === "subjects" && <SubjectsSection data={data} />}
                {section === "chapters" && <ChaptersSection data={data} />}
                {section === "analytics" && <AnalyticsSection data={data} onViewAttempt={handleViewAttempt} />}
                {section === "tests" && <TestsSection onStartExam={onStartExam} onViewAttempt={handleViewAttempt} onUpgrade={openUpgrade} />}
                {section === "history" && <HistorySection onViewAttempt={handleViewAttempt} />}
                {section === "reports" && (sprintId
                  ? <div className="animate-dash-in"><ReportsPanel sprintId={sprintId} onBack={() => go("overview")} /></div>
                  : <SectionCard><EmptyState icon={IconFileText} title="Reports unavailable" desc="Reports need an active sprint with at least one scored test." /></SectionCard>)}
                {section === "profile" && <div className="animate-dash-in"><ProfileSettingsPanel onBack={() => go("overview")} /></div>}
              </>
            )}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-safe">
          <div className="flex items-stretch h-14">
            {PRIMARY_NAV.map(({ id, short, Icon }) => {
              const active = section === id && !viewingAttemptId;
              const badge = id === "tests" ? pendingCount : undefined;
              return (
                <button key={id} onClick={() => go(id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer relative ${active ? "text-indigo-600" : "text-slate-400"}`}>
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-indigo-600" />}
                  <span className="relative">
                    <Icon className="w-[18px] h-[18px]" />
                    {!!badge && <span className="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] px-0.5 rounded-full bg-indigo-600 text-white text-[8px] font-black leading-[13px] text-center">{badge > 9 ? "9+" : badge}</span>}
                  </span>
                  <span className="text-[9px] font-bold leading-none">{short}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {sprintId && (
          <ProbabilitySurveyModal
            isOpen={showSurvey}
            onClose={() => setShowSurvey(false)}
            sprintId={sprintId}
            initialData={probability}
            onSuccess={() => { setShowSurvey(false); data.refresh(); toast.success("Chapter assessment submitted."); }}
          />
        )}
        <UpgradeModal open={showUpgrade} initialPlanKey={upgradePlanKey} onClose={() => setShowUpgrade(false)} onActivated={() => { data.refresh(); toast.success("Your plan is active."); }} />
      </div>
    </DrilldownProvider>
  );
}
