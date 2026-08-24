"use client";

import React, { useEffect } from "react";
import { RadialMeter } from "./Charts";

// ==========================================
// CLEAN SVG ICON COMPONENTS (STRICTLY NO EMOJIS)
// ==========================================
export const IconCheck = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const IconCross = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const IconClock = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const IconChart = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export const IconBook = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export const IconUsers = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export const IconShield = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export const IconDownload = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export const IconUpload = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
  </svg>
);

export const IconPlus = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

export const IconTrash = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const IconEdit = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const IconFilter = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

export const IconSearch = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export const IconEye = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export const IconChevronLeft = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export const IconChevronRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export const IconChevronDown = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export const IconLayers = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

export const IconTarget = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export const IconFileText = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const IconKey = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

export const IconAlertTriangle = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const IconInfo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const IconRefresh = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export const IconUserCheck = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm11 1l-5 5-2.5-2.5" />
  </svg>
);

export const IconUserX = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm7.5 0.5l-5 5m0-5l5 5" />
  </svg>
);

export const IconMail = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export const IconPhone = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

export const IconCopy = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

export const IconCode = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

export const IconArrowRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export const IconCalendar = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// ==========================================
// PAGINATION CONTROLS
// ==========================================
export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80">
      <div className="text-xs font-semibold text-slate-500">
        Page <span className="font-extrabold text-slate-900">{currentPage}</span> of{" "}
        <span className="font-extrabold text-slate-900">{totalPages}</span>
        {totalItems !== undefined && (
          <span> ({totalItems} total item{totalItems !== 1 ? "s" : ""})</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
          title="Previous Page"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === 1
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >
              1
            </button>
            {startPage > 2 && <span className="text-slate-400 font-bold px-1">...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === p
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-slate-400 font-bold px-1">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === totalPages
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
          title="Next Page"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// TOAST MESSAGES (LIGHT THEME)
// ==========================================
export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 inset-x-4 sm:top-6 sm:right-6 sm:left-auto sm:inset-x-auto z-[99999] flex flex-col gap-3 max-w-sm w-full mx-auto sm:mx-0 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-top-2 ${t.type === "success"
            ? "bg-white/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10"
            : t.type === "error"
              ? "bg-white/95 border-red-200 text-red-900 shadow-red-500/10"
              : "bg-white/95 border-indigo-200 text-indigo-900 shadow-indigo-500/10"
            }`}
        >
          <div className="flex items-center gap-3 text-xs font-bold">
            {t.type === "success" ? (
              <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                <IconCheck className="w-4 h-4" />
              </div>
            ) : t.type === "error" ? (
              <div className="p-1.5 rounded-xl bg-red-100 text-red-700">
                <IconCross className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
                <IconChart className="w-4 h-4" />
              </div>
            )}
            <span>{t.message}</span>
          </div>
          <button onClick={() => onClose(t.id)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors">
            <IconCross className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// LOADING SPINNER & SKELETON
// ==========================================
export function Spinner({ className = "w-6 h-6 text-indigo-600" }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 rounded-[2rem] bg-white border border-slate-200/80 animate-pulse space-y-4 shadow-sm">
      <div className="h-4 bg-slate-100 rounded-lg w-1/3" />
      <div className="h-8 bg-slate-100 rounded-xl w-2/3" />
      <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
    </div>
  );
}

// ==========================================
// MODAL FRAMEWORK (LIGHT THEME)
// ==========================================
export function CommonModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-xl",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Close on Escape — every admin/superadmin/student modal is built on this
  // component, so without this none of them were keyboard-dismissible.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
      <div
        className={`relative w-full ${maxWidth} max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-[2.5rem] border border-slate-200/90 bg-white text-slate-900 shadow-2xl z-10 transition-all`}
      >
        <div className="flex items-center justify-between px-4 sm:px-8 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <IconCross className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="px-4 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-grow">{children}</div>
      </div>
    </div>
  );
}

// ==========================================
// BADGES & STAT CARDS (LIGHT THEME)
// ==========================================

// ==========================================
// 100% CUSTOM REACT POPOVER DROPDOWN COMPONENT
// (NO NATIVE OS BROWSER POPUP)
// ==========================================
export interface CustomDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface CustomSelectMenuProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  searchable?: boolean;
}

export function CustomSelectMenu({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "-- Select Option --",
  icon: Icon,
  disabled = false,
  className = "",
  buttonClassName = "",
  searchable = false,
}: CustomSelectMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  return (
    <div ref={dropdownRef} className={`relative w-full space-y-1 ${className}`} id={id}>
      {label && (
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-slate-50 hover:bg-white focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl border ${
          isOpen ? "border-indigo-500 ring-4 ring-indigo-500/10 bg-white shadow-md" : "border-slate-200 hover:border-slate-300"
        } transition-all outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-sm ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-slate-400 font-normal">{placeholder}</span>}
          </span>
        </div>
        <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-indigo-600" : ""}`} />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {searchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/50">
              <input
                type="text"
                autoFocus
                placeholder="Search options..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-slate-800"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">No options match search</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-900 font-bold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="min-w-0 flex-grow">
                      <p className="truncate font-semibold">{opt.label}</p>
                      {opt.sublabel && <p className="text-[11px] text-slate-400 truncate mt-0.5">{opt.sublabel}</p>}
                    </div>
                    {opt.badge && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <IconCheck className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CUSTOM STYLED RESPONSIVE SELECT DROPDOWN
// ==========================================
export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  selectClassName?: string;
}

export function CustomSelect({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  disabled = false,
  required = false,
  className = "",
  selectClassName = "",
}: CustomSelectProps) {
  return (
    <div className={`w-full space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
          {label}
        </label>
      )}
      <div className="relative flex items-center group">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`w-full appearance-none bg-slate-50 hover:bg-white focus:bg-white text-slate-800 text-xs sm:text-sm font-semibold rounded-xl sm:rounded-2xl border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
            Icon ? "pl-10" : "pl-3.5 sm:pl-4"
          } pr-10 py-2.5 sm:py-3 shadow-sm ${selectClassName}`}
        >
          {placeholder && (
            <option value="" className="text-slate-400 font-normal">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-800 font-medium py-1 bg-white">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 pointer-events-none text-slate-400 group-hover:text-slate-600 group-focus-within:text-indigo-600 transition-colors z-10">
          <IconChevronDown className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "active" || s === "completed" || s === "passed" || s === "true") {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-sm";
  } else if (s === "draft" || s === "pending" || s === "in_progress") {
    color = "bg-amber-50 text-amber-700 border-amber-200/80 shadow-sm";
  } else if (s === "failed" || s === "inactive" || s === "false") {
    color = "bg-red-50 text-red-700 border-red-200/80 shadow-sm";
  }

  return (
    <span className={`inline-flex items-center px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}

export function StatusDropdownBadge({
  status,
  onChange,
}: {
  status: string;
  onChange: (newStatus: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const current = (status || "draft").toLowerCase();

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statuses = [
    { id: "draft", label: "DRAFT", badge: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100" },
    { id: "active", label: "ACTIVE", badge: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" },
    { id: "completed", label: "COMPLETED", badge: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" },
    { id: "archived", label: "ARCHIVED", badge: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200" },
  ];

  const currentOpt = statuses.find((s) => s.id === current) || statuses[0];

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs ${currentOpt.badge}`}
        title="Click to change status"
      >
        <span>{currentOpt.label}</span>
        <IconChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 w-36 space-y-1 animate-in fade-in slide-in-from-top-1">
          <div className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Select Status
          </div>
          {statuses.map((item) => {
            const isSelected = item.id === current;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isSelected) onChange(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{item.label}</span>
                {isSelected && <IconCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MiniStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  ringValue,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: string;
  /** When set (a 0-100 number), a small progress ring replaces the plain icon badge — for percentage-type stats (coverage, readiness, accuracy). */
  ringValue?: number;
}) {
  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] bg-white border border-slate-200/80 shadow-md relative overflow-hidden group hover:shadow-xl hover:border-indigo-300 hover:-translate-y-0.5 transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">{title}</p>
          <h4 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
          {subtitle && <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 line-clamp-1">{subtitle}</p>}
        </div>
        {ringValue !== undefined ? (
          <div className="shrink-0 group-hover:scale-110 transition-transform">
            <RadialMeter value={ringValue} size={44} strokeWidth={4.5} />
          </div>
        ) : Icon ? (
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:scale-110 transition-transform shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        ) : null}
      </div>
      {trend && (
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center text-[10px] sm:text-[11px] font-bold text-emerald-600">
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
