"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { adminService } from "../../services/apiServices";
import { MathRenderer } from "../common/MathRenderer";
import { CustomSelect } from "../common/CustomSelect";
import {
  CommonModal,
  Spinner,
  IconCheck,
  IconCross,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconEye,
  IconPlus,
  IconTrash,
} from "../common/UIComponents";

/** Local pushpin icon — used to mark "questions fixed to this slot". */
function IconPin({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SubjectId = "biology" | "chemistry" | "physics";
type DifficultyId = "easy" | "medium" | "hard";
type DiffStrategy = DifficultyId | "mixed";

export interface PatternSlot {
  position: number;
  subject: SubjectId;
  chapter: string | null;
  topic: string | null;
  difficulty: DifficultyId | null;
  questionType: "mcq";
  marks: number;
  negativeMarks: number;
  pinnedQuestionIds: string[];
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

interface SlotQuestion {
  _id: string;
  text: string;
  hasLatex?: boolean;
  questionImage?: { url?: string | null } | null;
  options: { key: string; text: string; image?: { url?: string | null } }[];
  correctAnswer: "A" | "B" | "C" | "D";
  solution?: { text?: string; hasLatex?: boolean; image?: { url?: string | null }; images?: { url?: string | null }[] } | null;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  classLevel?: string;
  questionCategory?: string;
  marks?: number;
  negativeMarks?: number;
  usageCount?: number;
}

interface SprintBuilderProps {
  mode: "create" | "edit";
  existingSprint?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
  /** Optional — the builder also renders its own toast since it covers the dashboard. */
  showToast?: (msg: string, type?: "success" | "error") => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants / helpers
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_META: Record<SubjectId, { label: string; dot: string; chip: string; ring: string }> = {
  biology: { label: "Biology", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", ring: "focus:ring-emerald-500/30" },
  chemistry: { label: "Chemistry", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200", ring: "focus:ring-amber-500/30" },
  physics: { label: "Physics", dot: "bg-cyan-500", chip: "bg-cyan-50 text-cyan-800 border-cyan-200", ring: "focus:ring-cyan-500/30" },
};

const DIFF_META: Record<DifficultyId, string> = {
  easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-rose-50 text-rose-700 border-rose-200",
};

const QUESTIONS_PER_PAGE = 12;

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SprintBuilder({
  mode,
  existingSprint,
  onClose,
  onSaved,
  showToast: showToastProp,
}: SprintBuilderProps) {
  const isEdit = mode === "edit";

  const [localToast, setLocalToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      showToastProp?.(msg, type);
      setLocalToast({ text: msg, type });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setLocalToast(null), 4000);
    },
    [showToastProp]
  );
  const sprintId = String(existingSprint?._id || existingSprint?.id || "");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1 — meta ────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [totalQuestions, setTotalQuestions] = useState(180);
  const [defaultMarks, setDefaultMarks] = useState(4);
  const [defaultNegMarks, setDefaultNegMarks] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [phyCount, setPhyCount] = useState(45);
  const [chemCount, setChemCount] = useState(45);
  const [bioCount, setBioCount] = useState(90);
  const [diffStrategy, setDiffStrategy] = useState<DiffStrategy>("mixed");

  // ── Slots ────────────────────────────────────────────────────────────────
  const [slots, setSlots] = useState<PatternSlot[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [slotsGenerated, setSlotsGenerated] = useState(false);

  // ── Syllabus ─────────────────────────────────────────────────────────────
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);

  // ── Per-slot question list ───────────────────────────────────────────────
  const [questions, setQuestions] = useState<SlotQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qTotal, setQTotal] = useState(0);
  const [qPage, setQPage] = useState(1);
  const [qSearch, setQSearch] = useState("");
  const [qSearchDebounced, setQSearchDebounced] = useState("");
  const qCache = useRef<Map<string, { at: number; questions: SlotQuestion[]; total: number }>>(new Map());

  // Snapshot of every pinned question we've ever seen — for chip labels.
  const [pinnedMeta, setPinnedMeta] = useState<Record<string, SlotQuestion>>({});

  // ── Preview modal ────────────────────────────────────────────────────────
  const [previewQ, setPreviewQ] = useState<SlotQuestion | null>(null);
  const [expandedSolution, setExpandedSolution] = useState<Record<string, boolean>>({});

  // ── Range-apply popover ──────────────────────────────────────────────────
  const [showRangeApply, setShowRangeApply] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // ─────────────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await adminService.getSyllabus();
        const raw = res?.data?.chapters || res?.chapters || [];
        if (Array.isArray(raw)) setChapters(raw);
      } catch {
        /* non-fatal — chapter dropdowns just fall back to free "Any" */
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit || !existingSprint) return;
    setName(String(existingSprint.name || ""));
    setDescription(String(existingSprint.description || ""));
    setStatus((String(existingSprint.status || "draft") === "active" ? "active" : "draft"));
    setTotalQuestions(Number(existingSprint.totalQuestions || 180));
    if (existingSprint.startDate) setStartDate(toLocalInput(String(existingSprint.startDate)));
    if (existingSprint.endDate) setEndDate(toLocalInput(String(existingSprint.endDate)));

    const rawSlots = Array.isArray(existingSprint.patternSlots) ? existingSprint.patternSlots : [];
    const mapped: PatternSlot[] = (rawSlots as Record<string, unknown>[])
      .map((s, i) => ({
        position: Number(s.position ?? i + 1),
        subject: (String(s.subject || "biology") as SubjectId),
        chapter: (s.chapter as string) || null,
        topic: (s.topic as string) || null,
        difficulty: (s.difficulty as DifficultyId) || null,
        questionType: "mcq" as const,
        marks: Number(s.marks ?? 4),
        negativeMarks: Number(s.negativeMarks ?? 1),
        pinnedQuestionIds: Array.isArray(s.pinnedQuestionIds)
          ? (s.pinnedQuestionIds as unknown[]).map(String)
          : [],
      }))
      .sort((a, b) => a.position - b.position);
    if (mapped.length) {
      setSlots(mapped);
      setSlotsGenerated(true);
      setDefaultMarks(mapped[0].marks);
      setDefaultNegMarks(mapped[0].negativeMarks);
      setPhyCount(mapped.filter((x) => x.subject === "physics").length);
      setChemCount(mapped.filter((x) => x.subject === "chemistry").length);
      setBioCount(mapped.filter((x) => x.subject === "biology").length);
    }
  }, [isEdit, existingSprint]);

  // Debounce question search
  useEffect(() => {
    const t = setTimeout(() => setQSearchDebounced(qSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [qSearch]);

  // ─────────────────────────────────────────────────────────────────────────
  // Slot generation
  // ─────────────────────────────────────────────────────────────────────────

  const generateSlots = useCallback(
    (opts?: { keepExisting?: boolean }) => {
      const total = Math.max(1, phyCount + chemCount + bioCount);
      // Preserve a position's full config only when its subject is unchanged
      // by the new distribution — a physics chapter on a now-chemistry slot
      // makes no sense, so those reset.
      const prevByPos = new Map<number, PatternSlot>();
      if (opts?.keepExisting) slots.forEach((s) => prevByPos.set(s.position, s));

      const diffFor = (i: number): DifficultyId | null => {
        if (diffStrategy !== "mixed") return diffStrategy;
        return (["easy", "medium", "hard"] as DifficultyId[])[i % 3];
      };

      const out: PatternSlot[] = [];
      let pos = 1;
      const push = (subject: SubjectId, count: number) => {
        for (let i = 0; i < count; i++) {
          const prev = prevByPos.get(pos);
          if (prev && prev.subject === subject) {
            out.push({ ...prev, position: pos });
          } else {
            out.push({
              position: pos,
              subject,
              chapter: null,
              topic: null,
              difficulty: diffFor(i),
              questionType: "mcq",
              marks: defaultMarks,
              negativeMarks: defaultNegMarks,
              pinnedQuestionIds: [],
            });
          }
          pos++;
        }
      };
      push("physics", phyCount);
      push("chemistry", chemCount);
      push("biology", bioCount);

      setTotalQuestions(total);
      setSlots(out);
      setSlotsGenerated(true);
      setActiveIdx(0);
    },
    [phyCount, chemCount, bioCount, diffStrategy, defaultMarks, defaultNegMarks, slots]
  );

  const applyPreset = (preset: "neet180" | "neet200" | "equal") => {
    if (preset === "neet180") {
      setPhyCount(45); setChemCount(45); setBioCount(90); setTotalQuestions(180);
    } else if (preset === "neet200") {
      setPhyCount(50); setChemCount(50); setBioCount(100); setTotalQuestions(200);
    } else {
      const per = Math.floor(totalQuestions / 3);
      setPhyCount(per); setChemCount(per); setBioCount(totalQuestions - per * 2);
    }
  };

  const goToBlueprint = () => {
    if (!name.trim()) {
      showToast("Give the sprint a name first", "error");
      setStep(1);
      return;
    }
    const total = phyCount + chemCount + bioCount;
    if (total < 1) {
      showToast("Subject distribution must add up to at least 1 question", "error");
      return;
    }
    const cur = {
      physics: slots.filter((s) => s.subject === "physics").length,
      chemistry: slots.filter((s) => s.subject === "chemistry").length,
      biology: slots.filter((s) => s.subject === "biology").length,
    };
    const distributionChanged =
      cur.physics !== phyCount || cur.chemistry !== chemCount || cur.biology !== bioCount;
    if (!slotsGenerated || slots.length !== total || distributionChanged) {
      const hasConfig = slots.some((s) => s.chapter || s.pinnedQuestionIds.length > 0);
      if (
        hasConfig &&
        !window.confirm(
          "The subject distribution changed. Slots whose subject stays the same keep their chapter/topic/pins; the rest reset. Continue?"
        )
      ) {
        return;
      }
      generateSlots({ keepExisting: true });
    }
    setStep(2);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Slot editing
  // ─────────────────────────────────────────────────────────────────────────

  const slot = slots[activeIdx];

  const updateSlot = (idx: number, patch: Partial<PatternSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const chaptersForSubject = useCallback(
    (subject: string) => chapters.filter((c) => c.subject?.toLowerCase() === subject.toLowerCase()),
    [chapters]
  );
  const topicsForChapter = useCallback(
    (chapterName: string | null) => {
      if (!chapterName) return [];
      const found = chapters.find((c) => c.chapter?.toLowerCase() === chapterName.toLowerCase());
      return found?.topics || [];
    },
    [chapters]
  );

  const togglePin = (q: SlotQuestion) => {
    if (!slot) return;
    const has = slot.pinnedQuestionIds.includes(q._id);
    updateSlot(activeIdx, {
      pinnedQuestionIds: has
        ? slot.pinnedQuestionIds.filter((id) => id !== q._id)
        : [...slot.pinnedQuestionIds, q._id],
    });
    setPinnedMeta((prev) => ({ ...prev, [q._id]: q }));
  };

  const clearPins = () => slot && updateSlot(activeIdx, { pinnedQuestionIds: [] });

  const applyToRange = () => {
    if (!slot) return;
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!from || !to || from > to) {
      showToast("Enter a valid slot range (from ≤ to)", "error");
      return;
    }
    let n = 0;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.position < from || s.position > to || s.position === slot.position) return s;
        n++;
        return {
          ...s,
          subject: slot.subject,
          chapter: slot.chapter,
          topic: slot.topic,
          difficulty: slot.difficulty,
          marks: slot.marks,
          negativeMarks: slot.negativeMarks,
          // pins are a per-slot choice tied to a specific chapter/topic — never
          // copy the source slot's pins onto the range.
          pinnedQuestionIds: [],
        };
      })
    );
    showToast(`Copied this slot's config to ${n} slot(s) in range ${from}–${to}`, "success");
    setShowRangeApply(false);
    setRangeFrom("");
    setRangeTo("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Question fetching for the active slot
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setQPage(1);
  }, [activeIdx, slot?.subject, slot?.chapter, slot?.topic, slot?.difficulty, qSearchDebounced]);

  useEffect(() => {
    if (step !== 2 || !slot) return;
    const params = {
      subject: slot.subject,
      chapter: slot.chapter || "",
      topic: slot.topic || "",
      difficulty: slot.difficulty || "",
      search: qSearchDebounced,
      page: qPage,
      limit: QUESTIONS_PER_PAGE,
    };
    const key = JSON.stringify(params);
    const cached = qCache.current.get(key);
    if (cached && Date.now() - cached.at < 60_000) {
      setQuestions(cached.questions);
      setQTotal(cached.total);
      setQLoading(false);
      return;
    }
    let cancelled = false;
    setQLoading(true);
    (async () => {
      try {
        const res = await adminService.getSlotQuestions(params);
        if (cancelled) return;
        const list: SlotQuestion[] = res?.data?.questions || res?.questions || [];
        const total: number = res?.pagination?.total ?? res?.data?.pagination?.total ?? list.length;
        setQuestions(list);
        setQTotal(total);
        qCache.current.set(key, { at: Date.now(), questions: list, total });
      } catch (err: unknown) {
        if (cancelled) return;
        setQuestions([]);
        setQTotal(0);
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (msg) showToast(msg, "error");
      } finally {
        if (!cancelled) setQLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeIdx, slot?.subject, slot?.chapter, slot?.topic, slot?.difficulty, qSearchDebounced, qPage]);

  // Resolve chip labels for pins not yet seen (mostly Edit mode)
  useEffect(() => {
    if (step !== 2 || !slot) return;
    const missing = slot.pinnedQuestionIds.filter((id) => !pinnedMeta[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const id of missing) {
        try {
          const res = await adminService.getQuestionById(id);
          const q = res?.data?.question || res?.question;
          if (q && !cancelled) setPinnedMeta((prev) => ({ ...prev, [id]: q as SlotQuestion }));
        } catch {
          /* leave as short-id label */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeIdx, slot?.pinnedQuestionIds]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    let bio = 0, chem = 0, phy = 0, pinned = 0, configured = 0;
    slots.forEach((s) => {
      if (s.subject === "biology") bio++;
      else if (s.subject === "chemistry") chem++;
      else phy++;
      if (s.pinnedQuestionIds.length) pinned++;
      if (s.chapter) configured++;
    });
    return { bio, chem, phy, pinned, configured, total: slots.length };
  }, [slots]);

  const totalMarks = useMemo(() => slots.reduce((a, s) => a + (Number(s.marks) || 0), 0), [slots]);
  const qTotalPages = Math.max(1, Math.ceil(qTotal / QUESTIONS_PER_PAGE));

  // ─────────────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    name: name.trim(),
    description: description.trim(),
    status,
    totalQuestions: slots.length,
    patternSlots: slots.map((s) => ({
      position: s.position,
      subject: s.subject,
      chapter: s.chapter || null,
      topic: s.topic || null,
      difficulty: s.difficulty || null,
      questionType: "mcq" as const,
      marks: Number(s.marks),
      negativeMarks: Number(s.negativeMarks),
      pinnedQuestionIds: s.pinnedQuestionIds,
    })),
    ...(startDate ? { startDate: new Date(startDate).toISOString() } : {}),
    ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
  });

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("Sprint name is required", "error");
      setStep(1);
      return;
    }
    if (slots.length < 1) {
      showToast("Generate the blueprint slots first", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await adminService.updateSprintBlueprint(sprintId, payload);
        showToast("Sprint blueprint updated", "success");
      } else {
        await adminService.createSprint(payload);
        showToast("Sprint created successfully", "success");
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to save sprint";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Warnings for the review step
  const reviewWarnings = useMemo(() => {
    const w: string[] = [];
    if (counts.total !== phyCount + chemCount + bioCount) {
      w.push("Slot count does not match the subject distribution — regenerate on Step 1.");
    }
    const noChapter = slots.filter((s) => !s.chapter).length;
    if (noChapter > 0) w.push(`${noChapter} slot(s) have no chapter set — the engine will pick from the whole subject pool.`);
    const singlePins = slots.filter((s) => s.pinnedQuestionIds.length === 1).length;
    if (singlePins > 0) w.push(`${singlePins} slot(s) pin exactly one question — every exam will reuse that same question for that slot.`);
    return w;
  }, [slots, counts.total, phyCount, chemCount, bioCount]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] bg-[#f3f5f9] overflow-y-auto">
      {localToast && (
        <div
          className={classNames(
            "fixed top-4 right-4 z-[99999] flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl text-xs font-bold max-w-sm backdrop-blur-xl",
            localToast.type === "success"
              ? "bg-white/95 border-emerald-300 text-emerald-950"
              : "bg-white/95 border-rose-300 text-rose-950"
          )}
        >
          <span className={classNames("p-1 rounded-lg shrink-0", localToast.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
            {localToast.type === "success" ? <IconCheck className="w-3.5 h-3.5" /> : <IconCross className="w-3.5 h-3.5" />}
          </span>
          <span className="flex-1 font-extrabold text-slate-900 leading-snug whitespace-pre-line">{localToast.text}</span>
          <button onClick={() => setLocalToast(null)} className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer">
            <IconCross className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/80 px-4 sm:px-6 py-3.5 shadow-sm">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight truncate">
              {isEdit ? "Edit Sprint Blueprint" : "Create New Sprint"}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5 truncate">
              {name ? name : "Define details, then design each slot of the blueprint"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <IconCross className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        {/* Stepper */}
        <div className="mt-4 flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none pb-1">
          {[
            { n: 1 as const, label: "Sprint Details" },
            { n: 2 as const, label: "Blueprint & Slots" },
            { n: 3 as const, label: "Review & Save" },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <button
                type="button"
                onClick={() => {
                  if (s.n === 1) setStep(1);
                  else if (s.n === 2) goToBlueprint();
                  else if (slotsGenerated) setStep(3);
                }}
                className={classNames(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0",
                  step === s.n
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                )}
              >
                <span
                  className={classNames(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                    step === s.n ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {s.n}
                </span>
                {s.label}
              </button>
              {i < 2 && <IconChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* ═══════════════ STEP 1 ═══════════════ */}
        {step === 1 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label>Sprint Name *</Label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NEET 2026 Sprint 01 — Full Syllabus"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Initial Status</Label>
                  <CustomSelect
                    value={status}
                    onChange={(v) => setStatus(v as "draft" | "active")}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "active", label: "Active (live for students)" },
                    ]}
                    buttonClassName="w-full py-3"
                  />
                </div>
              </div>

              <div>
                <Label>Description / Instructions</Label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sprint goals, target batches, coverage…"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Default Marks</Label>
                  <input type="number" min={0} value={defaultMarks} onChange={(e) => setDefaultMarks(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <Label>Default Neg</Label>
                  <input type="number" min={0} value={defaultNegMarks} onChange={(e) => setDefaultNegMarks(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <Label>Start (optional)</Label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <Label>End (optional)</Label>
                  <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <Label>Subject Distribution</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    ["physics", phyCount, setPhyCount],
                    ["chemistry", chemCount, setChemCount],
                    ["biology", bioCount, setBioCount],
                  ] as [SubjectId, number, (n: number) => void][]).map(([sub, val, setter]) => (
                    <div key={sub} className={classNames("rounded-xl border p-3", SUBJECT_META[sub].chip)}>
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide">
                        <span className={classNames("w-2 h-2 rounded-full", SUBJECT_META[sub].dot)} />
                        {SUBJECT_META[sub].label}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={val}
                        onChange={(e) => setter(Math.max(0, Number(e.target.value)))}
                        className="mt-2 w-full bg-white/80 border border-white text-slate-900 text-lg font-black px-3 py-1.5 rounded-lg focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase text-slate-500">Difficulty mix:</span>
                  <CustomSelect
                    value={diffStrategy}
                    onChange={(v) => setDiffStrategy(v as DiffStrategy)}
                    options={[
                      { value: "mixed", label: "Mixed (rotate E/M/H)" },
                      { value: "easy", label: "All Easy" },
                      { value: "medium", label: "All Medium" },
                      { value: "hard", label: "All Hard" },
                    ]}
                    buttonClassName="py-2"
                    className="w-56"
                  />
                  <span
                    className={classNames(
                      "ml-auto text-[11px] font-extrabold px-3 py-1 rounded-full border",
                      phyCount + chemCount + bioCount > 0
                        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    )}
                  >
                    Total: {phyCount + chemCount + bioCount} questions
                  </span>
                </div>
              </div>
            </div>

            {/* Presets + continue */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2.5">
                <Label>Quick Presets</Label>
                {[
                  { id: "neet180" as const, title: "NEET 180 Standard", sub: "90 Bio · 45 Chem · 45 Phy" },
                  { id: "neet200" as const, title: "NEET 200 Standard", sub: "100 Bio · 50 Chem · 50 Phy" },
                  { id: "equal" as const, title: "Equal 3-way Split", sub: `≈${Math.floor(totalQuestions / 3)} each` },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer"
                  >
                    <div className="text-xs font-black text-slate-900">{p.title}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{p.sub}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={goToBlueprint}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {slotsGenerated ? "Continue to Blueprint" : "Generate Blueprint"} <IconChevronRight className="w-4 h-4" />
              </button>
              {slotsGenerated && (
                <p className="text-[11px] text-slate-400 font-medium text-center">
                  {counts.total} slots ready · {counts.pinned} pinned
                </p>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ STEP 2 ═══════════════ */}
        {step === 2 && slot && (
          <div className="mt-4 space-y-3">
            {/* Progress bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-slate-900">
                  Slot {slot.position} of {counts.total}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 font-bold">
                  <Pill className="bg-emerald-50 text-emerald-800 border-emerald-200">Bio {counts.bio}</Pill>
                  <Pill className="bg-amber-50 text-amber-800 border-amber-200">Chem {counts.chem}</Pill>
                  <Pill className="bg-cyan-50 text-cyan-800 border-cyan-200">Phy {counts.phy}</Pill>
                  <Pill className="bg-indigo-50 text-indigo-800 border-indigo-200">
                    <span className="inline-flex items-center gap-1">
                      <IconPin className="w-3 h-3" />
                      {counts.pinned} pinned
                    </span>
                  </Pill>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${(counts.configured / Math.max(1, counts.total)) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-3">
              {/* Slot rail */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-2 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible scrollbar-none">
                  {slots.map((s, i) => {
                    const active = i === activeIdx;
                    return (
                      <button
                        key={s.position}
                        onClick={() => setActiveIdx(i)}
                        className={classNames(
                          "shrink-0 lg:w-full text-left px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border",
                          active
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={classNames("w-2 h-2 rounded-full shrink-0", SUBJECT_META[s.subject].dot)} />
                          <span className={active ? "text-white" : "text-slate-900"}>#{s.position}</span>
                          {s.pinnedQuestionIds.length > 0 && (
                            <span className={classNames("ml-auto inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full", active ? "bg-white/20" : "bg-indigo-100 text-indigo-700")}>
                              <IconPin className="w-2.5 h-2.5" />
                              {s.pinnedQuestionIds.length}
                            </span>
                          )}
                        </div>
                        <div className={classNames("truncate mt-0.5", active ? "text-indigo-100" : "text-slate-400")}>
                          {s.chapter || "Any chapter"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot editor */}
              <div className="space-y-3 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 sm:p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Subject</Label>
                      <CustomSelect
                        value={slot.subject}
                        onChange={(v) => updateSlot(activeIdx, { subject: v as SubjectId, chapter: null, topic: null, pinnedQuestionIds: [] })}
                        options={(Object.keys(SUBJECT_META) as SubjectId[]).map((s) => ({ value: s, label: SUBJECT_META[s].label }))}
                        buttonClassName="py-2.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Chapter</Label>
                      <CustomSelect
                        value={slot.chapter || ""}
                        onChange={(v) => updateSlot(activeIdx, { chapter: v || null, topic: null, pinnedQuestionIds: [] })}
                        options={[
                          { value: "", label: "Any / unassigned" },
                          ...chaptersForSubject(slot.subject).map((c) => ({ value: c.chapter, label: c.chapter })),
                        ]}
                        buttonClassName="py-2.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Topic</Label>
                      <CustomSelect
                        value={slot.topic || ""}
                        onChange={(v) => updateSlot(activeIdx, { topic: v || null, pinnedQuestionIds: [] })}
                        options={[
                          { value: "", label: slot.chapter ? "Any / unassigned" : "Pick a chapter first" },
                          ...topicsForChapter(slot.chapter).map((t) => ({ value: t.topic, label: t.topic })),
                        ]}
                        buttonClassName="py-2.5"
                      />
                    </div>
                    <div>
                      <Label>Difficulty</Label>
                      <CustomSelect
                        value={slot.difficulty || ""}
                        onChange={(v) => updateSlot(activeIdx, { difficulty: (v || null) as DifficultyId | null })}
                        options={[
                          { value: "", label: "Any" },
                          { value: "easy", label: "Easy" },
                          { value: "medium", label: "Medium" },
                          { value: "hard", label: "Hard" },
                        ]}
                        buttonClassName="py-2.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1 lg:col-span-1">
                      <div>
                        <Label>Marks</Label>
                        <input type="number" min={0} value={slot.marks} onChange={(e) => updateSlot(activeIdx, { marks: Number(e.target.value) })} className={inputSm} />
                      </div>
                      <div>
                        <Label>Neg</Label>
                        <input type="number" min={0} value={slot.negativeMarks} onChange={(e) => updateSlot(activeIdx, { negativeMarks: Number(e.target.value) })} className={inputSm} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowRangeApply((v) => !v)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                    >
                      Apply this config to a range of slots
                    </button>
                    {showRangeApply && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="from #" className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold" />
                        <IconChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="to #" className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold" />
                        <button onClick={applyToRange} className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer hover:bg-indigo-700">Apply</button>
                      </div>
                    )}
                  </div>

                  {/* Pinned chips */}
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wide">
                        {slot.pinnedQuestionIds.length > 0
                          ? `${slot.pinnedQuestionIds.length} question(s) pinned to this slot`
                          : "No questions pinned — engine auto-selects the best fit"}
                      </span>
                      {slot.pinnedQuestionIds.length > 0 && (
                        <button onClick={clearPins} className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1">
                          <IconTrash className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>
                    {slot.pinnedQuestionIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {slot.pinnedQuestionIds.map((id) => {
                          const meta = pinnedMeta[id];
                          return (
                            <span key={id} className="inline-flex items-center gap-1.5 max-w-full bg-white border border-indigo-200 rounded-lg pl-2 pr-1 py-1 text-[11px] font-semibold text-slate-700">
                              <IconPin className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[220px]">
                                {meta ? <MathRenderer text={String(meta.text || "")} inline /> : `Question …${id.slice(-6)}`}
                              </span>
                              <button
                                onClick={() =>
                                  updateSlot(activeIdx, { pinnedQuestionIds: slot.pinnedQuestionIds.filter((x) => x !== id) })
                                }
                                className="p-0.5 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
                              >
                                <IconCross className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Question list */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Question bank matches</h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {qLoading ? "Searching…" : `${qTotal} exam-eligible question(s) for ${SUBJECT_META[slot.subject].label}${slot.chapter ? ` · ${slot.chapter}` : ""}${slot.topic ? ` · ${slot.topic}` : ""}`}
                      </p>
                    </div>
                    <div className="relative">
                      <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        value={qSearch}
                        onChange={(e) => setQSearch(e.target.value)}
                        placeholder="Search text / category…"
                        className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-52"
                      />
                    </div>
                  </div>

                  {qLoading ? (
                    <div className="py-12 flex items-center justify-center">
                      <Spinner className="w-6 h-6 text-indigo-600" />
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-xs font-bold text-slate-600">No exam-eligible questions match this slot.</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1 max-w-md mx-auto">
                        You can still leave it unpinned — at exam time the engine auto-fills this slot from the wider {SUBJECT_META[slot.subject].label} pool. Or add questions to the Question Bank / broaden the chapter & topic.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {questions.map((q) => {
                        const pinned = slot.pinnedQuestionIds.includes(q._id);
                        return (
                          <div
                            key={q._id}
                            className={classNames(
                              "rounded-xl border p-3 transition-all",
                              pinned ? "border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => togglePin(q)}
                                title={pinned ? "Unpin from this slot" : "Pin to this slot"}
                                className={classNames(
                                  "shrink-0 mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer",
                                  pinned ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-transparent hover:border-indigo-400"
                                )}
                              >
                                <IconCheck className="w-3.5 h-3.5" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-800 leading-relaxed break-words">
                                  <MathRenderer text={String(q.text || "")} />
                                </div>
                                {q.questionImage?.url && (
                                  <img src={q.questionImage.url} alt="" className="mt-1.5 max-h-28 rounded-lg border border-slate-200" />
                                )}
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {(q.options || []).map((o) => {
                                    const correct = String(o.key).toUpperCase() === String(q.correctAnswer).toUpperCase();
                                    return (
                                      <div
                                        key={o.key}
                                        className={classNames(
                                          "flex items-start gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
                                          correct ? "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold" : "border-slate-200 text-slate-600"
                                        )}
                                      >
                                        <span className="font-black">{o.key}.</span>
                                        <span className="flex-1 min-w-0 break-words">
                                          <MathRenderer text={String(o.text || (o.image?.url ? "[image]" : ""))} inline />
                                        </span>
                                        {correct && <IconCheck className="w-3 h-3 text-emerald-600 shrink-0" />}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                  <Pill className={DIFF_META[(q.difficulty as DifficultyId)] || "bg-slate-100 text-slate-600 border-slate-200"}>
                                    {q.difficulty || "—"}
                                  </Pill>
                                  {q.classLevel && <Pill className="bg-slate-100 text-slate-600 border-slate-200">Class {q.classLevel}</Pill>}
                                  {q.chapter && <Pill className="bg-slate-100 text-slate-600 border-slate-200">{q.chapter}</Pill>}
                                  {q.topic && <Pill className="bg-slate-100 text-slate-500 border-slate-200">{q.topic}</Pill>}
                                  <Pill className="bg-slate-100 text-slate-500 border-slate-200">used {q.usageCount ?? 0}×</Pill>
                                  <button
                                    onClick={() => setPreviewQ(q)}
                                    className="ml-auto inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 cursor-pointer"
                                  >
                                    <IconEye className="w-3 h-3" /> Preview
                                  </button>
                                  {(q.solution?.text || (q.solution?.images && q.solution.images.length > 0)) && (
                                    <button
                                      onClick={() => setExpandedSolution((p) => ({ ...p, [q._id]: !p[q._id] }))}
                                      className="text-slate-500 hover:text-slate-700 cursor-pointer"
                                    >
                                      {expandedSolution[q._id] ? "Hide solution" : "Solution"}
                                    </button>
                                  )}
                                </div>
                                {expandedSolution[q._id] && q.solution && (
                                  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px] text-slate-700 leading-relaxed">
                                    <MathRenderer text={String(q.solution.text || "")} />
                                    {(q.solution.images || []).map((im, k) =>
                                      im?.url ? <img key={k} src={im.url} alt="" className="mt-1.5 max-h-40 rounded border border-slate-200" /> : null
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {qTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        disabled={qPage <= 1}
                        onClick={() => setQPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-200 flex items-center gap-1"
                      >
                        <IconChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-[11px] font-bold text-slate-500">
                        Page {qPage} / {qTotalPages}
                      </span>
                      <button
                        disabled={qPage >= qTotalPages}
                        onClick={() => setQPage((p) => Math.min(qTotalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-200 flex items-center gap-1"
                      >
                        Next <IconChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer nav */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl shadow-lg p-3 flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5">
                <IconChevronLeft className="w-3.5 h-3.5" /> Details
              </button>
              <div className="flex items-center gap-2">
                <button
                  disabled={activeIdx <= 0}
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  className="px-3 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 hover:border-indigo-300 flex items-center gap-1"
                >
                  <IconChevronLeft className="w-3.5 h-3.5" /> Prev slot
                </button>
                <button
                  disabled={activeIdx >= slots.length - 1}
                  onClick={() => setActiveIdx((i) => Math.min(slots.length - 1, i + 1))}
                  className="px-3 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 hover:border-indigo-300 flex items-center gap-1"
                >
                  Next slot <IconChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                Review & Save <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════ STEP 3 ═══════════════ */}
        {step === 3 && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-900">Blueprint summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Stat label="Total slots" value={counts.total} />
                <Stat label="Total marks" value={totalMarks} />
                <Stat label="Slots with chapter" value={`${counts.configured}/${counts.total}`} />
                <Stat label="Slots pinned" value={counts.pinned} />
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[46vh] overflow-y-auto">
                <table className="w-full text-left text-[11px] min-w-[640px]">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="p-2 w-12">#</th>
                      <th className="p-2 w-24">Subject</th>
                      <th className="p-2">Chapter</th>
                      <th className="p-2">Topic</th>
                      <th className="p-2 w-20">Difficulty</th>
                      <th className="p-2 w-14 text-center">Marks</th>
                      <th className="p-2 w-20 text-center">Pinned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {slots.map((s) => (
                      <tr
                        key={s.position}
                        className={classNames("hover:bg-slate-50 cursor-pointer", s.pinnedQuestionIds.length > 0 && "bg-indigo-50/40")}
                        onClick={() => {
                          setActiveIdx(slots.findIndex((x) => x.position === s.position));
                          setStep(2);
                        }}
                      >
                        <td className="p-2 font-black text-slate-900">{s.position}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={classNames("w-2 h-2 rounded-full", SUBJECT_META[s.subject].dot)} />
                            {SUBJECT_META[s.subject].label}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600">{s.chapter || <span className="text-slate-300">Any</span>}</td>
                        <td className="p-2 text-slate-500">{s.topic || <span className="text-slate-300">Any</span>}</td>
                        <td className="p-2 capitalize text-slate-600">{s.difficulty || "Any"}</td>
                        <td className="p-2 text-center font-bold">{s.marks}</td>
                        <td className="p-2 text-center">
                          {s.pinnedQuestionIds.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-black">
                              <IconPin className="w-2.5 h-2.5" />
                              {s.pinnedQuestionIds.length}
                            </span>
                          ) : (
                            <span className="text-slate-300">auto</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              {reviewWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
                  <div className="text-xs font-black text-amber-900">Before you save</div>
                  <ul className="text-[11px] text-amber-800 font-medium space-y-1 list-disc pl-4">
                    {reviewWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2">
                <Label>Sprint</Label>
                <div className="text-sm font-black text-slate-900">{name || "Untitled sprint"}</div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Status on save: <span className="font-bold uppercase">{status}</span>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? <Spinner className="w-4 h-4 text-white" /> : isEdit ? "Save Blueprint" : "Create Sprint"}
              </button>
              <button onClick={() => setStep(2)} className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5">
                <IconChevronLeft className="w-3.5 h-3.5" /> Back to slots
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      <CommonModal isOpen={!!previewQ} onClose={() => setPreviewQ(null)} title="Question preview" maxWidth="max-w-2xl">
        {previewQ && (
          <div className="space-y-3 text-slate-800">
            <div className="text-sm font-semibold leading-relaxed break-words">
              <MathRenderer text={String(previewQ.text || "")} />
            </div>
            {previewQ.questionImage?.url && <img src={previewQ.questionImage.url} alt="" className="max-h-56 rounded-lg border border-slate-200" />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(previewQ.options || []).map((o) => {
                const correct = String(o.key).toUpperCase() === String(previewQ.correctAnswer).toUpperCase();
                return (
                  <div key={o.key} className={classNames("rounded-lg border px-3 py-2 text-xs", correct ? "border-emerald-300 bg-emerald-50 font-semibold" : "border-slate-200")}>
                    <span className="font-black">{o.key}. </span>
                    <MathRenderer text={String(o.text || (o.image?.url ? "[image]" : ""))} inline />
                    {o.image?.url && <img src={o.image.url} alt="" className="mt-1 max-h-24 rounded border border-slate-200" />}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
              <Pill className="bg-emerald-50 text-emerald-800 border-emerald-200">Answer: {previewQ.correctAnswer}</Pill>
              <Pill className={DIFF_META[(previewQ.difficulty as DifficultyId)] || "bg-slate-100 text-slate-600 border-slate-200"}>{previewQ.difficulty}</Pill>
              {previewQ.chapter && <Pill className="bg-slate-100 text-slate-600 border-slate-200">{previewQ.chapter}</Pill>}
              {previewQ.topic && <Pill className="bg-slate-100 text-slate-500 border-slate-200">{previewQ.topic}</Pill>}
            </div>
            {previewQ.solution?.text && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 leading-relaxed">
                <div className="font-black text-slate-500 uppercase text-[10px] mb-1">Solution</div>
                <MathRenderer text={String(previewQ.solution.text)} />
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  togglePin(previewQ);
                  setPreviewQ(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <IconPlus className="w-3.5 h-3.5" />
                {slot && slot.pinnedQuestionIds.includes(previewQ._id) ? "Unpin from slot" : "Pin to this slot"}
              </button>
            </div>
          </div>
        )}
      </CommonModal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3.5 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold";
const inputSm =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-2.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-center";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1.5">{children}</label>;
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={classNames("px-2 py-0.5 rounded-full border", className)}>{children}</span>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
