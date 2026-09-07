"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminService } from "../../services/apiServices";
import { CustomSelect } from "../common/CustomSelect";
import {
  IconClock, IconTrash, IconCheck, IconCross, IconSearch, IconAlertTriangle,
  Spinner, PaginationControls,
} from "../common/UIComponents";
import { confirmDialog, promptDialog } from "../common/feedback";
import { SprintHistoryModal } from "./SprintHistoryModal";
import { SprintPaperDownloadButton } from "./SprintPaperDownloadButton";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
}

interface SprintRow {
  _id?: string;
  id?: string;
  name?: string;
  status?: string;
  classLevel?: string | null;
  totalQuestions?: number;
  subjectProgress?: { subject: string; status: string }[];
  deletionRequest?: { status?: string; reason?: string; requestedBy?: { email?: string } };
  createdBy?: { name?: string; email?: string };
  createdAt?: string;
}

const SUBJ_TONE: Record<string, string> = {
  physics: "bg-cyan-50 text-cyan-700 border-cyan-200",
  chemistry: "bg-amber-50 text-amber-700 border-amber-200",
  biology: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * Super-admin sprint oversight: the pending deletion-request queue (approve →
 * the sprint is deleted, reject → it's kept) plus a filterable read/audit view
 * of every sprint with its per-subject completion and full history.
 */
export function SprintOversightPanel({ showToast }: Props) {
  const [requests, setRequests] = useState<SprintRow[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  const [sprints, setSprints] = useState<SprintRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [historyId, setHistoryId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await adminService.listSprintDeletionRequests({ limit: 50 });
      const list = res?.data?.requests || res?.requests || res?.data || [];
      setRequests(Array.isArray(list) ? list : []);
    } catch {
      showToast("Failed to load deletion requests", "error");
    } finally {
      setReqLoading(false);
    }
  }, [showToast]);

  const loadSprints = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await adminService.getSprints({
        page, limit: 12,
        status: statusFilter || undefined,
        classLevel: classFilter || undefined,
        search: search.trim() || undefined,
      });
      const list = res?.data?.sprints || res?.sprints || res?.data || [];
      setSprints(Array.isArray(list) ? list : []);
      setTotalPages(res?.data?.pagination?.totalPages || res?.pagination?.totalPages || 1);
      setTotalItems(res?.data?.pagination?.total ?? res?.pagination?.total ?? (Array.isArray(list) ? list.length : 0));
    } catch {
      showToast("Failed to load sprints", "error");
    } finally {
      setListLoading(false);
    }
  }, [page, statusFilter, classFilter, search, showToast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadSprints(); }, [loadSprints]);
  useEffect(() => { setPage(1); }, [statusFilter, classFilter, search]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    const approving = decision === "approve";
    const note = await promptDialog({
      title: approving ? "Approve deletion request?" : "Reject deletion request?",
      message: approving
        ? "The sprint will be permanently deleted once approved."
        : "The deletion request is dismissed and the sprint is kept.",
      placeholder: "Note for the requesting admin (optional)",
      multiline: true,
      confirmText: approving ? "Approve & delete" : "Reject request",
      tone: approving ? "danger" : "default",
    });
    if (note === null) return;
    setDeciding(id);
    try {
      const res = await adminService.decideSprintDeletion(id, decision, note);
      showToast(res?.message || (decision === "approve" ? "Sprint deleted." : "Request rejected."), "success");
      loadRequests();
      loadSprints();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message || "Decision failed", "error");
    } finally {
      setDeciding(null);
    }
  };

  const directDelete = async (id: string, name: string) => {
    if (!(await confirmDialog({
      title: "Delete draft sprint?",
      message: `"${name}" will be deleted directly. This cannot be undone.`,
      confirmText: "Delete sprint",
      tone: "danger",
    }))) return;
    try {
      await adminService.deleteSprint(id);
      showToast("Sprint deleted.", "success");
      loadSprints();
      loadRequests();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message || "Delete failed", "error");
    }
  };

  const subjectBadges = (sp?: { subject: string; status: string }[]) =>
    (sp || []).map((x) => (
      <span
        key={x.subject}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold capitalize ${SUBJ_TONE[x.subject] || "bg-slate-50 text-slate-600 border-slate-200"} ${x.status !== "done" ? "opacity-60" : ""}`}
      >
        {x.status === "done" ? <IconCheck className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {x.subject.slice(0, 4)}
      </span>
    ));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Deletion request queue ─────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-lg font-black text-slate-900">Sprint Deletion Requests</h2>
          {requests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">{requests.length}</span>
          )}
        </div>

        {reqLoading ? (
          <div className="py-8 text-center"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
        ) : requests.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400 py-4 text-center">No pending deletion requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const id = String(r._id || r.id);
              return (
                <div key={id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        {r.totalQuestions} questions · {r.status}
                        {r.classLevel ? ` · Class ${r.classLevel}` : ""}
                        {r.deletionRequest?.requestedBy?.email ? ` · requested by ${r.deletionRequest.requestedBy.email}` : ""}
                      </div>
                    </div>
                    <button onClick={() => setHistoryId(id)} className="shrink-0 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer">
                      <IconClock className="w-3.5 h-3.5" /> History
                    </button>
                  </div>
                  {r.deletionRequest?.reason && (
                    <p className="text-[11px] text-slate-600 italic bg-white/60 rounded-lg px-2.5 py-1.5 border border-amber-100">“{r.deletionRequest.reason}”</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => decide(id, "approve")}
                      disabled={deciding === id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      {deciding === id ? <Spinner className="w-3 h-3" /> : <IconTrash className="w-3 h-3" />} Approve &amp; delete
                    </button>
                    <button
                      onClick={() => decide(id, "reject")}
                      disabled={deciding === id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      <IconCross className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── All sprints ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sprint name / description..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All Statuses" },
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "archived", label: "Archived" },
            ]}
            className="lg:w-44"
          />
          <CustomSelect
            value={classFilter}
            onChange={setClassFilter}
            options={[
              { value: "", label: "All Classes" },
              { value: "XI", label: "Class XI" },
              { value: "XII", label: "Class XII" },
              { value: "dropper", label: "Dropper" },
            ]}
            className="lg:w-40"
          />
        </div>

        {listLoading ? (
          <div className="py-10 text-center"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
        ) : sprints.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No sprints match these filters.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sprints.map((s) => {
                const id = String(s._id || s.id);
                const st = String(s.status || "draft").toLowerCase();
                const delPending = s.deletionRequest?.status === "pending";
                return (
                  <div key={id} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 flex flex-col justify-between ${delPending ? "border-amber-300" : "border-slate-200/90"}`}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-black text-slate-900 leading-snug">{s.name}</h4>
                        <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-slate-100 text-slate-600 border-slate-200">{st}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.classLevel && (
                          <span className="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                            {s.classLevel === "dropper" ? "Dropper" : `Class ${s.classLevel}`}
                          </span>
                        )}
                        {subjectBadges(s.subjectProgress)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        {s.totalQuestions} questions · by {s.createdBy?.email || s.createdBy?.name || "—"}
                      </div>
                      {delPending && (
                        <p className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">Deletion request pending — see queue above</p>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                      <SprintPaperDownloadButton sprintId={id} sprintName={String(s.name || "")} showToast={showToast} />
                      <button onClick={() => setHistoryId(id)} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-200 border border-slate-200 cursor-pointer" title="History">
                        <IconClock className="w-4 h-4" />
                      </button>
                      {st === "draft" && !delPending && (
                        <button onClick={() => directDelete(id, String(s.name || "sprint"))} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer" title="Delete draft sprint directly">
                          <IconTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <PaginationControls currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </>
        )}
      </section>

      <SprintHistoryModal
        isOpen={historyId !== null}
        sprintId={historyId}
        onClose={() => setHistoryId(null)}
        showToast={showToast}
      />
    </div>
  );
}
