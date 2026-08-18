"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface ExamAttemptsModalProps {
  isOpen: boolean;
  examId: string;
  examTitle: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function ExamAttemptsModal({
  isOpen,
  examId,
  examTitle,
  onClose,
  showToast,
}: ExamAttemptsModalProps) {
  const [attempts, setAttempts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && examId) {
      const fetchAttempts = async () => {
        setLoading(true);
        try {
          const res = await adminService.getExamAttempts(examId);
          const raw = res?.data?.attempts || res?.attempts || res?.data || res || [];
          setAttempts(Array.isArray(raw) ? raw : []);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
              ?.message ||
            (err as { message?: string }).message ||
            "Failed to load exam attempts";
          showToast(msg, "error");
        } finally {
          setLoading(false);
        }
      };
      fetchAttempts();
    }
  }, [isOpen, examId, showToast]);

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submissions Inspector: ${examTitle}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 text-slate-800">
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading student attempts...</p>
          </div>
        ) : attempts.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500 font-semibold">
            No submissions recorded for this exam yet.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="hidden sm:grid grid-cols-12 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span className="col-span-5">Student Details</span>
              <span className="col-span-2">Total Score</span>
              <span className="col-span-2">Accuracy</span>
              <span className="col-span-3 text-right">Submitted At</span>
            </div>
            <div className="divide-y divide-slate-100">
              {attempts.map((att, idx) => {
                const studentObj = att.student as { name?: string; email?: string } | undefined;
                const studentName = String(studentObj?.name || att.studentName || att.student || `Student ${idx + 1}`);
                const studentEmail = studentObj?.email ? String(studentObj.email) : "";
                const score = Number(att.totalScore ?? att.score ?? 0);
                const accuracy = Number(att.accuracy ?? att.accuracyPercentage ?? 0).toFixed(1);
                const submittedAt = att.submittedAt || att.createdAt;

                return (
                  <div key={String(att._id || idx)} className="grid grid-cols-1 sm:grid-cols-12 px-5 py-3.5 items-center gap-2 sm:gap-0 hover:bg-slate-50/80 transition-colors">
                    <div className="col-span-5 min-w-0 pr-4">
                      <p className="text-xs font-black text-slate-900 truncate">{studentName}</p>
                      {studentEmail && (
                        <p className="text-[11px] text-slate-400 font-semibold truncate" title={studentEmail}>
                          {studentEmail}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-black text-emerald-600">{score}</span>
                      <span className="text-[10px] text-slate-400 block font-semibold">marks</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-bold text-slate-700">{accuracy}%</span>
                    </div>
                    <div className="col-span-3 sm:text-right">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {submittedAt ? new Date(String(submittedAt)).toLocaleString("en-IN") : "Recent"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CommonModal>
  );
}
