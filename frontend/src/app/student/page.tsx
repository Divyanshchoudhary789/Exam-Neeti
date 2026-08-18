"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { StudentDashboard } from "../../components/student/StudentDashboard";
import { ExamPortal } from "../../components/student/ExamPortal";
import { AttemptAnalyticsView } from "../../components/student/AttemptAnalyticsView";
import { Spinner } from "../../components/common/UIComponents";

// Only exam and post-exam analytics are full-screen (no sidebar).
// Sprint Analytics, Reports, and Profile are all rendered inside StudentDashboard.
type ViewState = "dashboard" | "exam" | "analytics";

export default function StudentPage() {
  const router                = useRouter();
  const { user, logout }      = useAuthStore();
  const hydrationRef          = useRef(false);
  const [isHydrated, setIsHydrated]         = useState(false);
  const [viewState, setViewState]           = useState<ViewState>("dashboard");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [examTitle, setExamTitle]           = useState("");
  const [examDuration, setExamDuration]     = useState(180);

  useEffect(() => {
    if (!hydrationRef.current) {
      hydrationRef.current = true;
      setIsHydrated(true);
    }
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/");
  }, [logout, router]);

  const handleStartExam = useCallback((id: string, title: string, duration: number) => {
    setSelectedExamId(id);
    setExamTitle(title);
    setExamDuration(duration);
    setViewState("exam");
  }, []);

  const handleViewAttempt = useCallback((attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setViewState("analytics");
  }, []);

  // ── Hydration loader ─────────────────────────────────────────────────────
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  // ── Auth guard ───────────────────────────────────────────────────────────
  if (!user || user.role !== "student") {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans select-none antialiased">
        <Navbar currentView="home" />
        <div className="flex-grow flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="max-w-md p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold mt-2">
                Please log in with a Student account to access the test portal.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-md"
            >
              Return to Landing Page
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Full-screen exam — no chrome ─────────────────────────────────────────
  if (viewState === "exam") {
    return (
      <ExamPortal
        examId={selectedExamId}
        examTitle={examTitle}
        durationMinutes={examDuration}
        onFinish={(attId) => {
          setSelectedAttemptId(attId);
          setViewState("analytics");
        }}
        onExit={() => setViewState("dashboard")}
      />
    );
  }

  // ── Dashboard with persistent sidebar layout ─────────────────────────────
  // Attempt Analytics, Sprint Analytics, Reports, and Profile are all rendered INSIDE the dashboard.
  return (
    <StudentDashboard
      onStartExam={handleStartExam}
      onViewAttempt={handleViewAttempt}
      onLogout={handleLogout}
    />
  );
}
