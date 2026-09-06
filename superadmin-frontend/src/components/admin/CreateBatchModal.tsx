"use client";

import React, { useState } from "react";
import { CommonModal, Spinner, IconBook, IconLayers, IconClock } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const PROGRAM_OPTIONS = [
  {
    id: "class_xi",
    label: "Class XI",
    badge: "2-Year Foundation",
    icon: IconBook,
    color: "from-blue-500/10 to-indigo-500/10 border-indigo-200 text-indigo-900",
    activeColor: "bg-indigo-600 text-white border-indigo-600 shadow-md",
    description: "Designed for Class 11 students starting 2-year NEET preparation.",
  },
  {
    id: "class_xii",
    label: "Class XII",
    badge: "1-Year Target",
    icon: IconLayers,
    color: "from-purple-500/10 to-pink-500/10 border-purple-200 text-purple-900",
    activeColor: "bg-purple-600 text-white border-purple-600 shadow-md",
    description: "Designed for Class 12 students targeting upcoming NEET exam.",
  },
  {
    id: "dropper",
    label: "Dropper / Repeater",
    badge: "Full Syllabus",
    icon: IconClock,
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-900",
    activeColor: "bg-emerald-600 text-white border-emerald-600 shadow-md",
    description: "Intensive 1-year full syllabus target batch for post-12th repeaters.",
  },
] as const;

const PRESET_NAMES = [
  "Achievers 2026 Batch A",
  "Pinnacle 2026 Batch B",
  "NEET Dropper Target A",
  "Class 11 Foundation 2027",
];

export function CreateBatchModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: CreateBatchModalProps) {
  const [name, setName] = useState("");
  const [programType, setProgramType] = useState<"class_xi" | "class_xii" | "dropper">("class_xi");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      showToast("Batch name must be at least 2 characters long", "error");
      return;
    }

    if (trimmedName.length > 100) {
      showToast("Batch name cannot exceed 100 characters", "error");
      return;
    }

    if (description.length > 500) {
      showToast("Description cannot exceed 500 characters", "error");
      return;
    }

    setSubmitting(true);
    try {
      await adminService.createBatch({
        name: trimmedName,
        programType,
        description: description.trim(),
      });

      showToast("Batch created successfully!", "success");
      onSuccess();
      onClose();

      setName("");
      setDescription("");
      setProgramType("class_xi");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string }).message ||
        "Failed to create batch";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Student Batch"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block">
              Batch Name <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">
              {name.length}/100 chars
            </span>
          </div>
          <input
            type="text"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Achievers 2026 Batch A"
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
          />

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] text-slate-400 font-semibold">Quick suggest:</span>
            {PRESET_NAMES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setName(preset)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-2">
            Program Type <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROGRAM_OPTIONS.map((prog) => {
              const isSelected = programType === prog.id;
              const Icon = prog.icon;
              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => setProgramType(prog.id as "class_xi" | "class_xii" | "dropper")}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Icon className="w-4 h-4 text-indigo-600" />
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {prog.badge}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-900">{prog.label}</h4>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug font-medium">
                    {prog.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block">
              Description & Notes (Optional)
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">
              {description.length}/500 chars
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add batch schedule, target exam year, faculty notes, or instructions..."
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {submitting ? (
              <>
                <Spinner className="w-4 h-4 text-white" />
                <span>Creating Batch...</span>
              </>
            ) : (
              <span>Create Batch</span>
            )}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
