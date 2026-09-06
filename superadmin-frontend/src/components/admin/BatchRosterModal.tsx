"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner, StatusBadge, IconUsers } from "../common/UIComponents";
import { adminService, UserProfile } from "../../services/apiServices";

interface BatchRosterModalProps {
  isOpen: boolean;
  batchId: string;
  batchName: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function BatchRosterModal({
  isOpen,
  batchId,
  batchName,
  onClose,
  showToast,
}: BatchRosterModalProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen && batchId) {
      const fetchRoster = async () => {
        setLoading(true);
        try {
          const res = await adminService.getBatchStudents(batchId);
          const raw = res?.data?.students || res?.students || res?.data || res || [];
          setStudents(Array.isArray(raw) ? raw : []);
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
              ?.message ||
            (err as { message?: string }).message ||
            "Failed to load batch roster";
          showToast(msg, "error");
        } finally {
          setLoading(false);
        }
      };
      fetchRoster();
    }
  }, [isOpen, batchId, showToast]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Batch Roster: ${batchName}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-slate-800">
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            placeholder="Search students in this batch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 shrink-0 bg-slate-100 px-3 py-2 rounded-xl">
            <IconUsers className="w-4 h-4 text-indigo-600" />
            <span>{students.length} Enrolled</span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading batch roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500 font-semibold">
            No students found in this batch.
          </p>
        ) : (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80">
            {filteredStudents.map((st) => (
              <div key={st._id} className="p-3.5 flex items-center justify-between gap-3 bg-white">
                <div>
                  <p className="text-xs font-black text-slate-900">{st.name}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">{st.email}</p>
                </div>
                <StatusBadge status={st.isActive !== false ? "Active" : "Inactive"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CommonModal>
  );
}
