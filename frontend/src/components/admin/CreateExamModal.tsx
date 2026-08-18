"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner, IconBook, IconClock, IconLayers, IconCheck } from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { adminService } from "../../services/apiServices";

interface CreateExamModalProps {
  isOpen: boolean;
  sprintList: Record<string, unknown>[];
  batchList: Record<string, unknown>[];
  defaultSprintId?: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function CreateExamModal({
  isOpen,
  sprintList,
  batchList,
  defaultSprintId = "",
  onClose,
  onSuccess,
  showToast,
}: CreateExamModalProps) {
  const [sprintId, setSprintId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [scheduledAt, setScheduledAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeSprint = sprintList.find((s) => s.status === "active") || sprintList[0];
      const initialSprintId = defaultSprintId || String(activeSprint?._id || activeSprint?.id || "");
      setSprintId(initialSprintId);

      if (batchList.length > 0) {
        setBatchId(String(batchList[0]._id || batchList[0].id || ""));
      }
    }
  }, [isOpen, defaultSprintId, sprintList, batchList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sprintId) {
      showToast("Please select a target sprint.", "error");
      return;
    }
    if (!batchId) {
      showToast("Please select a target batch.", "error");
      return;
    }
    if (durationMinutes < 5) {
      showToast("Exam duration must be at least 5 minutes.", "error");
      return;
    }

    setSubmitting(true);

    try {
      await adminService.createExam({
        sprintId,
        sprint: sprintId,
        batchId,
        batch: batchId,
        title: title.trim() || undefined,
        durationMinutes: Number(durationMinutes),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        instructions: instructions.trim() || undefined,
      });

      showToast("Exam created and published successfully!");
      onSuccess();
      onClose();
      // Reset form
      setTitle("");
      setInstructions("");
      setScheduledAt("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to create exam";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const sprintOptions = sprintList.map((s) => ({
    value: String(s._id || s.id),
    label: `${String(s.name || "Sprint")} · (${String(s.status || "active")})`,
  }));

  const batchOptions = batchList.map((b) => ({
    value: String(b._id || b.id),
    label: String(b.name || "Batch"),
  }));

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title="Create New NEET Exam Paper" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Configure test parameters. Questions will be automatically reconstructed from the question bank matching NEET blueprint rules.
        </p>

        {/* Exam Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <IconBook className="w-3.5 h-3.5 text-indigo-600" />
            <span>Exam Paper Title</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. NEET Minor Test 1 – Physics & Chemistry"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs px-4 py-3 rounded-xl font-bold transition-all"
          />
        </div>

        {/* Sprint & Batch Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Sprint */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <IconClock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Target Sprint</span>
            </label>
            <CustomSelect
              options={sprintOptions}
              value={sprintId}
              onChange={(val) => setSprintId(val)}
              placeholder="Select sprint"
              className="w-full"
            />
          </div>

          {/* Target Batch */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <IconLayers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Target Cohort Batch</span>
            </label>
            <CustomSelect
              options={batchOptions}
              value={batchId}
              onChange={(val) => setBatchId(val)}
              placeholder="Select batch"
              className="w-full"
            />
          </div>
        </div>

        {/* Duration & Scheduled Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration Minutes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Duration (Minutes)
            </label>
            <input
              type="number"
              required
              min={5}
              max={360}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs px-4 py-3 rounded-xl font-bold transition-all"
            />
          </div>

          {/* Scheduled At (Optional) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Schedule Start (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs px-4 py-2.5 rounded-xl font-semibold transition-all outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
            Instructions & Guidelines (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Marking scheme: +4 for correct answer, -1 for incorrect attempt..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs p-3.5 rounded-xl font-medium resize-none transition-all"
          />
        </div>

        {/* Actions */}
        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {submitting ? (
              <>
                <Spinner className="w-4 h-4 text-white" />
                <span>Reconstructing Questions...</span>
              </>
            ) : (
              <>
                <IconCheck className="w-4 h-4" />
                <span>Create & Generate Exam</span>
              </>
            )}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
