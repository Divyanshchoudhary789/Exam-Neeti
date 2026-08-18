"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner, MiniStatCard, IconChart, IconBook, IconClock } from "../common/UIComponents";
import { adminService, UserProfile } from "../../services/apiServices";

interface StudentAnalyticsModalProps {
  isOpen: boolean;
  student: (UserProfile & { studentId?: string; studentName?: string; studentEmail?: string; batchName?: string; rank?: number; totalScore?: number }) | null;
  sprintId: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function StudentAnalyticsModal({
  isOpen,
  student,
  sprintId,
  onClose,
  showToast,
}: StudentAnalyticsModalProps) {
  const [coverageData, setCoverageData] = useState<Record<string, unknown> | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, unknown>[]>([]);
  const [summaryData, setSummaryData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveSprintId = sprintId || "all";
  const studentId = student?._id || student?.studentId || "";
  const studentName = student?.name || student?.studentName || "Student";
  const studentEmail = student?.email || student?.studentEmail || "";
  const batchName = student?.batchName || (student?.batch as { name?: string })?.name || "";

  useEffect(() => {
    if (isOpen && studentId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [covRes, histRes] = await Promise.allSettled([
            adminService.getStudentCoverage(studentId, effectiveSprintId),
            adminService.getStudentAttemptHistory(effectiveSprintId, studentId),
          ]);

          if (covRes.status === "fulfilled") {
            const cov = covRes.value?.data?.coverage || covRes.value?.coverage || covRes.value?.data || covRes.value;
            setCoverageData(cov && typeof cov === "object" ? cov : null);
          }
          if (histRes.status === "fulfilled") {
            const resVal = histRes.value?.data || histRes.value;
            const h = resVal?.history || resVal?.data || [];
            const s = resVal?.summary || null;
            setHistoryData(Array.isArray(h) ? h : []);
            setSummaryData(s);
          }
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
              ?.message ||
            (err as { message?: string }).message ||
            "Failed to load student analytics";
          showToast(msg, "error");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, studentId, effectiveSprintId, showToast]);

  const initials = studentName
    ? studentName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ST";

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Student Performance Profile`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5 text-slate-800">
        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/30 border border-white/20 flex items-center justify-center text-lg sm:text-xl font-black text-white shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">{studentName}</h3>
                {Boolean(student?.rank) && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950 shadow-xs">
                    Rank #{student?.rank}
                  </span>
                )}
              </div>
              {Boolean(studentEmail) && <p className="text-xs text-indigo-200 font-medium truncate mt-0.5">{studentEmail}</p>}
              {Boolean(batchName) && (
                <div className="mt-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-indigo-100 border border-white/15">
                    Batch: {batchName}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="sm:text-right shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-white/10 flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-300">Scope</span>
            <span className="text-xs font-black text-white px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 inline-block">
              {effectiveSprintId === "all" ? "🌟 All Sprints (Overall)" : "Selected Sprint"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading student analytics & attempt history...</p>
          </div>
        ) : (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Tests</p>
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <IconBook className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{summaryData?.totalExams ? Number(summaryData.totalExams) : historyData.length}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Completed</p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Marks</p>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <IconChart className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{summaryData?.totalScore !== undefined ? Number(summaryData.totalScore) : (student?.totalScore ?? 0)}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Accumulated</p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-300 transition-all">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Avg Percentage</p>
                  <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                    <IconChart className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{summaryData?.averagePercentage !== undefined ? `${summaryData.averagePercentage}%` : "N/A"}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Mean exam %</p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Coverage</p>
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <IconBook className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{coverageData ? `${Math.round(Number(coverageData.coveragePercentage || coverageData.syllabusCoverage || 0))}%` : "N/A"}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Syllabus topics</p>
              </div>
            </div>

            {/* Attempt History List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <IconClock className="w-4 h-4 text-indigo-600" />
                  <span>Exam Attempt History ({historyData.length})</span>
                </h4>
              </div>

              {historyData.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold">No exam attempts recorded for this student yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100 shadow-xs max-h-80 overflow-y-auto">
                  {historyData.map((h, i) => {
                    const examTitle = String(
                      (h.exam as { title?: string })?.title || h.examTitle || h.title || "Exam"
                    );
                    const rawSprint = (h.sprint as { name?: string })?.name || String(h.sprintName || "");
                    const sprintBadge = rawSprint && rawSprint.toLowerCase() !== "sprint" ? rawSprint : null;

                    const score = Number(h.score ?? h.totalScore ?? 0);
                    const maxMarks = Number((h.exam as { totalMarks?: number })?.totalMarks || h.totalMarks || 720);
                    const pct = Number(h.percentage ?? (maxMarks > 0 ? (score / maxMarks) * 100 : 0)).toFixed(1);
                    const isNegative = score < 0;

                    return (
                      <div key={i} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/80 transition-all">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{examTitle}</p>
                            {Boolean(sprintBadge) && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 shrink-0">
                                {sprintBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {h.submittedAt ? new Date(String(h.submittedAt)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Recent"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className={`text-sm font-black ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                              {score > 0 ? `+${score}` : score} <span className="text-[10px] text-slate-400 font-normal">/ {maxMarks}</span>
                            </span>
                          </div>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${isNegative ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </CommonModal>
  );
}
