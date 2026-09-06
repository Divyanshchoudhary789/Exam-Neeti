"use client";

import React, { useCallback, useEffect, useState } from "react";
import { superAdminService, adminService } from "../../services/apiServices";
import {
  IconAlertTriangle, IconTrash, IconUsers, IconFilter, IconRefresh,
  StatusBadge, Spinner, CustomSelectMenu,
} from "../common/UIComponents";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
  onPurged?: () => void;
}

type StudentRow = { _id: string; name: string; email: string; phone?: string; batch?: { _id?: string; name?: string } | string; isActive?: boolean };
type BatchRow = { _id: string; name: string; programType?: string; description?: string };

export function GovernancePurgePanel({ showToast, onPurged }: Props) {
  const [purgeStudentId, setPurgeStudentId] = useState("");
  const [purgeStudentEmailConfirm, setPurgeStudentEmailConfirm] = useState("");
  const [purgeStudentSubmitting, setPurgeStudentSubmitting] = useState(false);

  const [studentOptions, setStudentOptions] = useState<StudentRow[]>([]);
  const [selectedStudentForPurge, setSelectedStudentForPurge] = useState<StudentRow | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [purgeBatchId, setPurgeBatchId] = useState("");
  const [purgeBatchNameConfirm, setPurgeBatchNameConfirm] = useState("");
  const [purgeBatchForce, setPurgeBatchForce] = useState(false);
  const [purgeBatchSubmitting, setPurgeBatchSubmitting] = useState(false);
  const [batchOptions, setBatchOptions] = useState<BatchRow[]>([]);

  const loadBatchesForPurge = useCallback(async () => {
    try {
      const res = await adminService.getBatches();
      const bList = res?.data?.batches || res?.batches || (Array.isArray(res?.data) ? res.data : []);
      setBatchOptions(Array.isArray(bList) ? bList : []);
    } catch { /* non-critical */ }
  }, []);

  const loadStudentsForPurge = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const res = await adminService.getUsers({ role: "student", limit: 100 });
      const list = res?.data?.students || res?.data?.users || res?.students || res?.users || (Array.isArray(res?.data) ? res.data : []);
      setStudentOptions(Array.isArray(list) ? list : []);
    } catch { /* non-critical */ } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => { loadBatchesForPurge(); loadStudentsForPurge(); }, [loadBatchesForPurge, loadStudentsForPurge]);

  const handlePurgeStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeStudentId.trim() || !purgeStudentEmailConfirm.trim()) {
      showToast("Please provide both Student ID and exact Confirmation Email", "error");
      return;
    }
    setPurgeStudentSubmitting(true);
    try {
      const res = await superAdminService.hardDeleteStudent(purgeStudentId.trim(), purgeStudentEmailConfirm.trim().toLowerCase());
      showToast(res?.message || "Student account permanently purged.");
      setPurgeStudentId("");
      setPurgeStudentEmailConfirm("");
      setSelectedStudentForPurge(null);
      loadStudentsForPurge();
      onPurged?.();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Hard delete student failed", "error");
    } finally {
      setPurgeStudentSubmitting(false);
    }
  };

  const handlePurgeBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeBatchId || !purgeBatchNameConfirm.trim()) {
      showToast("Please select a Batch and type exact confirmation name", "error");
      return;
    }
    setPurgeBatchSubmitting(true);
    try {
      const res = await superAdminService.hardDeleteBatch(purgeBatchId, purgeBatchNameConfirm.trim(), purgeBatchForce);
      showToast(res?.message || "Batch permanently purged from platform.");
      setPurgeBatchId("");
      setPurgeBatchNameConfirm("");
      setPurgeBatchForce(false);
      loadBatchesForPurge();
      onPurged?.();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Hard delete batch failed", "error");
    } finally {
      setPurgeBatchSubmitting(false);
    }
  };

  const inp = "w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-red-50/80 border border-red-200 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="p-3 bg-red-100 rounded-2xl text-red-700 shrink-0"><IconAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" /></div>
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-black text-red-900">Irreversible Platform Hard Delete Operations</h3>
          <p className="text-xs text-red-800/90 font-medium leading-relaxed">
            These operations permanently purge data from the database. Soft deactivation is recommended for normal administrative workflows. Hard deletes bypass soft flags and cannot be undone.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Purge student */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-red-700"><IconTrash className="w-5 h-5" /><h3 className="text-base font-black text-slate-900">Permanently Purge Student Account</h3></div>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">Select a student from the system database or enter details. Requires exact email confirmation.</p>
          <form onSubmit={handlePurgeStudentSubmit} className="space-y-4 pt-1">
            <CustomSelectMenu
              id="selectStudentPurge"
              label="Select Target Student from Database"
              value={selectedStudentForPurge?._id || ""}
              onChange={(stdId) => {
                const std = studentOptions.find((s) => s._id === stdId) || null;
                setSelectedStudentForPurge(std);
                if (std) { setPurgeStudentId(std._id); setPurgeStudentEmailConfirm(""); }
              }}
              placeholder={studentsLoading ? "Loading students..." : "-- Search by Name or Email --"}
              options={studentOptions.map((s) => ({
                value: s._id,
                label: `${s.name} (${s.email})`,
                sublabel: `Batch: ${typeof s.batch === "object" ? s.batch?.name : s.batch || "Unassigned"} • ID: ${s._id}`,
                badge: s.isActive !== false ? "Active" : "Inactive",
              }))}
              icon={IconUsers}
              searchable
            />
            {selectedStudentForPurge && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase text-[10px] text-indigo-800 tracking-wider">Selected Student Record</span>
                  <StatusBadge status={selectedStudentForPurge.isActive !== false ? "Active" : "Inactive"} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                  <div><span className="text-slate-400 font-normal">Name:</span> <span className="font-bold text-slate-900">{selectedStudentForPurge.name}</span></div>
                  <div><span className="text-slate-400 font-normal">Email:</span> <span className="font-bold text-slate-900">{selectedStudentForPurge.email}</span></div>
                  <div><span className="text-slate-400 font-normal">Phone:</span> <span className="font-bold text-slate-900">{selectedStudentForPurge.phone || "N/A"}</span></div>
                  <div><span className="text-slate-400 font-normal">Batch:</span> <span className="font-bold text-slate-900">{typeof selectedStudentForPurge.batch === "object" ? selectedStudentForPurge.batch?.name : selectedStudentForPurge.batch || "Unassigned"}</span></div>
                </div>
                <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">MongoDB ID: <code className="text-indigo-900 font-mono font-bold">{selectedStudentForPurge._id}</code></span>
                  <span className="text-amber-700 font-bold flex items-center gap-1"><IconAlertTriangle className="w-3.5 h-3.5" /> Type email below to confirm</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Student ID (24-char ObjectId)</label>
              <input type="text" required placeholder="e.g. 64f8a123bc45678901234567" value={purgeStudentId} onChange={(e) => {
                setPurgeStudentId(e.target.value);
                const match = studentOptions.find((s) => s._id === e.target.value.trim());
                if (match) setSelectedStudentForPurge(match);
              }} className={inp} />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Confirm Student Email</label>
              <input type="email" required placeholder="student@example.com" value={purgeStudentEmailConfirm} onChange={(e) => setPurgeStudentEmailConfirm(e.target.value)} className={inp} />
            </div>
            <button type="submit" disabled={purgeStudentSubmitting} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all">
              {purgeStudentSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Purge Student Account"}
            </button>
          </form>
        </div>

        {/* Purge batch */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-red-700"><IconTrash className="w-5 h-5" /><h3 className="text-base font-black text-slate-900">Permanently Purge Batch</h3></div>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">Permanently deletes a batch from the system. If active students exist, set Force to true.</p>
          <form onSubmit={handlePurgeBatchSubmit} className="space-y-4 pt-1">
            <CustomSelectMenu
              id="purgeBatchId"
              label="Select Target Batch"
              value={purgeBatchId}
              onChange={(bId) => { setPurgeBatchId(bId); setPurgeBatchNameConfirm(""); }}
              placeholder="-- Search or Select Batch --"
              options={batchOptions.map((b) => ({
                value: b._id,
                label: b.name,
                sublabel: `Program: ${b.programType || "Standard"} • ID: ${b._id}`,
              }))}
              icon={IconFilter}
              searchable
            />
            {purgeBatchId && (() => {
              const selBatch = batchOptions.find((b) => b._id === purgeBatchId);
              if (!selBatch) return null;
              return (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold uppercase text-[10px] text-amber-800 tracking-wider">Selected Batch Details</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">{selBatch.programType || "Batch Record"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                    <div><span className="text-slate-400 font-normal">Name:</span> <span className="font-bold text-slate-900">{selBatch.name}</span></div>
                    <div><span className="text-slate-400 font-normal">Batch ID:</span> <code className="font-mono text-slate-800 font-bold">{selBatch._id}</code></div>
                  </div>
                  {selBatch.description && <p className="text-[11px] text-slate-500 font-medium">{selBatch.description}</p>}
                  <div className="pt-1 text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                    <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Confirmation name set to: &ldquo;{selBatch.name}&rdquo;</span>
                  </div>
                </div>
              );
            })()}
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Confirm Batch Name</label>
              <input type="text" required placeholder="Exact batch name" value={purgeBatchNameConfirm} onChange={(e) => setPurgeBatchNameConfirm(e.target.value)} className={inp} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="forcePurgeBatch" checked={purgeBatchForce} onChange={(e) => setPurgeBatchForce(e.target.checked)} className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer w-4 h-4" />
              <label htmlFor="forcePurgeBatch" className="text-xs font-bold text-slate-700 cursor-pointer">Force delete even if active students are assigned</label>
            </div>
            <button type="submit" disabled={purgeBatchSubmitting} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all">
              {purgeBatchSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Purge Batch Record"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <IconUsers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">Enrolled Students Database Directory</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase border border-indigo-100">{studentOptions.length} Enrolled</span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Browse all enrolled student records to auto-select and populate purge confirmation fields.</p>
          </div>
          <button type="button" onClick={() => loadStudentsForPurge()} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0">
            <IconRefresh className="w-3.5 h-3.5 text-slate-500" /><span>Reload Student Data</span>
          </button>
        </div>
        {studentsLoading ? (
          <div className="p-6 text-center space-y-2"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /><p className="text-xs font-semibold text-slate-500">Loading student directory...</p></div>
        ) : studentOptions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-slate-200/60">No enrolled student records found in the platform database.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/30">
            {studentOptions.map((s) => (
              <div key={s._id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-900 truncate">{s.name}</p>
                    <StatusBadge status={s.isActive !== false ? "Active" : "Inactive"} />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {s.email} {s.phone ? `• ${s.phone}` : ""} &bull; Batch: {typeof s.batch === "object" ? s.batch?.name : s.batch || "Unassigned"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {s._id}</p>
                </div>
                <button type="button" onClick={() => {
                  setSelectedStudentForPurge(s);
                  setPurgeStudentId(s._id);
                  setPurgeStudentEmailConfirm("");
                  window.scrollTo({ top: 350, behavior: "smooth" });
                }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer shrink-0 self-start sm:self-auto">
                  Select for Purge &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
