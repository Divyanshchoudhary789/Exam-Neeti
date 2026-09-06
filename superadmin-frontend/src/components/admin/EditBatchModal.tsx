"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface EditBatchModalProps {
  isOpen: boolean;
  batchData: Record<string, unknown> | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function EditBatchModal({
  isOpen,
  batchData,
  onClose,
  onSuccess,
  showToast,
}: EditBatchModalProps) {
  const [name, setName] = useState("");
  const [programType, setProgramType] = useState<"class_xi" | "class_xii" | "dropper">("class_xi");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (batchData) {
      setName(String(batchData.name || ""));
      const p = String(batchData.programType || "class_xi");
      setProgramType((["class_xi", "class_xii", "dropper"].includes(p) ? p : "class_xi") as "class_xi" | "class_xii" | "dropper");
      setDescription(String(batchData.description || ""));
    }
  }, [batchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchData?._id && !batchData?.id) {
      showToast("Invalid batch reference", "error");
      return;
    }

    const bId = String(batchData._id || batchData.id);
    setSubmitting(true);

    try {
      await adminService.updateBatch(bId, {
        name: name.trim(),
        programType,
        description: description.trim(),
      });

      showToast("Batch updated successfully!", "success");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string }).message ||
        "Failed to update batch";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Student Batch"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Batch Name *
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
            Program Type *
          </label>
          <select
            value={programType}
            onChange={(e) => setProgramType(e.target.value as "class_xi" | "class_xii" | "dropper")}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold cursor-pointer"
          >
            <option value="class_xi">Class XI (2-Year Foundation)</option>
            <option value="class_xii">Class XII (1-Year Target)</option>
            <option value="dropper">Dropper / Repeater (Full Syllabus)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium resize-none"
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
