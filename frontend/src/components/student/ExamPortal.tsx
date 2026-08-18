"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { studentService } from "../../services/apiServices";
import { Spinner, CommonModal } from "../common/UIComponents";
import { MathRenderer } from "../common/MathRenderer";

// ─── SVG Icons (Strictly No Emojis) ─────────────────────────────────────────

const IconCheck = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IconCross = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconChevronLeft = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const IconChevronRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const IconClock = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconFlag = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm0 0h18" />
  </svg>
);

const IconGrid = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IconTrash = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconAlertCircle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconZoomIn = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
  </svg>
);

const IconSend = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionImage {
  url?: string | null;
  publicId?: string | null;
}

interface OptionItem {
  key: string;
  text: string;
  image?: QuestionImage | null;
}

interface Question {
  _id?: string;
  id?: string;
  questionId?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  text: string;
  hasLatex?: boolean;
  questionImage?: QuestionImage | null;
  options: OptionItem[];
  patternSlotTag?: number;
  slotPosition?: number;
  idealTimeSeconds?: number | null;
}

interface ExamPortalProps {
  examId: string;
  examTitle: string;
  durationMinutes: number;
  onFinish: (attemptId: string) => void;
  onExit: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimer = (s: number) => {
  const safeSeconds = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const sec = safeSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExamPortal({
  examId,
  examTitle,
  durationMinutes = 180,
  onFinish,
  onExit,
}: ExamPortalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  // User Response State
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [confidenceMap, setConfidenceMap] = useState<Record<number, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});

  // Telemetry tracking
  const [timeSpentMap, setTimeSpentMap] = useState<Record<number, number>>({});
  const [sequencePositions, setSequencePositions] = useState<Record<number, number>>({});
  const [reattemptMap, setReattemptMap] = useState<Record<number, boolean>>({});
  const [answerChangesMap, setAnswerChangesMap] = useState<Record<number, number>>({});

  // Timer & Navigation State
  const initialDuration = Math.max(1, Number(durationMinutes) || 180);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(initialDuration * 60);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // References
  const stepCountRef = useRef(0);
  const endTimeRef = useRef<number | null>(null);
  const submitCalledRef = useRef(false);
  const handleSubmitExamRef = useRef<() => void>(() => {});

  // ── Init Attempt ──────────────────────────────────────────────────────────
  const initAttempt = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await studentService.startExamAttempt(examId);
      const data = res?.data || res;
      const att = data?.attempt || data;
      const examData = data?.exam || data;

      const attId = String(att?._id || att?.id || data?.attemptId || "");
      setAttemptId(attId);

      const qList: Question[] = examData?.questions || att?.questions || data?.questions || [];
      setQuestions(qList);

      // Compute exact remaining exam duration based on attempt startedAt timestamp
      const rawDur = Number(examData?.durationMinutes || durationMinutes);
      const durMin = (!isNaN(rawDur) && rawDur > 0) ? rawDur : 180;
      const totalSec = durMin * 60;
      let targetEndMs = Date.now() + totalSec * 1000;

      if (att?.startedAt) {
        const startedMs = new Date(att.startedAt).getTime();
        if (!isNaN(startedMs) && startedMs > 0) {
          const elapsedSec = Math.floor((Date.now() - startedMs) / 1000);
          // If elapsed time is within test duration minus 10s grace, use exact remaining time.
          // Otherwise (old expired attempt session), grant fresh full test duration so timer ticks!
          if (elapsedSec < totalSec - 10) {
            targetEndMs = startedMs + totalSec * 1000;
          }
        }
      }

      endTimeRef.current = targetEndMs;
      const initialRemaining = Math.max(0, Math.floor((targetEndMs - Date.now()) / 1000));
      setTimeLeftSeconds(initialRemaining);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: Record<string, unknown> }; message?: string };
      if (ax?.response?.status === 409) {
        const attIdFromErr = ax.response?.data?.attemptId as string | undefined;
        if (attIdFromErr) {
          onFinish(attIdFromErr);
          return;
        }
        setError("You have already submitted this exam. Please view your results from the dashboard.");
      } else {
        setError(ax?.response?.data?.message as string || ax?.message || "Failed to initialize exam portal.");
      }
    } finally {
      setLoading(false);
    }
  }, [examId, durationMinutes, onFinish]);

  useEffect(() => {
    initAttempt();
  }, [initAttempt]);

  // ── Submit Exam Handler ───────────────────────────────────────────────────
  const handleSubmitExam = useCallback(async () => {
    if (!attemptId || submitCalledRef.current) return;
    submitCalledRef.current = true;
    setSubmitting(true);

    try {
      const durSec = (Number(durationMinutes) || 180) * 60;
      const totalTimeSeconds = Math.max(0, Math.min(durSec, durSec - timeLeftSeconds));

      const responsesPayload = questions.map((q, idx) => ({
        slotPosition: idx + 1,
        questionId: String(q.questionId || q._id || q.id || ""),
        selectedAnswer: answers[idx] ?? null,
        confidence: confidenceMap[idx] ?? 50,
        timeSpentSeconds: timeSpentMap[idx] ?? 0,
        sequencePosition: sequencePositions[idx] ?? 0,
        wasReattempted: Boolean(reattemptMap[idx]),
        answerChanges: answerChangesMap[idx] ?? 0,
      }));

      await studentService.submitExamAttempt(attemptId, responsesPayload, totalTimeSeconds);
      onFinish(attemptId);
    } catch (err: unknown) {
      submitCalledRef.current = false;
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to submit exam attempt. Please try again.";
      alert(msg);
      setSubmitting(false);
    }
  }, [
    attemptId,
    durationMinutes,
    timeLeftSeconds,
    questions,
    answers,
    confidenceMap,
    timeSpentMap,
    sequencePositions,
    reattemptMap,
    answerChangesMap,
    onFinish,
  ]);

  // Keep ref up to date so timer interval uses current submit function without resetting timer effect
  useEffect(() => {
    handleSubmitExamRef.current = handleSubmitExam;
  }, [handleSubmitExam]);

  // ── Persistent Countdown Timer Engine ─────────────────────────────────────
  useEffect(() => {
    if (loading || questions.length === 0) return;

    // Fallback if endTimeRef wasn't set
    if (!endTimeRef.current) {
      const rawDur = Number(durationMinutes);
      const durMin = (!isNaN(rawDur) && rawDur > 0) ? rawDur : 180;
      endTimeRef.current = Date.now() + durMin * 60 * 1000;
    }

    // Immediate tick update
    const firstRemaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
    setTimeLeftSeconds(firstRemaining);

    const timerInterval = setInterval(() => {
      if (!endTimeRef.current) return;

      const remaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(timerInterval);
        if (handleSubmitExamRef.current) {
          handleSubmitExamRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [loading, questions.length, durationMinutes]);

  // ── Per-Question Time Tracking ────────────────────────────────────────────
  useEffect(() => {
    if (loading || questions.length === 0) return;
    const perQuestionIv = setInterval(() => {
      setTimeSpentMap(prev => ({
        ...prev,
        [currentIndex]: (prev[currentIndex] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(perQuestionIv);
  }, [currentIndex, loading, questions.length]);

  // ── Option Handlers ───────────────────────────────────────────────────────
  const handleSelectOption = (optKey: string) => {
    if (answers[currentIndex]) {
      setReattemptMap(p => ({ ...p, [currentIndex]: true }));
      setAnswerChangesMap(p => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + 1 }));
    }
    setAnswers(p => ({ ...p, [currentIndex]: optKey }));

    if (!sequencePositions[currentIndex]) {
      stepCountRef.current += 1;
      setSequencePositions(p => ({ ...p, [currentIndex]: stepCountRef.current }));
    }
    if (!confidenceMap[currentIndex]) {
      setConfidenceMap(p => ({ ...p, [currentIndex]: 70 }));
    }
  };

  const handleClearAnswer = () => {
    setAnswers(p => {
      const next = { ...p };
      delete next[currentIndex];
      return next;
    });
  };

  // ── Loading & Error States ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4 font-sans select-none antialiased">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col items-center gap-3 max-w-xs w-full text-center">
          <Spinner className="w-9 h-9 text-indigo-600" />
          <div className="space-y-1">
            <p className="text-sm font-black text-slate-900">Loading Test Portal</p>
            <p className="text-xs text-slate-500 font-semibold">Preparing questions &amp; initializing timer...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans select-none antialiased">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-6 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto shadow-sm">
            <IconAlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">
              {error?.includes("already submitted") ? "Exam Already Completed" : "Unable to Launch Test"}
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {error || "No questions are available for this exam."}
            </p>
          </div>
          <button
            onClick={onExit}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
          >
            {error?.includes("already submitted") ? "Return to Dashboard" : "Back to Test List"}
          </button>
        </div>
      </div>
    );
  }

  // ── Derived Data ──────────────────────────────────────────────────────────
  const currentQ = questions[currentIndex];
  const subjects = ["All", ...Array.from(new Set(questions.map(q => q.subject || "General")))];

  // Map subject questions to absolute indices
  const filteredIndices = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => selectedSubject === "All" || q.subject === selectedSubject)
    .map(({ idx }) => idx);

  const answeredCount = Object.keys(answers).length;
  const reviewCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = questions.length - answeredCount;

  // Timer Warning States
  const isCriticalTime = timeLeftSeconds < 300; // < 5 mins
  const isWarningTime = timeLeftSeconds < 900;  // < 15 mins
  const hasQImage = Boolean(currentQ?.questionImage?.url);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans select-none antialiased">
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Brand & Exam Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="hidden sm:flex h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white items-center justify-center font-black text-xs shadow-md shadow-indigo-500/20">
              NEET
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-tight">{examTitle}</h1>
              <p className="text-[11px] font-semibold text-slate-400 hidden sm:flex items-center gap-1.5 mt-0.5">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>&bull;</span>
                <span className="text-indigo-600 font-extrabold">{currentQ?.subject || "General"}</span>
              </p>
            </div>
          </div>

          {/* Controls: Timer, Palette, Submit */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Question Counter Pill (Mobile Only) */}
            <div className="sm:hidden px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 tabular-nums">
              {currentIndex + 1}/{questions.length}
            </div>

            {/* Live Digital Timer */}
            <div
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border font-mono font-black text-xs sm:text-sm transition-all shadow-xs ${
                isCriticalTime
                  ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                  : isWarningTime
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-slate-50 border-slate-200 text-indigo-950"
              }`}
            >
              <IconClock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCriticalTime ? "text-red-500" : "text-slate-400"}`} />
              <span className="hidden sm:inline text-[10px] font-extrabold uppercase text-slate-400 mr-0.5">Time Left</span>
              <span className="tabular-nums tracking-wide">{formatTimer(timeLeftSeconds)}</span>
            </div>

            {/* Mobile Palette Button */}
            <button
              onClick={() => setShowPaletteMobile(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer transition-all active:scale-95"
            >
              <IconGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Palette</span>
            </button>

            {/* Submit Exam Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
            >
              <IconSend className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Submit</span>
              <span className="xs:hidden">Finish</span>
            </button>
          </div>
        </div>

        {/* Subject Navigation Filter Bar */}
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-t border-slate-100/80 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mr-1 hidden sm:inline shrink-0">
            Subjects:
          </span>
          {subjects.map(sub => {
            const isSelected = selectedSubject === sub;
            const subCount = sub === "All" ? questions.length : questions.filter(q => q.subject === sub).length;
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                <span>{sub}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] tabular-nums font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {subCount}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Main Layout Body ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-5 flex gap-5 min-w-0">
        {/* ── Left Column: Question & Options Viewport ───────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-210px)]">
            {/* Question Header Metadata */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                  {currentIndex + 1}
                </span>
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-700 truncate">
                    {currentQ?.subject || "General"}
                  </span>
                  {currentQ?.chapter && (
                    <span className="text-xs font-semibold text-slate-500 truncate hidden sm:inline">
                      &bull;&nbsp;{currentQ.chapter}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-extrabold text-slate-400 shrink-0">
                {currentQ?.idealTimeSeconds && (
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Est. Time: {currentQ.idealTimeSeconds}s
                  </span>
                )}
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                  Slot #{currentQ?.slotPosition || currentIndex + 1}
                </span>
              </div>
            </div>

            {/* Question Content & Controls */}
            <div className="p-4 sm:p-7 space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Question Text */}
                <div className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed space-y-2">
                  <MathRenderer text={currentQ?.text || ""} />
                </div>

                {/* Question Diagram Image */}
                {hasQImage && (
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50/50 p-2 max-w-xl mx-auto">
                    <img
                      src={currentQ.questionImage!.url!}
                      alt="Question Diagram"
                      className="w-full max-h-64 sm:max-h-80 object-contain rounded-xl mx-auto cursor-pointer"
                      onClick={() => setPreviewImage(currentQ.questionImage!.url!)}
                      loading="lazy"
                    />
                    <button
                      onClick={() => setPreviewImage(currentQ.questionImage!.url!)}
                      className="absolute top-4 right-4 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-xl text-xs font-bold opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                      <IconZoomIn className="w-4 h-4" />
                      <span className="hidden sm:inline">Expand</span>
                    </button>
                  </div>
                )}

                {/* Answer Options */}
                <div className="space-y-3 pt-2">
                  {currentQ?.options?.map(opt => {
                    const isSelected = answers[currentIndex] === opt.key;
                    const hasOptImg = Boolean(opt.image?.url);
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectOption(opt.key)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10"
                            : "bg-slate-50/60 border-slate-200/90 hover:bg-slate-100/70 hover:border-slate-300"
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white border border-slate-200 text-slate-700"
                          }`}
                        >
                          {opt.key}
                        </span>

                        <div className="flex-1 min-w-0 space-y-2 pt-1">
                          {opt.text && (
                            <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                              <MathRenderer text={opt.text} inline />
                            </div>
                          )}
                          {hasOptImg && (
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white p-1 max-w-sm">
                              <img
                                src={opt.image!.url!}
                                alt={`Option ${opt.key}`}
                                className="max-h-32 object-contain mx-auto block cursor-pointer"
                                onClick={e => {
                                  e.stopPropagation();
                                  setPreviewImage(opt.image!.url!);
                                }}
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                            <IconCheck className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Confidence Rating Slider */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Answer Confidence Rating
                    </label>
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                      {confidenceMap[currentIndex] || 50}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={10}
                    value={confidenceMap[currentIndex] || 50}
                    onChange={e =>
                      setConfidenceMap(p => ({
                        ...p,
                        [currentIndex]: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] font-extrabold text-slate-400">
                    <span>Low Confidence</span>
                    <span>50%</span>
                    <span>High Confidence</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-6">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setMarkedForReview(p => ({
                        ...p,
                        [currentIndex]: !p[currentIndex],
                      }))
                    }
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      markedForReview[currentIndex]
                        ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"
                    }`}
                  >
                    <IconFlag className="w-4 h-4" />
                    <span>{markedForReview[currentIndex] ? "Marked for Review" : "Mark for Review"}</span>
                  </button>

                  {answers[currentIndex] && (
                    <button
                      onClick={handleClearAnswer}
                      className="flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
                      title="Clear answer selection"
                    >
                      <IconTrash className="w-4 h-4" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(p => p - 1)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 disabled:opacity-40 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <IconChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    disabled={currentIndex === questions.length - 1}
                    onClick={() => setCurrentIndex(p => p + 1)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40 text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                  >
                    <span>Next</span>
                    <IconChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Question Palette Sidebar (Desktop) ────────────── */}
        <div className="hidden lg:flex w-64 xl:w-72 shrink-0">
          <PalettePanel
            filteredIndices={filteredIndices}
            currentIndex={currentIndex}
            answers={answers}
            markedForReview={markedForReview}
            answeredCount={answeredCount}
            reviewCount={reviewCount}
            unattemptedCount={unattemptedCount}
            onJump={i => setCurrentIndex(i)}
            onSubmit={() => setShowSubmitModal(true)}
          />
        </div>
      </div>

      {/* ── Mobile Palette Drawer ─────────────────────────────────────────── */}
      {showPaletteMobile && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowPaletteMobile(false)}
          />
          <div className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconGrid className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">Question Palette</h3>
              </div>
              <button
                onClick={() => setShowPaletteMobile(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <PalettePanel
                filteredIndices={filteredIndices}
                currentIndex={currentIndex}
                answers={answers}
                markedForReview={markedForReview}
                answeredCount={answeredCount}
                reviewCount={reviewCount}
                unattemptedCount={unattemptedCount}
                onJump={i => {
                  setCurrentIndex(i);
                  setShowPaletteMobile(false);
                }}
                onSubmit={() => {
                  setShowPaletteMobile(false);
                  setShowSubmitModal(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Image Preview Zoom Modal ─────────────────────────────────────── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative max-w-4xl w-full bg-white rounded-3xl p-4 overflow-hidden shadow-2xl space-y-3">
            <div className="flex items-center justify-between px-2 pt-1 border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black uppercase text-slate-700">Diagram Preview</h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-2 text-center">
              <img src={previewImage} alt="Enlarged Diagram" className="max-w-full h-auto mx-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Confirmation Modal ────────────────────────────────────── */}
      <CommonModal
        isOpen={showSubmitModal}
        onClose={() => !submitting && setShowSubmitModal(false)}
        title="Confirm Exam Submission"
      >
        <div className="space-y-5">
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            Are you sure you want to finalize and submit your NEET test? Once submitted, your answers cannot be changed.
          </p>

          {/* Breakdown Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="text-2xl font-black block tabular-nums">{answeredCount}</span>
              <p className="text-[10px] font-extrabold uppercase mt-1">Answered</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
              <span className="text-2xl font-black block tabular-nums">{reviewCount}</span>
              <p className="text-[10px] font-extrabold uppercase mt-1">Review</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800">
              <span className="text-2xl font-black block tabular-nums">{unattemptedCount}</span>
              <p className="text-[10px] font-extrabold uppercase mt-1">Unattempted</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-[11px] text-slate-500 font-semibold">
              Time Remaining:{" "}
              <span className="font-mono font-black text-slate-900 text-xs ml-1">{formatTimer(timeLeftSeconds)}</span>
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              onClick={() => setShowSubmitModal(false)}
              disabled={submitting}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
            >
              Resume Test
            </button>
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {submitting ? (
                <>
                  <Spinner className="w-4 h-4 text-white" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <IconSend className="w-4 h-4" />
                  <span>Confirm Submit</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CommonModal>
    </div>
  );
}

// ─── Palette Panel Component ──────────────────────────────────────────────────

function PalettePanel({
  filteredIndices,
  currentIndex,
  answers,
  markedForReview,
  answeredCount,
  reviewCount,
  unattemptedCount,
  onJump,
  onSubmit,
}: {
  filteredIndices: number[];
  currentIndex: number;
  answers: Record<number, string>;
  markedForReview: Record<number, boolean>;
  answeredCount: number;
  reviewCount: number;
  unattemptedCount: number;
  onJump: (i: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 space-y-4 flex flex-col w-full">
      {/* Header & Status Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Question Palette</h3>
          <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            {filteredIndices.length} Qs
          </span>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { dot: "bg-emerald-500", label: "Answered", count: answeredCount },
            { dot: "bg-amber-500", label: "For Review", count: reviewCount },
            { dot: "bg-slate-300", label: "Unattempted", count: unattemptedCount },
            { dot: "bg-purple-600", label: "Ans + Review", count: null },
          ].map(({ dot, label, count }) => (
            <div
              key={label}
              className="flex items-center justify-between text-[10px] font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                <span>{label}</span>
              </div>
              {count !== null && <span className="font-extrabold text-slate-900 tabular-nums">{count}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Question Number Grid */}
      <div className="grid grid-cols-5 gap-1.5 overflow-y-auto max-h-72 p-1 scrollbar-none">
        {filteredIndices.map(qIdx => {
          const isCurrent = qIdx === currentIndex;
          const isAns = Boolean(answers[qIdx]);
          const isRev = Boolean(markedForReview[qIdx]);

          let bg = "bg-slate-100 text-slate-700 hover:bg-slate-200/80";
          if (isAns && isRev) bg = "bg-purple-600 text-white shadow-xs";
          else if (isAns) bg = "bg-emerald-600 text-white shadow-xs";
          else if (isRev) bg = "bg-amber-500 text-white shadow-xs";

          return (
            <button
              key={qIdx}
              onClick={() => onJump(qIdx)}
              className={`h-9 w-full rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${bg} ${
                isCurrent ? "ring-2 ring-indigo-600 ring-offset-1 scale-105 shadow-sm" : ""
              }`}
            >
              {qIdx + 1}
            </button>
          );
        })}
      </div>

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition-all mt-auto active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <IconSend className="w-4 h-4" />
        <span>Submit Test</span>
      </button>
    </div>
  );
}
