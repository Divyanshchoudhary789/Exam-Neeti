"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { CommonModal, Spinner, IconCheck, IconCross } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface PatternSlot {
  position: number;
  subject: "biology" | "chemistry" | "physics";
  chapter: string | null;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  questionType: "mcq";
  marks: number;
  negativeMarks: number;
}

interface SyllabusTopic {
  topic: string;
  topicOrder?: number;
}

interface SyllabusChapter {
  subject: string;
  classLevel?: string;
  chapter: string;
  topics: SyllabusTopic[];
}

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function CreateSprintModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: CreateSprintModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form Basic State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [totalQuestions, setTotalQuestions] = useState<number>(180);
  const [defaultMarks, setDefaultMarks] = useState<number>(4);
  const [defaultNegMarks, setDefaultNegMarks] = useState<number>(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Slots State
  const [patternSlots, setPatternSlots] = useState<PatternSlot[]>([]);
  const [selectedSlotPositions, setSelectedSlotPositions] = useState<number[]>([]);

  // Filters for Slot Editor
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Custom Ratio Modal / Controls
  const [customRatioPhy, setCustomRatioPhy] = useState(45);
  const [customRatioChem, setCustomRatioChem] = useState(45);
  const [customRatioBio, setCustomRatioBio] = useState(90);
  const [customRatioDiff, setCustomRatioDiff] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");

  // Syllabus Data
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);

  // Bulk Edit controls
  const [bulkSubject, setBulkSubject] = useState<"biology" | "chemistry" | "physics" | "">("");
  const [bulkDifficulty, setBulkDifficulty] = useState<"easy" | "medium" | "hard" | "any" | "">("");
  const [bulkMarks, setBulkMarks] = useState<string>("");
  const [bulkNegMarks, setBulkNegMarks] = useState<string>("");

  // Load Syllabus on mount
  useEffect(() => {
    if (!isOpen) return;
    const fetchSyllabus = async () => {
      try {
        const res = await adminService.getSyllabus();
        const rawCh = res?.data?.chapters || res?.chapters || [];
        if (Array.isArray(rawCh)) {
          setChapters(rawCh);
        }
      } catch (err: unknown) {
        console.error("Failed to load syllabus for sprint builder:", err);
      }
    };
    fetchSyllabus();
  }, [isOpen]);

  // Generate Default Slots based on count and parameters
  const generateSlots = useCallback(
    (
      total: number,
      phyCount: number,
      chemCount: number,
      bioCount: number,
      diff: "easy" | "medium" | "hard" | "mixed" = "mixed",
      marks = defaultMarks,
      neg = defaultNegMarks
    ) => {
      const slots: PatternSlot[] = [];
      let pos = 1;

      const getDiff = (idx: number): "easy" | "medium" | "hard" | null => {
        if (diff !== "mixed") return diff;
        if (idx % 3 === 0) return "easy";
        if (idx % 3 === 1) return "medium";
        return "hard";
      };

      // Add Physics
      for (let i = 0; i < phyCount && pos <= total; i++) {
        slots.push({
          position: pos,
          subject: "physics",
          chapter: null,
          topic: null,
          difficulty: getDiff(i),
          questionType: "mcq",
          marks,
          negativeMarks: neg,
        });
        pos++;
      }

      // Add Chemistry
      for (let i = 0; i < chemCount && pos <= total; i++) {
        slots.push({
          position: pos,
          subject: "chemistry",
          chapter: null,
          topic: null,
          difficulty: getDiff(i),
          questionType: "mcq",
          marks,
          negativeMarks: neg,
        });
        pos++;
      }

      // Add Biology
      for (let i = 0; i < bioCount && pos <= total; i++) {
        slots.push({
          position: pos,
          subject: "biology",
          chapter: null,
          topic: null,
          difficulty: getDiff(i),
          questionType: "mcq",
          marks,
          negativeMarks: neg,
        });
        pos++;
      }

      // Remaining unfilled slots
      while (pos <= total) {
        slots.push({
          position: pos,
          subject: "biology",
          chapter: null,
          topic: null,
          difficulty: getDiff(pos),
          questionType: "mcq",
          marks,
          negativeMarks: neg,
        });
        pos++;
      }

      setPatternSlots(slots);
    },
    [defaultMarks, defaultNegMarks]
  );

  // Initialize slots when modal opens or totalQuestions changes
  useEffect(() => {
    if (isOpen && patternSlots.length === 0) {
      generateSlots(180, 45, 45, 90, "mixed", 4, 1);
    }
  }, [isOpen, patternSlots.length, generateSlots]);

  const handleTotalQuestionsChange = (val: number) => {
    const total = Math.max(1, val);
    setTotalQuestions(total);

    if (total === 180) {
      setCustomRatioPhy(45);
      setCustomRatioChem(45);
      setCustomRatioBio(90);
      generateSlots(180, 45, 45, 90, customRatioDiff);
    } else if (total === 200) {
      setCustomRatioPhy(50);
      setCustomRatioChem(50);
      setCustomRatioBio(100);
      generateSlots(200, 50, 50, 100, customRatioDiff);
    } else {
      const perSub = Math.floor(total / 3);
      const rem = total - perSub * 2;
      setCustomRatioPhy(perSub);
      setCustomRatioChem(perSub);
      setCustomRatioBio(rem);
      generateSlots(total, perSub, perSub, rem, customRatioDiff);
    }
  };

  const applyPresetNeet180 = () => {
    setTotalQuestions(180);
    setCustomRatioPhy(45);
    setCustomRatioChem(45);
    setCustomRatioBio(90);
    generateSlots(180, 45, 45, 90, "mixed");
    showToast("Applied NEET 180 Standard preset", "success");
  };

  const applyPresetNeet200 = () => {
    setTotalQuestions(200);
    setCustomRatioPhy(50);
    setCustomRatioChem(50);
    setCustomRatioBio(100);
    generateSlots(200, 50, 50, 100, "mixed");
    showToast("Applied NEET 200 Standard preset", "success");
  };

  const applyPresetEqualSplit = () => {
    const perSub = Math.floor(totalQuestions / 3);
    const rem = totalQuestions - perSub * 2;
    setCustomRatioPhy(perSub);
    setCustomRatioChem(perSub);
    setCustomRatioBio(rem);
    generateSlots(totalQuestions, perSub, perSub, rem, "mixed");
    showToast(`Applied Equal Split preset across ${totalQuestions} questions`, "success");
  };

  const applyCustomRatio = () => {
    const sum = customRatioPhy + customRatioChem + customRatioBio;
    if (sum !== totalQuestions) {
      setTotalQuestions(sum);
    }
    generateSlots(sum, customRatioPhy, customRatioChem, customRatioBio, customRatioDiff);
    showToast(`Generated ${sum} pattern slots successfully`, "success");
  };

  const counts = useMemo(() => {
    let bio = 0,
      chem = 0,
      phy = 0;
    patternSlots.forEach((s) => {
      if (s.subject === "biology") bio++;
      else if (s.subject === "chemistry") chem++;
      else if (s.subject === "physics") phy++;
    });
    return { bio, chem, phy, total: patternSlots.length };
  }, [patternSlots]);

  const filteredSlots = useMemo(() => {
    return patternSlots.filter((s) => {
      if (subjectFilter !== "all" && s.subject !== subjectFilter) return false;
      if (difficultyFilter !== "all" && (s.difficulty || "any") !== difficultyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const posMatch = String(s.position).includes(q);
        const chapMatch = (s.chapter || "").toLowerCase().includes(q);
        const topicMatch = (s.topic || "").toLowerCase().includes(q);
        return posMatch || chapMatch || topicMatch;
      }
      return true;
    });
  }, [patternSlots, subjectFilter, difficultyFilter, searchQuery]);

  const updateSlot = (position: number, updates: Partial<PatternSlot>) => {
    setPatternSlots((prev) =>
      prev.map((s) => (s.position === position ? { ...s, ...updates } : s))
    );
  };

  const handleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      const positions = filteredSlots.map((s) => s.position);
      setSelectedSlotPositions(Array.from(new Set([...selectedSlotPositions, ...positions])));
    } else {
      const positionsSet = new Set(filteredSlots.map((s) => s.position));
      setSelectedSlotPositions(selectedSlotPositions.filter((p) => !positionsSet.has(p)));
    }
  };

  const applyBulkEdit = () => {
    if (selectedSlotPositions.length === 0) {
      showToast("Select at least one slot to bulk edit", "error");
      return;
    }
    setPatternSlots((prev) =>
      prev.map((s) => {
        if (!selectedSlotPositions.includes(s.position)) return s;
        const updated = { ...s };
        if (bulkSubject) updated.subject = bulkSubject;
        if (bulkDifficulty) updated.difficulty = bulkDifficulty === "any" ? null : bulkDifficulty;
        if (bulkMarks !== "") updated.marks = Number(bulkMarks);
        if (bulkNegMarks !== "") updated.negativeMarks = Number(bulkNegMarks);
        return updated;
      })
    );
    showToast(`Updated ${selectedSlotPositions.length} selected slots`, "success");
    setSelectedSlotPositions([]);
    setBulkSubject("");
    setBulkDifficulty("");
    setBulkMarks("");
    setBulkNegMarks("");
  };

  const getChaptersForSubject = (subject: string) => {
    return chapters.filter((c) => c.subject.toLowerCase() === subject.toLowerCase());
  };

  const getTopicsForChapter = (chapterName: string) => {
    const found = chapters.find((c) => c.chapter.toLowerCase() === chapterName.toLowerCase());
    return found ? found.topics : [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Sprint Name is required", "error");
      return;
    }

    if (patternSlots.length !== totalQuestions) {
      showToast(
        `Total pattern slots (${patternSlots.length}) must equal total questions (${totalQuestions}).`,
        "error"
      );
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      status,
      totalQuestions: Number(totalQuestions),
      patternSlots: patternSlots.map((s) => ({
        position: Number(s.position),
        subject: s.subject,
        chapter: s.chapter || null,
        topic: s.topic || null,
        difficulty: s.difficulty || null,
        questionType: "mcq",
        marks: Number(s.marks),
        negativeMarks: Number(s.negativeMarks),
      })),
    };

    if (startDate) payload.startDate = new Date(startDate).toISOString();
    if (endDate) payload.endDate = new Date(endDate).toISOString();

    setSubmitting(true);
    try {
      await adminService.createSprint(payload);
      showToast("Sprint created successfully!", "success");
      onSuccess();
      onClose();
      setName("");
      setDescription("");
      setStatus("draft");
      setStep(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response
        ?.data?.message || (err as { message?: string }).message || "Failed to create sprint";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sprint Blueprint"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-6 text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                step === 1
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>General Details</span>
            </button>
            <span className="text-slate-300 font-bold">→</span>
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                step === 2
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Pattern Slots Blueprint ({counts.total})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span
              className={`px-3 py-1 rounded-full font-bold text-[11px] flex items-center gap-1.5 ${
                counts.total === totalQuestions
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}
            >
              {counts.total === totalQuestions ? (
                <>
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{counts.total} / {totalQuestions} Slots Configured</span>
                </>
              ) : (
                <>
                  <IconCross className="w-3.5 h-3.5 text-amber-600" />
                  <span>{counts.total} / {totalQuestions} Slots (Mismatch)</span>
                </>
              )}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1.5">
                    Sprint Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NEET 2026 Sprint 01 - Full Syllabus"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1.5">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "draft" | "active")}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
                  >
                    <option value="draft">Draft (Draft mode)</option>
                    <option value="active">Active (Live for students)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1.5">
                  Total Questions Count <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={totalQuestions}
                    onChange={(e) => handleTotalQuestionsChange(Number(e.target.value))}
                    className="w-28 bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-black"
                  />
                  <div className="flex items-center gap-1">
                    {[180, 200, 90, 50, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleTotalQuestionsChange(num)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                          totalQuestions === num
                            ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1.5">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe sprint goals, target batches, topics covered..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">
                    Default Marks / Slot
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={defaultMarks}
                    onChange={(e) => setDefaultMarks(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1">
                    Default Neg Marks / Slot
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={defaultNegMarks}
                    onChange={(e) => setDefaultNegMarks(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
                    Start Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl font-semibold transition-all outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1">
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl font-semibold transition-all outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block">
                  Quick Pattern Slot Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={applyPresetNeet180}
                    className="p-3.5 bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200/80 rounded-2xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-indigo-950">NEET 180 Standard</span>
                      <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                        180 Qs
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-800/80 font-medium">
                      90 Bio | 45 Chem | 45 Physics (+4 / -1)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={applyPresetNeet200}
                    className="p-3.5 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200/80 rounded-2xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-purple-950">NEET 200 Standard</span>
                      <span className="text-[10px] bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full">
                        200 Qs
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-800/80 font-medium">
                      100 Bio | 50 Chem | 50 Physics (+4 / -1)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={applyPresetEqualSplit}
                    className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200/80 rounded-2xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-emerald-950">Equal Split</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        3-Way
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 font-medium">
                      Equal breakdown of current Q count ({totalQuestions})
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  <span>Configure Pattern Slots ({counts.total})</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-slate-200/90 text-slate-900 rounded-2xl shadow-sm space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* Breakdown Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        Slot Breakdown:
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          counts.total === totalQuestions
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {counts.total === totalQuestions ? "Balanced" : "Mismatch"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Bio: {counts.bio}
                      </span>
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Chem: {counts.chem}
                      </span>
                      <span className="px-3 py-1.5 bg-cyan-50 text-cyan-900 border border-cyan-200 rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        Physics: {counts.phy}
                      </span>
                      <span className="px-3 py-1.5 bg-indigo-50 text-indigo-950 border border-indigo-200/90 rounded-xl shrink-0 font-extrabold shadow-2xs">
                        Total: {counts.total} / {totalQuestions}
                      </span>
                    </div>
                  </div>

                  {/* Custom Auto-Fill Controls */}
                  <div className="pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <span className="text-slate-500 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                      Auto-Fill:
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-cyan-500/30 focus-within:border-cyan-500 transition-all shadow-2xs">
                        <span className="text-[10px] font-black text-cyan-700 uppercase">Phy</span>
                        <input
                          type="number"
                          min={0}
                          value={customRatioPhy}
                          onChange={(e) => setCustomRatioPhy(Number(e.target.value))}
                          placeholder="Phy"
                          title="Physics Question Count"
                          className="w-10 sm:w-12 bg-transparent text-slate-900 text-xs font-black text-center focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500 transition-all shadow-2xs">
                        <span className="text-[10px] font-black text-amber-700 uppercase">Chem</span>
                        <input
                          type="number"
                          min={0}
                          value={customRatioChem}
                          onChange={(e) => setCustomRatioChem(Number(e.target.value))}
                          placeholder="Chem"
                          title="Chemistry Question Count"
                          className="w-10 sm:w-12 bg-transparent text-slate-900 text-xs font-black text-center focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all shadow-2xs">
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Bio</span>
                        <input
                          type="number"
                          min={0}
                          value={customRatioBio}
                          onChange={(e) => setCustomRatioBio(Number(e.target.value))}
                          placeholder="Bio"
                          title="Biology Question Count"
                          className="w-10 sm:w-12 bg-transparent text-slate-900 text-xs font-black text-center focus:outline-none"
                        />
                      </div>

                      <select
                        value={customRatioDiff}
                        onChange={(e) =>
                          setCustomRatioDiff(e.target.value as "easy" | "medium" | "hard" | "mixed")
                        }
                        className="bg-white border border-slate-300 text-slate-800 text-xs px-3 py-1.5 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-slate-400 cursor-pointer transition-colors shadow-2xs"
                      >
                        <option value="mixed">Mixed Diff</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>

                      <button
                        type="button"
                        onClick={applyCustomRatio}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition-all shadow-sm shadow-indigo-600/20 active:scale-95 shrink-0 flex items-center justify-center"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search slot # or chapter..."
                      className="bg-white border border-slate-300 text-slate-900 text-xs px-3 py-1.5 rounded-xl font-medium focus:outline-none w-44"
                    />
                    <select
                      value={subjectFilter}
                      onChange={(e) => setSubjectFilter(e.target.value)}
                      className="bg-white border border-slate-300 text-slate-800 text-xs px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
                    >
                      <option value="all">All Subjects</option>
                      <option value="biology">Biology ({counts.bio})</option>
                      <option value="chemistry">Chemistry ({counts.chem})</option>
                      <option value="physics">Physics ({counts.phy})</option>
                    </select>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="bg-white border border-slate-300 text-slate-800 text-xs px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="any">Unspecified / Any</option>
                    </select>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      Showing {filteredSlots.length} of {patternSlots.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          filteredSlots.length > 0 &&
                          filteredSlots.every((s) => selectedSlotPositions.includes(s.position))
                        }
                        onChange={(e) => handleSelectAllFiltered(e.target.checked)}
                        className="rounded text-indigo-600 cursor-pointer"
                      />
                      <span>Select Visible ({selectedSlotPositions.length})</span>
                    </label>
                  </div>
                </div>

                {selectedSlotPositions.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs bg-indigo-50/70 p-2.5 rounded-xl">
                    <span className="font-extrabold text-indigo-900 text-[11px]">
                      Bulk Edit Selected ({selectedSlotPositions.length}):
                    </span>
                    <select
                      value={bulkSubject}
                      onChange={(e) =>
                        setBulkSubject(e.target.value as "biology" | "chemistry" | "physics" | "")
                      }
                      className="bg-white border border-indigo-200 text-xs px-2 py-1 rounded-lg font-medium"
                    >
                      <option value="">Set Subject...</option>
                      <option value="physics">Physics</option>
                      <option value="chemistry">Chemistry</option>
                      <option value="biology">Biology</option>
                    </select>
                    <select
                      value={bulkDifficulty}
                      onChange={(e) =>
                        setBulkDifficulty(
                          e.target.value as "easy" | "medium" | "hard" | "any" | ""
                        )
                      }
                      className="bg-white border border-indigo-200 text-xs px-2 py-1 rounded-lg font-medium"
                    >
                      <option value="">Set Difficulty...</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="any">Any / Null</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Marks"
                      value={bulkMarks}
                      onChange={(e) => setBulkMarks(e.target.value)}
                      className="w-16 bg-white border border-indigo-200 text-xs px-2 py-1 rounded-lg font-medium"
                    />
                    <input
                      type="number"
                      placeholder="Neg Marks"
                      value={bulkNegMarks}
                      onChange={(e) => setBulkNegMarks(e.target.value)}
                      className="w-20 bg-white border border-indigo-200 text-xs px-2 py-1 rounded-lg font-medium"
                    />
                    <button
                      type="button"
                      onClick={applyBulkEdit}
                      className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      Apply Bulk Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-inner">
                {filteredSlots.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                    No pattern slots match the active filters.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="p-2.5 w-10 text-center">Sel</th>
                        <th className="p-2.5 w-14">Slot</th>
                        <th className="p-2.5 w-32">Subject</th>
                        <th className="p-2.5">Chapter (Syllabus)</th>
                        <th className="p-2.5">Topic</th>
                        <th className="p-2.5 w-28">Difficulty</th>
                        <th className="p-2.5 w-16 text-center">Marks</th>
                        <th className="p-2.5 w-16 text-center">Neg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredSlots.map((slot) => {
                        const isSelected = selectedSlotPositions.includes(slot.position);
                        const chapList = getChaptersForSubject(slot.subject);
                        const topicList = slot.chapter ? getTopicsForChapter(slot.chapter) : [];

                        return (
                          <tr
                            key={slot.position}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isSelected ? "bg-indigo-50/50" : ""
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSlotPositions([
                                      ...selectedSlotPositions,
                                      slot.position,
                                    ]);
                                  } else {
                                    setSelectedSlotPositions(
                                      selectedSlotPositions.filter((p) => p !== slot.position)
                                    );
                                  }
                                }}
                                className="rounded text-indigo-600 cursor-pointer"
                              />
                            </td>

                            <td className="p-2.5 font-black text-slate-900 text-center">
                              #{slot.position}
                            </td>

                            <td className="p-2.5">
                              <select
                                value={slot.subject}
                                onChange={(e) =>
                                  updateSlot(slot.position, {
                                    subject: e.target.value as "biology" | "chemistry" | "physics",
                                    chapter: null,
                                    topic: null,
                                  })
                                }
                                className={`w-full text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  slot.subject === "biology"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : slot.subject === "chemistry"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-cyan-50 text-cyan-800 border-cyan-200"
                                }`}
                              >
                                <option value="physics">Physics</option>
                                <option value="chemistry">Chemistry</option>
                                <option value="biology">Biology</option>
                              </select>
                            </td>

                            <td className="p-2.5">
                              <select
                                value={slot.chapter || ""}
                                onChange={(e) =>
                                  updateSlot(slot.position, {
                                    chapter: e.target.value || null,
                                    topic: null,
                                  })
                                }
                                className="w-full text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none cursor-pointer"
                              >
                                <option value="">Any / Unassigned Chapter</option>
                                {chapList.map((c) => (
                                  <option key={c.chapter} value={c.chapter}>
                                    {c.chapter}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-2.5">
                              <select
                                value={slot.topic || ""}
                                disabled={!slot.chapter}
                                onChange={(e) =>
                                  updateSlot(slot.position, {
                                    topic: e.target.value || null,
                                  })
                                }
                                className="w-full text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none cursor-pointer disabled:opacity-50"
                              >
                                <option value="">Any / Unassigned Topic</option>
                                {topicList.map((t) => (
                                  <option key={t.topic} value={t.topic}>
                                    {t.topic}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-2.5">
                              <select
                                value={slot.difficulty || "any"}
                                onChange={(e) =>
                                  updateSlot(slot.position, {
                                    difficulty:
                                      e.target.value === "any"
                                        ? null
                                        : (e.target.value as "easy" | "medium" | "hard"),
                                  })
                                }
                                className="w-full text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none cursor-pointer"
                              >
                                <option value="any">Any Level</option>
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </td>

                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                value={slot.marks}
                                onChange={(e) =>
                                  updateSlot(slot.position, { marks: Number(e.target.value) })
                                }
                                className="w-12 bg-white border border-slate-200 text-center text-xs font-bold py-1 rounded-lg focus:outline-none"
                              />
                            </td>

                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                value={slot.negativeMarks}
                                onChange={(e) =>
                                  updateSlot(slot.position, {
                                    negativeMarks: Number(e.target.value),
                                  })
                                }
                                className="w-12 bg-white border border-slate-200 text-center text-xs font-bold py-1 rounded-lg focus:outline-none text-red-600"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  ← Back to Details
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || counts.total !== totalQuestions}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {submitting ? (
                      <>
                        <Spinner className="w-4 h-4 text-white" />
                        <span>Creating Sprint Blueprint...</span>
                      </>
                    ) : (
                      <span>Create Sprint ({counts.total} Slots)</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </CommonModal>
  );
}
