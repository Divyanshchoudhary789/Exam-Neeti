"use client";

import React, { useRef, useState } from "react";
import { CommonModal, Spinner, IconUpload, IconCheck, IconCross, IconAlertTriangle } from "../common/UIComponents";
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
}

const ACCEPTED_EXTENSIONS = [".docx", ".xlsx"];

export function BulkUploadQuestionsModal({ isOpen, onClose, onSuccess, showToast }: BulkUploadQuestionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (f: File | null) => {
    if (f && !ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      showToast("Only .docx or .xlsx files are accepted.", "error");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminService.bulkUploadQuestions(file);
      const data = (res?.data || res) as BulkUploadResult;
      setResult(data);
      if (data.createdCount > 0) {
        showToast(`${data.createdCount} question(s) added as drafts — review them below.`, "success");
        onSuccess();
      } else {
        showToast("No questions were added — see the report below.", "error");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Bulk upload failed";
      showToast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <CommonModal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Questions" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Upload a filled-in copy of the sample template (.docx or .xlsx). Every question must already have any
          formulas written as LaTeX (<code>$...$</code>) — this file should not contain images. Every row is added
          to the bank as a <b>draft</b>; review each one on the &quot;My Questions&quot; page (add images, fix anything)
          before activating it for use in exams.
        </p>

        {!result && (
          <>
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
              {uploading ? <Spinner className="w-4 h-4 text-white" /> : <><IconUpload className="w-4 h-4" /><span>Upload & Parse</span></>}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
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
            </div>

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
                <span>Go to the Draft tab below to review, add images, and activate these questions.</span>
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
