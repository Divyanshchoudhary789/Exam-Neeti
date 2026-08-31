"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, IconPlus, Spinner } from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { adminService } from "../../services/apiServices";

interface CreateSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSubject?: string;
  initialClassLevel?: string;
  initialChapter?: string;
  initialUnitCode?: string;
}

export function CreateSyllabusModal({
  isOpen,
  onClose,
  onSuccess,
  initialSubject = "physics",
  initialClassLevel = "XI",
  initialChapter = "",
  initialUnitCode = "",
}: CreateSyllabusModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [classLevel, setClassLevel] = useState(initialClassLevel);
  const [unitCode, setUnitCode] = useState(initialUnitCode);
  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState("");
  const [chapterOrder, setChapterOrder] = useState<number>(1);
  const [topicOrder, setTopicOrder] = useState<number>(1);
  const [weight, setWeight] = useState<number>(1.0);
  const [topicWeightage, setTopicWeightage] = useState<string>(""); // "" = not set
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSubject(initialSubject || "physics");
      setClassLevel(initialClassLevel || "XI");
      setChapter(initialChapter || "");
      setUnitCode(initialUnitCode || "");
      setTopic("");
      setChapterOrder(1);
      setTopicOrder(1);
      setWeight(1.0);
      setTopicWeightage("");
      setIsActive(true);
      setErrorMsg("");
    }
  }, [isOpen, initialSubject, initialClassLevel, initialChapter, initialUnitCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapter.trim()) {
      setErrorMsg("Chapter name is required.");
      return;
    }
    if (!topic.trim()) {
      setErrorMsg("Topic name is required.");
      return;
    }
    if (weight < 0.1 || weight > 10) {
      setErrorMsg("Weight must be between 0.1 and 10.0");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      await adminService.createSyllabusTopic({
        subject,
        classLevel,
        unitCode: unitCode.trim(),
        chapter: chapter.trim(),
        topic: topic.trim(),
        chapterOrder: Number(chapterOrder) || 1,
        topicOrder: Number(topicOrder) || 1,
        weight: Number(weight),
        topicWeightage: topicWeightage ? Number(topicWeightage) : null,
        isActive,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string })?.message || "Failed to create topic";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Syllabus Topic"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium text-slate-700">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              value={subject.toLowerCase()}
              onChange={(val) => setSubject(val)}
              options={[
                { value: "physics", label: "Physics" },
                { value: "chemistry", label: "Chemistry" },
                { value: "biology", label: "Biology" },
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Class Level <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              value={classLevel}
              onChange={(val) => setClassLevel(val)}
              options={[
                { value: "XI", label: "Class XI" },
                { value: "XII", label: "Class XII" },
                { value: "dropper", label: "Dropper" },
              ]}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Unit Code
            </label>
            <input
              type="text"
              placeholder="e.g. U1, U3.2"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Chapter Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Motion in Straight Line"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Topic Name / Concept <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Instantaneous velocity and speed"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Topic Order
            </label>
            <input
              type="number"
              min={1}
              value={topicOrder}
              onChange={(e) => setTopicOrder(parseInt(e.target.value) || 1)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Chapter Order
            </label>
            <input
              type="number"
              min={1}
              value={chapterOrder}
              onChange={(e) => setChapterOrder(parseInt(e.target.value) || 1)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Two DIFFERENT concepts, kept visually separate on purpose so they
            don't get confused with each other. */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Coverage Weight (0.1-10)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10.0"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 1.0)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1">Used only for the Weighted Coverage % analytics.</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Topic Weightage
            </label>
            <CustomSelect
              value={topicWeightage}
              onChange={(val) => setTopicWeightage(val)}
              options={[
                { value: "", label: "Not set" },
                { value: "1", label: "1 — High Priority" },
                { value: "2", label: "2 — Medium Priority" },
                { value: "3", label: "3 — Low Priority" },
              ]}
              className="w-full"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1">Weightage Framework — for test-generation strategy.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="createIsActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="createIsActive" className="text-xs font-bold text-slate-800 cursor-pointer">
            Active Topic (Included in NEET Syllabus)
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
          >
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : <IconPlus className="w-4 h-4" />}
            <span>Add Topic</span>
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
