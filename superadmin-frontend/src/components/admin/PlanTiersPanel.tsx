"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminService, type PlanOverviewRow } from "../../services/apiServices";
import {
  IconRocket, IconBook, IconUsers, IconPlus, IconEdit, IconTrash, Spinner,
} from "../common/UIComponents";
import { PlanFormModal } from "./PlanFormModal";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
  /** Jump to the Exams tab filtered to this plan's batch. */
  onViewExams: (batchId: string) => void;
  /** Delete is super_admin-only. */
  role?: string;
}

const PROGRAM_LABEL: Record<string, string> = {
  class_xi: "Class XI",
  class_xii: "Class XII",
  dropper: "Dropper",
};

/**
 * Admin "Plans & Tiers" — create / edit / (de)activate / delete the self-serve
 * plan catalog. Each plan owns one public batch (auto-created); a student who
 * buys the plan lands in that batch, and you assign it tests from the Exams tab.
 */
export function PlanTiersPanel({ showToast, onViewExams, role }: Props) {
  const [rows, setRows] = useState<PlanOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanOverviewRow | null>(null);

  const isSuperAdmin = role === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getPlanOverview();
      const list = res?.data?.overview || res?.overview || [];
      setRows(Array.isArray(list) ? list : []);
    } catch {
      showToast("Failed to load plan overview", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row: PlanOverviewRow) => { setEditing(row); setModalOpen(true); };

  const toggleActive = async (row: PlanOverviewRow) => {
    setBusyId(row._id);
    try {
      await adminService.updatePlan(row._id, { isActive: !row.isActive });
      showToast(row.isActive ? "Plan deactivated — hidden from checkout." : "Plan reactivated.", "success");
      load();
    } catch (e: unknown) {
      showToast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: PlanOverviewRow) => {
    if (!window.confirm(`Delete the "${row.name}" plan and its batch? This can't be undone.`)) return;
    setBusyId(row._id);
    try {
      await adminService.deletePlan(row._id);
      showToast("Plan and its batch deleted.", "success");
      load();
    } catch (e: unknown) {
      showToast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Delete failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const totalExams = rows.reduce((n, r) => n + r.publishedCount, 0);
  const totalStudents = rows.reduce((n, r) => n + r.studentCount, 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Plans &amp; Tiers</h2>
          <p className="text-xs text-slate-500 font-semibold max-w-2xl">
            The self-serve pricing catalog. Creating a plan auto-creates its student batch —
            buyers land there, then you assign tests to that batch from <b>Create Exam → Audience</b>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all shrink-0"
        >
          <IconPlus className="w-4 h-4" /><span>New Plan</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MiniStat label="Plans" value={rows.length} icon={IconRocket} />
        <MiniStat label="Published tests across tiers" value={totalExams} icon={IconBook} />
        <MiniStat label="Students on self-serve plans" value={totalStudents} icon={IconUsers} />
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">
          No plans yet. Click <b>New Plan</b> to create your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r._id} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3 flex flex-col justify-between ${r.isFreeTier ? "border-emerald-200" : "border-slate-200/90"} ${!r.isActive ? "opacity-70" : ""}`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">{r.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {r.programType && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{PROGRAM_LABEL[r.programType] || r.programType}</span>
                      )}
                      {r.featured && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">Featured</span>}
                      {!r.isActive && <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase">Inactive</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase shrink-0 ${
                    r.isFreeTier ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}>
                    {r.isFreeTier ? "Free" : `₹${r.priceRupees.toLocaleString("en-IN")}`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-semibold">
                  {r.durationDays ? `${r.durationDays}-day access` : "One-time access"} · {r.testsIncluded} test{r.testsIncluded === 1 ? "" : "s"} included
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Chip>{r.publishedCount} published{r.examCount > r.publishedCount ? ` · ${r.examCount - r.publishedCount} draft` : ""}</Chip>
                  <Chip>{r.studentCount} student{r.studentCount === 1 ? "" : "s"}</Chip>
                  <Chip>{r.subscriberCount} subscriber{r.subscriberCount === 1 ? "" : "s"}</Chip>
                </div>
                {r.batchName && <p className="text-[10px] text-slate-400 font-bold pt-0.5">Batch: {r.batchName}</p>}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => r.batchId && onViewExams(r.batchId)}
                  disabled={!r.batchId}
                  className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  View / add this plan&apos;s tests
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(r)}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer transition-colors"
                  >
                    <IconEdit className="w-3.5 h-3.5" /> Edit
                  </button>
                  {!r.isTrial && (
                    <button
                      onClick={() => toggleActive(r)}
                      disabled={busyId === r._id}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border transition-colors disabled:opacity-50 ${
                        r.isActive
                          ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {r.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                  {isSuperAdmin && !r.isTrial && (
                    <button
                      onClick={() => remove(r)}
                      disabled={busyId === r._id}
                      className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors disabled:opacity-50"
                      title="Delete plan"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanFormModal
        isOpen={modalOpen}
        mode={editing ? "edit" : "create"}
        plan={editing}
        onClose={() => setModalOpen(false)}
        onSuccess={load}
        showToast={showToast}
      />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">{children}</span>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.FC<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
    </div>
  );
}
