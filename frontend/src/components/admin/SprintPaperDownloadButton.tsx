"use client";

import React, { useState, useRef, useEffect } from "react";
import { adminService } from "../../services/apiServices";
import { IconDownload, IconFileText, Spinner } from "../common/UIComponents";

interface Props {
  sprintId: string;
  sprintName?: string;
  showToast: (msg: string, type?: "success" | "error") => void;
  /** "icon" (card action) or "button" (wider contexts). */
  variant?: "icon" | "button";
}

/**
 * Download the sprint's full question paper — pinned questions rendered in
 * full, unpinned slots shown as "not fixed" — as PDF or Word. Generation can
 * take a few seconds for a large blueprint, so the control shows a spinner.
 */
export function SprintPaperDownloadButton({ sprintId, sprintName, showToast, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const download = async (format: "pdf" | "docx") => {
    setBusy(format);
    setOpen(false);
    try {
      const { objectUrl, filename } = await adminService.downloadSprintPaper(sprintId, format);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      showToast(`Question paper (${format.toUpperCase()}) downloaded${sprintName ? ` — ${sprintName}` : ""}.`, "success");
    } catch (err: unknown) {
      // blob error bodies need decoding
      const e = err as { response?: { data?: Blob | { message?: string } }; message?: string };
      let msg = e?.message || "Download failed";
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try { msg = JSON.parse(await data.text())?.message || msg; } catch { /* keep msg */ }
      } else if (data && typeof data === "object" && "message" in data) {
        msg = (data as { message?: string }).message || msg;
      }
      showToast(msg, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        title="Download question paper"
        className={
          variant === "icon"
            ? "p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
            : "flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold cursor-pointer disabled:opacity-50"
        }
      >
        {busy ? <Spinner className="w-4 h-4" /> : <IconDownload className="w-4 h-4" />}
        {variant === "button" && <span>{busy ? "Preparing…" : "Question paper"}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs font-bold">
          <button onClick={() => download("pdf")} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer">
            <IconFileText className="w-3.5 h-3.5 text-red-500" /> PDF
          </button>
          <button onClick={() => download("docx")} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer">
            <IconFileText className="w-3.5 h-3.5 text-blue-500" /> Word (.docx)
          </button>
        </div>
      )}
    </div>
  );
}
