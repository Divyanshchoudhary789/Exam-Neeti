"use client";

import React, { useEffect, useState } from "react";
import { adminService } from "../../services/apiServices";
import {
  CommonModal, Spinner,
  IconPlus, IconEdit, IconRefresh, IconCheck, IconCross, IconClock, IconTrash,
} from "../common/UIComponents";

interface SprintActivityEntry {
  action:
    | "created" | "meta_edited" | "blueprint_edited" | "subject_marked"
    | "status_changed" | "delete_requested" | "delete_approved" | "delete_rejected";
  byEmail?: string;
  byRole?: string;
  at: string;
  meta?: Record<string, unknown>;
}

interface SubjectProgress {
  subject: string;
  status: "pending" | "in_progress" | "done";
  markedBy?: { email?: string } | null;
  markedAt?: string | null;
  note?: string;
}

interface SprintHistory {
  sprintId: string;
  name?: string;
  status?: string;
  classLevel?: string | null;
  createdBy?: { name?: string; email?: string } | null;
  subjectProgress?: SubjectProgress[];
  deletionRequest?: {
    status?: string;
    requestedBy?: { email?: string };
    reason?: string;
    decidedBy?: { email?: string };
    decisionNote?: string;
  } | null;
  createdAt?: string;
  activityLog: SprintActivityEntry[];
}

interface Props {
  isOpen: boolean;
  sprintId: string | null;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Admin" };

const SUBJECT_TONE: Record<string, string> = {
  physics: "bg-cyan-50 text-cyan-800 border-cyan-200",
  chemistry: "bg-amber-50 text-amber-800 border-amber-200",
  biology: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

const PROGRESS_TONE: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
  in_progress: "bg-sky-100 text-sky-800 border-sky-300",
  pending: "bg-slate-100 text-slate-600 border-slate-300",
};

function meta(a: SprintActivityEntry): { label: string; Icon: React.FC<{ className?: string }>; tone: string; detail: string | null } {
  const m = a.meta || {};
  switch (a.action) {
    case "created":
      return { label: "Created", Icon: IconPlus, tone: "text-indigo-600 bg-indigo-50 border-indigo-200",
        detail: m.status ? `as ${m.status}` : null };
    case "meta_edited":
      return { label: "Details edited", Icon: IconEdit, tone: "text-slate-600 bg-slate-100 border-slate-200",
        detail: Array.isArray(m.fields) ? (m.fields as string[]).join(", ") : null };
    case "blueprint_edited":
      return { label: "Blueprint edited", Icon: IconEdit, tone: "text-violet-600 bg-violet-50 border-violet-200",
        detail: m.totalQuestions ? `${m.totalQuestions} slots` : null };
    case "subject_marked":
      return {
        label: `${String(m.subject || "Subject")} → ${String(m.to || "")}`,
        Icon: m.to === "done" ? IconCheck : IconRefresh,
        tone: m.to === "done" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-sky-600 bg-sky-50 border-sky-200",
        detail: m.note ? `“${m.note}”` : null,
      };
    case "status_changed":
      return { label: "Status changed", Icon: IconRefresh, tone: "text-amber-600 bg-amber-50 border-amber-200",
        detail: m.from && m.to ? `${m.from} → ${m.to}` : null };
    case "delete_requested":
      return { label: "Deletion requested", Icon: IconTrash, tone: "text-red-600 bg-red-50 border-red-200",
        detail: m.reason ? `“${m.reason}”` : null };
    case "delete_approved":
      return { label: "Deletion approved", Icon: IconTrash, tone: "text-red-700 bg-red-100 border-red-300", detail: null };
    case "delete_rejected":
      return { label: "Deletion rejected", Icon: IconCross, tone: "text-slate-600 bg-slate-100 border-slate-200",
        detail: m.note ? `“${m.note}”` : null };
    default:
      return { label: a.action, Icon: IconClock, tone: "text-slate-600 bg-slate-100 border-slate-200", detail: null };
  }
}

export function SprintHistoryModal({ isOpen, sprintId, onClose, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SprintHistory | null>(null);

  useEffect(() => {
    if (!isOpen || !sprintId) { setHistory(null); return; }
    let cancelled = false;
    setLoading(true);
    adminService.getSprintHistory(sprintId)
      .then((res) => {
        const h = res?.data?.history || res?.history || null;
        if (!cancelled) setHistory(h && typeof h === "object" ? h : null);
      })
      .catch((err: unknown) => {
        if (!cancelled) showToast((err as { message?: string }).message || "Failed to load sprint history", "error");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, sprintId, showToast]);

  const log = history?.activityLog || [];
  const subjects = history?.subjectProgress || [];
  const del = history?.deletionRequest;

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title="Sprint History" maxWidth="max-w-lg">
      {loading ? (
        <div className="py-12 text-center"><Spinner className="w-7 h-7 text-indigo-600 mx-auto" /></div>
      ) : !history ? (
        <p className="py-10 text-center text-xs font-semibold text-slate-400">No history available.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
            <span className="text-sm font-black text-slate-900">{history.name}</span>
            {history.status && (
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-slate-100 text-slate-600 border-slate-200">
                {history.status}
              </span>
            )}
            {history.classLevel && (
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                Class {history.classLevel}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">
            <span className="font-bold text-slate-500">Created by:</span>{" "}
            <span className="font-semibold text-slate-800">
              {history.createdBy?.email || history.createdBy?.name || "—"}
            </span>
            {history.createdAt && <span className="text-slate-400"> · {new Date(history.createdAt).toLocaleDateString()}</span>}
          </p>

          {subjects.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Subject completion</p>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span key={s.subject} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold capitalize ${SUBJECT_TONE[s.subject] || "bg-slate-50 border-slate-200"}`}>
                    {s.subject}
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${PROGRESS_TONE[s.status]}`}>
                      {s.status === "in_progress" ? "in progress" : s.status}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {del && del.status && del.status !== "none" && (
            <div className={`rounded-xl border p-3 text-[11px] ${del.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <span className="font-black uppercase">Deletion {del.status}</span>
              {del.requestedBy?.email && <> · by {del.requestedBy.email}</>}
              {del.reason && <div className="mt-1 italic">“{del.reason}”</div>}
              {del.decisionNote && <div className="mt-1">Decision: “{del.decisionNote}”</div>}
            </div>
          )}

          {log.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">No activity recorded yet.</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-2 space-y-4 pt-1">
              {log.map((a, i) => {
                const { label, Icon, tone, detail } = meta(a);
                return (
                  <li key={i} className="ml-4">
                    <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full border ${tone}`}>
                      <Icon className="w-2.5 h-2.5" />
                    </span>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-xs font-bold text-slate-800">{label}</span>
                      <span className="text-xs text-slate-400">by</span>
                      <span className="text-xs font-semibold text-slate-700">{a.byEmail || "unknown"}</span>
                      {a.byRole && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase">
                          {ROLE_LABEL[a.byRole] || a.byRole}
                        </span>
                      )}
                    </div>
                    {detail && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{detail}</p>}
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{new Date(a.at).toLocaleString()}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </CommonModal>
  );
}
