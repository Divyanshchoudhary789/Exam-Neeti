"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner } from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { adminService, UserProfile } from "../../services/apiServices";

interface EditStudentModalProps {
  isOpen: boolean;
  userData: UserProfile | null;
  batchList: Record<string, unknown>[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function EditStudentModal({
  isOpen,
  userData,
  batchList,
  onClose,
  onSuccess,
  showToast,
}: EditStudentModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [batchId, setBatchId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setEmail(userData.email || "");
      setPhoneNumber(userData.phoneNumber || "");
      const b = userData.batch;
      if (typeof b === "object" && b !== null) {
        setBatchId(String(b._id || ""));
      } else if (typeof b === "string") {
        setBatchId(b);
      } else {
        setBatchId("");
      }
    }
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?._id) {
      showToast("Invalid user reference", "error");
      return;
    }

    setSubmitting(true);
    try {
      await adminService.updateUser(userData._id, {
        name: name.trim(),
        email: email.trim(),
        batch: batchId || null,
        phoneNumber: phoneNumber.trim() || undefined,
      });

      showToast("Student profile updated!", "success");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string }).message ||
        "Failed to update student";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Student Profile"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          />
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Email Address *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          />
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Assigned Batch
          </label>
          <CustomSelect
            options={batchList.map((b) => ({
              value: String(b._id || b.id),
              label: String(b.name || "Batch"),
            }))}
            value={batchId}
            onChange={setBatchId}
            placeholder="Select Batch"
            buttonClassName="w-full py-2.5 bg-slate-50 border border-slate-300 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 rounded-xl text-xs font-semibold transition-all"
          />
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+91 9876543210"
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
