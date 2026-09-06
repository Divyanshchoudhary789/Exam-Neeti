"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { StudentDashboard } from "../../components/student/StudentDashboard";
import { ExamPortal } from "../../components/student/ExamPortal";
import { Spinner } from "../../components/common/UIComponents";

// The exam runner is the only full-screen view (no sidebar). Everything else —
// attempt analysis, reports, profile — renders inside StudentDashboard.
type ViewState = "dashboard" | "exam";

export default function StudentPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const hydrationRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("dashboard");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examDuration, setExamDuration] = useState(180);
  const [examMeta, setExamMeta] = useState<{ totalQuestions?: number; totalMarks?: number; instructions?: string }>({});

  useEffect(() => {
    if (!hydrationRef.current) {
      hydrationRef.current = true;
      setIsHydrated(true);
    }
  }, []);

  // Not a signed-in student (logged out, session expired, wrong role) → send
  // them to the public landing page rather than showing a dead-end screen.
  const notStudent = isHydrated && (!user || user.role !== "student");
  useEffect(() => {
    if (notStudent) router.replace("/");
  }, [notStudent, router]);

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/");
  }, [logout, router]);

  const handleStartExam = useCallback((
    id: string,
    title: string,
    duration: number,
    meta?: { totalQuestions?: number; totalMarks?: number; instructions?: string },
  ) => {
    setSelectedExamId(id);
    setExamTitle(title);
    setExamDuration(duration);
    setExamMeta(meta || {});
    setViewState("exam");
  }, []);

  // Attempt analysis is handled inside the dashboard shell.
  const handleViewAttempt = useCallback((_attemptId: string) => {}, []);

  // ── Hydration loader / redirect-in-progress ─────────────────────────────
  if (!isHydrated || notStudent) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
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
        totalQuestions={examMeta.totalQuestions}
        totalMarks={examMeta.totalMarks}
        examInstructions={examMeta.instructions}
        onFinish={() => setViewState("dashboard")}
        onExit={() => setViewState("dashboard")}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <StudentDashboard
        onStartExam={handleStartExam}
        onViewAttempt={handleViewAttempt}
        onLogout={handleLogout}
      />
    </Suspense>
  );
}
