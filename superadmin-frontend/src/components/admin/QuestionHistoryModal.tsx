"use client";

import React, { useEffect, useState } from "react";
import { adminService } from "../../services/apiServices";
import {
  CommonModal, Spinner,
  IconPlus, IconEdit, IconUpload, IconRefresh, IconThumbsUp, IconCross, IconUserX, IconClock,
} from "../common/UIComponents";

interface ActivityLogEntry {
  action:
    | "created" | "edited" | "status_changed" | "bulk_uploaded"
    | "reviewed" | "deactivated" | "reactivated";
  byEmail?: string;
  byRole?: string;
  at: string;
  meta?: {
    from?: string; to?: string; fileName?: string; file?: string;
    decision?: "approve" | "reject"; note?: string; via?: string; batchId?: string;
  };
}

interface QuestionHistory {
  questionId: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  status?: string;
  createdBy?: { email?: string } | null;
  reviewedBy?: { email?: string } | null;
  reviewedAt?: string | null;
  uploadBatch?: { fileName?: string } | null;
  createdAt?: string;
  activityLog: ActivityLogEntry[];
}

interface Props {
  isOpen: boolean;
  questionId: string | null;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
};

function entryMeta(a: ActivityLogEntry): { label: string; Icon: React.FC<{ className?: string }>; tone: string; detail: string | null } {
  switch (a.action) {
    case "created":
      return { label: "Created", Icon: IconPlus, tone: "text-indigo-600 bg-indigo-50 border-indigo-200",
        detail: a.meta?.via === "seed" ? "via seed script" : null };
    case "edited":
      return { label: "Edited", Icon: IconEdit, tone: "text-slate-600 bg-slate-100 border-slate-200", detail: null };
    case "bulk_uploaded":
      return { label: "Bulk uploaded", Icon: IconUpload, tone: "text-sky-600 bg-sky-50 border-sky-200",
        detail: a.meta?.fileName || a.meta?.file || null };
    case "reviewed": {
      const approved = a.meta?.decision === "approve";
      return {
        label: approved ? "Approved" : "Rejected",
        Icon: approved ? IconThumbsUp : IconCross,
        tone: approved ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200",
        detail: a.meta?.note ? `“${a.meta.note}”` : null,
      };
    }
    case "status_changed":
      return { label: "Status changed", Icon: IconRefresh, tone: "text-amber-600 bg-amber-50 border-amber-200",
        detail: a.meta?.from && a.meta?.to ? `${a.meta.from} → ${a.meta.to}` : null };
    case "deactivated":
      return { label: "Deactivated", Icon: IconUserX, tone: "text-red-600 bg-red-50 border-red-200",
        detail: a.meta?.via === "bulk" ? "bulk action" : null };
    case "reactivated":
      return { label: "Reactivated", Icon: IconRefresh, tone: "text-emerald-600 bg-emerald-50 border-emerald-200", detail: null };
    default:
      return { label: a.action, Icon: IconClock, tone: "text-slate-600 bg-slate-100 border-slate-200", detail: null };
  }
}

export function QuestionHistoryModal({ isOpen, questionId, onClose, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QuestionHistory | null>(null);

  useEffect(() => {
    if (!isOpen || !questionId) { setHistory(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await adminService.getQuestionHistory(questionId);
        const h = res?.data?.history || res?.history || res?.data || null;
        if (!cancelled) setHistory(h && typeof h === "object" ? h : null);
      } catch (err: unknown) {
        if (!cancelled) showToast((err as { message?: string }).message || "Failed to load history", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, questionId, showToast]);

  const log = history?.activityLog || [];

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title="Question History" maxWidth="max-w-lg">
      {loading ? (
        <div className="py-12 text-center"><Spinner className="w-7 h-7 text-indigo-600 mx-auto" /></div>
      ) : !history ? (
        <p className="py-10 text-center text-xs font-semibold text-slate-400">No history available.</p>
      ) : (
        <div className="space-y-4">
          {(history.subject || history.chapter) && (
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 capitalize">
                {history.subject}{history.chapter ? ` · ${history.chapter}` : ""}{history.topic ? ` · ${history.topic}` : ""}
              </span>
              {history.status && (
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                  history.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : history.status === "rejected" ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{history.status}</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <p className="text-slate-600">
              <span className="font-bold text-slate-500">Added by:</span>{" "}
              {history.createdBy?.email
                ? <span className="font-semibold text-slate-800">{history.createdBy.email}</span>
                : <span className="italic text-slate-400">not recorded (seeded before attribution tracking)</span>}
            </p>
            {history.reviewedBy?.email && (
              <p className="text-slate-600">
                <span className="font-bold text-slate-500">Last reviewed by:</span>{" "}
                <span className="font-semibold text-slate-800">{history.reviewedBy.email}</span>
                {history.reviewedAt && <span className="text-slate-400"> · {new Date(history.reviewedAt).toLocaleString()}</span>}
              </p>
            )}
          </div>

          {log.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
              No activity recorded for this question yet.
            </p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-2 space-y-4 pt-1">
              {log.map((a, i) => {
                const { label, Icon, tone, detail } = entryMeta(a);
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
