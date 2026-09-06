"use client";

import React, { useEffect, useRef, useState } from "react";
import { CommonModal, Spinner, IconUpload, IconCheck, IconCross, IconAlertTriangle, IconDownload } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface BulkUploadQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // called once uploaded rows exist, to refresh the list behind the modal
  showToast: (msg: string, type?: "success" | "error") => void;
}

interface BulkUploadResult {
  totalRows: number;
  createdCount: number;
  created: string[];
  skippedDuplicates: Array<{ row: number; reason: string }>;
  failed: Array<{ row: number; errors: string[] }>;
  flaggedForReview: number;
}

interface JobProgress {
  processed: number;
  total: number;
  stage: "parsing" | "converting_equations" | "uploading_images" | "saving" | "done";
}

const ACCEPTED_EXTENSIONS = [".docx", ".xlsx"];
const POLL_INTERVAL_MS = 2000;

const STAGE_LABELS: Record<JobProgress["stage"], string> = {
  parsing: "Reading the file…",
  converting_equations: "Converting formulas…",
  uploading_images: "Uploading images…",
  saving: "Saving questions…",
  done: "Done",
};

export function BulkUploadQuestionsModal({ isOpen, onClose, onSuccess, showToast }: BulkUploadQuestionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false); // initial POST in flight
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "xlsx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  const reset = () => {
    stopPolling();
    setFile(null);
    setUploading(false);
    setBatchId(null);
    setProgress(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => stopPolling, []); // cleanup on unmount

  const handleFileChange = (f: File | null) => {
    if (f && !ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      showToast("Only .docx or .xlsx files are accepted.", "error");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const pollStatus = (id: string) => {
    pollTimer.current = setInterval(async () => {
      try {
        const res = await adminService.getBulkUploadStatus(id);
        const data = (res?.data || res) as {
          status: "processing" | "done" | "failed";
          progress: JobProgress;
          result?: BulkUploadResult;
          errorMessage?: string;
        };
        setProgress(data.progress);

        if (data.status === "done") {
          stopPolling();
          const r = data.result as BulkUploadResult;
          setResult(r);
          if (r.createdCount > 0) {
            showToast(`${r.createdCount} question(s) added as drafts — review them below.`, "success");
            onSuccess();
          } else {
            showToast("No questions were added — see the report below.", "error");
          }
        } else if (data.status === "failed") {
          stopPolling();
          showToast(data.errorMessage || "Bulk upload failed while processing.", "error");
          setBatchId(null);
        }
      } catch {
        // A transient network hiccup while polling shouldn't kill the flow —
        // just try again on the next tick.
      }
    }, POLL_INTERVAL_MS);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminService.bulkUploadQuestions(file);
      const data = (res?.data || res) as { batchId: string };
      setBatchId(data.batchId);
      setProgress({ processed: 0, total: 0, stage: "parsing" });
      pollStatus(data.batchId);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Bulk upload failed to start";
      showToast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async (format: "docx" | "xlsx") => {
    setDownloadingFormat(format);
    try {
      const { objectUrl, filename } = await adminService.downloadQuestionTemplate(format);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to download template", "error");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const isProcessing = batchId !== null && result === null;
  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : null;

  return (
    <CommonModal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Questions" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {!batchId && !result && (
          <>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Upload a filled-in copy of the sample template (.docx or .xlsx) — either the structured table format, or a
              naturally-formatted exam paper with embedded equations and images (download a sample below to see both,
              with worked examples). Every question is added to the bank as a <b>draft</b> — review each one on the
              &quot;My Questions&quot; page (verify any auto-converted formula, add anything missing) before activating
              it for use in exams.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTemplate("docx")}
                disabled={downloadingFormat !== null}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingFormat === "docx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
                <span>Sample Word File</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate("xlsx")}
                disabled={downloadingFormat !== null}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingFormat === "xlsx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
                <span>Sample Excel File</span>
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.xlsx"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {file && <p className="text-xs font-semibold text-slate-700 mt-2">{file.name}</p>}
            </div>
            <button
              type="button"
              disabled={!file || uploading}
              onClick={handleUpload}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {uploading ? <Spinner className="w-4 h-4 text-white" /> : <><IconUpload className="w-4 h-4" /><span>Upload & Process</span></>}
            </button>
          </>
        )}

        {isProcessing && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <Spinner className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-sm font-bold text-slate-800">{progress ? STAGE_LABELS[progress.stage] : "Processing…"}</p>
              {progress && progress.total > 0 && (
                <p className="text-xs text-slate-500 font-medium mt-1">{progress.processed} / {progress.total}</p>
              )}
            </div>
            {pct !== null && (
              <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="text-[11px] text-slate-400 font-medium max-w-sm">
              Large files with many formulas can take a minute or two — you can close this and check back on the
              &quot;My Questions&quot; Draft tab, the upload will keep processing.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-xl font-black text-emerald-700">{result.createdCount}</p>
                <p className="text-[10px] font-bold uppercase text-emerald-600">Added as Draft</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-xl font-black text-amber-700">{result.skippedDuplicates.length}</p>
                <p className="text-[10px] font-bold uppercase text-amber-600">Duplicates Skipped</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                <p className="text-xl font-black text-red-700">{result.failed.length}</p>
                <p className="text-[10px] font-bold uppercase text-red-600">Failed</p>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-center">
                <p className="text-xl font-black text-sky-700">{result.flaggedForReview}</p>
                <p className="text-[10px] font-bold uppercase text-sky-600">Formulas To Verify</p>
              </div>
            </div>

            {result.flaggedForReview > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-700">
                <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{result.flaggedForReview} auto-converted formula(s) need a quick visual check — open a draft
                  question&apos;s &quot;Verify Conversions&quot; section to compare each one against the original.</span>
              </div>
            )}

            {result.failed.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1.5"><IconAlertTriangle className="w-3.5 h-3.5" />Fix these rows and re-upload</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {result.failed.map((f, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs">
                      <b className="text-red-700">Row {f.row}:</b>{" "}
                      <span className="text-red-600 font-medium">{f.errors.join("; ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.skippedDuplicates.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-amber-600">Skipped duplicates</p>
                <div className="max-h-32 overflow-y-auto space-y-1.5">
                  {result.skippedDuplicates.map((d, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                      <b className="text-amber-700">Row {d.row}:</b>{" "}
                      <span className="text-amber-600 font-medium">{d.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.createdCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                <IconCheck className="w-4 h-4 shrink-0" />
                <span>Go to the Draft tab below to review, verify formulas, and activate these questions.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button type="button" onClick={reset} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">
                Upload Another File
              </button>
              <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2">
                <IconCross className="w-3.5 h-3.5" /><span>Done</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </CommonModal>
  );
}
