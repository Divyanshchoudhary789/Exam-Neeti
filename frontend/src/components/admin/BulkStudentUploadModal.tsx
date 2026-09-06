"use client";

import React, { useState, useRef } from "react";
import { adminService } from "../../services/apiServices";
import { CustomSelect } from "../common/CustomSelect";
import {
  CommonModal, Spinner, IconDownload, IconUpload, IconCheck, IconCross, IconLayers,
} from "../common/UIComponents";

interface Props {
  isOpen: boolean;
  batchList: Record<string, unknown>[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

interface ImportResult {
  batchName?: string;
  totalRows?: number;
  totalCreated: number;
  totalFailed: number;
  created: { email: string; name: string }[];
  failed: { row?: number; email?: string | null; reason: string }[];
}

/**
 * Bulk student import from a filled .xlsx / .docx roster. Admin picks the
 * target batch, downloads the sample format, fills it, uploads it. Emails
 * already on the platform are skipped and reported.
 */
export function BulkStudentUploadModal({ isOpen, batchList, onClose, onSuccess, showToast }: Props) {
  const [batchId, setBatchId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState<"xlsx" | "docx" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const batchOptions = batchList
    .filter((b) => String(b.source ?? "coaching") !== "public")
    .map((b) => ({ value: String(b._id || b.id), label: String(b.name || "Batch") }));

  const reset = () => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleDownload = async (format: "xlsx" | "docx") => {
    setDownloading(format);
    try {
      const { objectUrl, filename } = await adminService.downloadStudentTemplate(format);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to download template", "error");
    } finally {
      setDownloading(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId) { showToast("Choose a target batch first.", "error"); return; }
    if (!file) { showToast("Attach a .xlsx or .docx roster file.", "error"); return; }
    setUploading(true);
    setResult(null);
    try {
      const res = await adminService.bulkImportStudentsFile(file, batchId);
      const data = (res?.data || res) as ImportResult;
      setResult(data);
      showToast(`${data.totalCreated} student(s) imported${data.totalFailed ? `, ${data.totalFailed} skipped` : ""}.`, data.totalCreated > 0 ? "success" : "error");
      if (data.totalCreated > 0) onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message || "Import failed";
      showToast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <CommonModal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Bulk Import Students" maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Download the sample format, fill one student per row (Name + Email required, Phone &amp; Temp Password optional),
          then upload it below. A secure password is generated and emailed to each new student when you leave it blank.
        </p>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleDownload("xlsx")} disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50">
            {downloading === "xlsx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
            <span>Excel sample</span>
          </button>
          <button onClick={() => handleDownload("docx")} disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50">
            {downloading === "docx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
            <span>Word sample</span>
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1.5">
              <IconLayers className="w-3.5 h-3.5 text-indigo-600" /> Target batch
            </label>
            <CustomSelect options={batchOptions} value={batchId} onChange={setBatchId} placeholder="Select coaching batch" className="w-full" />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">Roster file (.xlsx or .docx)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          <button type="submit" disabled={uploading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer">
            {uploading ? <Spinner className="w-4 h-4 text-white" /> : <IconUpload className="w-4 h-4" />}
            {uploading ? "Importing…" : "Import Students"}
          </button>
        </form>

        {result && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-emerald-700"><IconCheck className="w-3.5 h-3.5" />{result.totalCreated} created</span>
              {result.totalFailed > 0 && <span className="inline-flex items-center gap-1.5 text-amber-700"><IconCross className="w-3.5 h-3.5" />{result.totalFailed} skipped</span>}
              {result.batchName && <span className="text-slate-500">→ {result.batchName}</span>}
            </div>
            {result.failed.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.failed.map((f, i) => (
                  <p key={i} className="text-[11px] text-slate-600">
                    {f.row ? <b>Row {f.row}</b> : null} {f.email ? <span className="text-slate-400">{f.email}</span> : null} — {f.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CommonModal>
  );
}
