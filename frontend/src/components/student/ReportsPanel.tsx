"use client";

import React, { useState, useEffect, useCallback } from "react";
import { studentService } from "../../services/apiServices";
import {
  IconDownload,
  IconFileText,
  IconRefresh,
  IconPlus,
  IconClock,
  IconCheck,
  IconAlertTriangle,
  IconChart,
  IconBook,
  Spinner,
  CommonModal,
} from "../common/UIComponents";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ReportType =
  | "student_overall"
  | "student_subject"
  | "student_chapter"
  | "student_time"
  | "student_accuracy"
  | "student_recoverable";

type ReportFormat = "pdf" | "excel";

interface ReportOption {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    type: "student_overall",
    label: "Overall Performance",
    description: "Complete score summary across all tests — timeline, accuracy, and trends.",
    icon: IconChart,
  },
  {
    type: "student_subject",
    label: "Subject-wise Analysis",
    description: "Detailed Physics, Chemistry, and Biology performance breakdown.",
    icon: IconBook,
  },
  {
    type: "student_chapter",
    label: "Chapter Analysis",
    description: "Chapter and topic-level accuracy with weak areas highlighted.",
    icon: IconFileText,
  },
  {
    type: "student_time",
    label: "Time Utilization",
    description: "Time spent per question — fastest, slowest, and average analysis.",
    icon: IconClock,
  },
  {
    type: "student_accuracy",
    label: "Accuracy & Attempt Rate",
    description: "Test-wise accuracy, attempt rates, negative marks, and guess detection.",
    icon: IconCheck,
  },
  {
    type: "student_recoverable",
    label: "Recoverable Marks",
    description: "Marks lost from wrong guesses and your recovery opportunities.",
    icon: IconAlertTriangle,
  },
];

const TYPE_LABELS: Record<string, string> = {
  student_overall:     "Overall Performance",
  student_subject:     "Subject Analysis",
  student_chapter:     "Chapter Analysis",
  student_time:        "Time Utilization",
  student_accuracy:    "Accuracy Analysis",
  student_recoverable: "Recoverable Marks",
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ReportsPanel({
  sprintId,
  onBack,
}: {
  sprintId: string;
  onBack: () => void;
}) {
  const [reports, setReports]                 = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [genError, setGenError]               = useState("");
  const [selectedType, setSelectedType]       = useState<ReportType>("student_overall");
  const [selectedFormat, setSelectedFormat]   = useState<ReportFormat>("pdf");
  const [downloadingId, setDownloadingId]     = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await studentService.getMyReports();
      const raw  = res?.data?.reports || res?.reports || res?.data || [];
      setReports(Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");
    try {
      await studentService.generateReport({
        type:    selectedType,
        format:  selectedFormat,
        sprintId,
        scope:   "full_sprint",
      });
      setShowGenerateModal(false);
      await loadReports();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setGenError(e?.response?.data?.message || e?.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      const { objectUrl, filename } = await studentService.downloadReport(reportId);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke the object URL after a short delay so the download can start
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Download failed:", e?.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const statusMeta = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s === "ready")  return { label: "Ready",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (s === "failed") return { label: "Failed",  cls: "bg-red-50 text-red-700 border-red-200" };
    return                     { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  };

  const formatMeta = (format: string) => {
    if (format?.toLowerCase() === "pdf")   return { label: "PDF",   cls: "bg-red-50 text-red-600 border-red-200" };
    if (format?.toLowerCase() === "excel") return { label: "Excel", cls: "bg-green-50 text-green-700 border-green-200" };
    return { label: (format || "—").toUpperCase(), cls: "bg-slate-50 text-slate-600 border-slate-200" };
  };

  return (
    <div className="space-y-4 sm:space-y-5 font-sans text-slate-800">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900">My Reports</h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Generate and download your performance reports as PDF or Excel</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadReports}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
              title="Refresh reports"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowGenerateModal(true); setGenError(""); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              New Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Reports list ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-7 pt-5 pb-3 sm:pt-6 sm:pb-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900">Generated Reports</h2>
          {reports.length > 0 && (
            <span className="text-[10px] font-extrabold text-slate-400">
              {reports.length} report{reports.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="px-4 sm:px-7 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Spinner className="w-6 h-6 text-indigo-600" />
              <span className="text-xs font-bold text-slate-400">Loading reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-14 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                <IconFileText className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-600">No reports yet</p>
                <p className="text-xs text-slate-400 font-medium mt-1 max-w-xs mx-auto">Generate a report to download your PDF or Excel performance analysis.</p>
              </div>
              <button onClick={() => setShowGenerateModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
                <IconPlus className="w-4 h-4" />Generate First Report
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {reports.map((report) => {
                const id     = String(report._id || report.id || "");
                const type   = String(report.type || "");
                const status = String(report.status || "pending");
                const format = String(report.format || "pdf");
                const createdAt = report.createdAt
                  ? new Date(String(report.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                const sM = statusMeta(status);
                const fM = formatMeta(format);
                const isReady   = status === "ready";
                const isFailed  = status === "failed";
                const isDl      = downloadingId === id;

                return (
                  <div
                    key={id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-white transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                        <IconFileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{createdAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${fM.cls}`}>{fM.label}</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${sM.cls}`}>{sM.label}</span>
                      {!isFailed ? (
                        <button
                          onClick={() => handleDownload(id)}
                          disabled={isDl}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60 ${
                            isReady ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700"
                          }`}
                        >
                          {isDl ? <Spinner className="w-3.5 h-3.5 text-current" /> : <IconDownload className="w-3.5 h-3.5" />}
                          {isDl ? "Downloading..." : "Download"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-red-500">Failed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Generate Modal ───────────────────────────────────────── */}
      <CommonModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate New Report"
        maxWidth="max-w-lg"
      >
        <div className="space-y-5">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Select a report type and your preferred download format. The report will be
            generated from your sprint performance data.
          </p>

          {genError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              {genError}
            </div>
          )}

          {/* Report type */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Report Type
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {REPORT_OPTIONS.map((opt) => {
                const Icon       = opt.icon;
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/20"
                        : "bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-slate-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-extrabold ${isSelected ? "text-indigo-900" : "text-slate-800"}`}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                        <IconCheck className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Download Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["pdf", "excel"] as ReportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`py-3 px-4 rounded-2xl border text-xs font-extrabold uppercase transition-all cursor-pointer ${
                    selectedFormat === fmt
                      ? fmt === "pdf"
                        ? "bg-red-50 border-red-400 text-red-700 ring-2 ring-red-400/20 shadow-sm"
                        : "bg-green-50 border-green-400 text-green-700 ring-2 ring-green-400/20 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {fmt === "pdf" ? "PDF" : "Excel"}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowGenerateModal(false)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {generating ? (
                <>
                  <Spinner className="w-4 h-4 text-white" />
                  Generating...
                </>
              ) : (
                <>
                  <IconDownload className="w-3.5 h-3.5" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </CommonModal>
    </div>
  );
}
