"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { adminService } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import { MathRenderer } from "../common/MathRenderer";
import {
  IconBook, IconFilter, IconPlus, IconTrash, IconEdit, IconEye, IconSearch, IconCheck, IconKey,
  Spinner, MiniStatCard, CommonModal, PaginationControls,
} from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { EditQuestionModal } from "./EditQuestionModal";
import { ManageQuestionFieldsModal } from "./ManageQuestionFieldsModal";
import { DynamicCustomFieldsSection } from "./CustomFieldInputs";
import type { QuestionFieldDefinition, CustomFieldValues } from "../../types/questionFields";

interface QuestionBankPanelProps {
  showToast: (text: string, type?: "success" | "error") => void;
}

/**
 * The full Question Bank — every question in the bank, regardless of who
 * created it. Extracted verbatim out of AdminDashboard.tsx's old inline
 * "questions" tab (behavior unchanged) except: the Edit button is now
 * owner-gated (super_admin sees it on everything; a regular admin only on
 * questions they created), and each card shows a Draft/Active status pill.
 * Mounted identically by both AdminDashboard.tsx and SuperAdminDashboard.tsx.
 */
export function QuestionBankPanel({ showToast }: QuestionBankPanelProps) {
  const { user } = useAuthStore();

  // ── Question Bank state ───────────────────────────────────────────────
  const [questionsList, setQuestionsList] = useState<Record<string, unknown>[]>([]);
  const [qSubjectFilter, setQSubjectFilter] = useState("");
  const [qDifficultyFilter, setQDifficultyFilter] = useState("");
  const [qClassLevel, setQClassLevel] = useState("");
  // Default to Active so the main bank view isn't cluttered with unreviewed
  // drafts by default — admins can switch to Draft/All explicitly.
  const [qStatusFilter, setQStatusFilter] = useState<"active" | "draft" | "">("active");
  const [qSearch, setQSearch] = useState("");
  const [qPage, setQPage] = useState(1);
  const [qLimit] = useState(10);
  const [qTotalPages, setQTotalPages] = useState(1);
  const [qTotalItems, setQTotalItems] = useState(0);
  const [qStats, setQStats] = useState<Record<string, unknown> | null>(null);
  const [showViewQuestionModal, setShowViewQuestionModal] = useState(false);
  const [selectedQuestionDetail, setSelectedQuestionDetail] = useState<Record<string, unknown> | null>(null);
  const [fetchingQuestionDetail, setFetchingQuestionDetail] = useState(false);

  // Edit Question state
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false);
  const [selectedQuestionToEdit, setSelectedQuestionToEdit] = useState<Record<string, unknown> | null>(null);
  const [fetchingEditId, setFetchingEditId] = useState<string | null>(null);

  // Add Question form
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQSubject, setNewQSubject] = useState("Physics");
  const [newQClassLevel, setNewQClassLevel] = useState("XII");
  const [newQChapter, setNewQChapter] = useState("");
  const [newQTopic, setNewQTopic] = useState("");
  const [newQDifficulty, setNewQDifficulty] = useState("Medium");
  const [newQText, setNewQText] = useState("");
  const [newQOptA, setNewQOptA] = useState("");
  const [newQOptB, setNewQOptB] = useState("");
  const [newQOptC, setNewQOptC] = useState("");
  const [newQOptD, setNewQOptD] = useState("");
  const [newQCorrect, setNewQCorrect] = useState("A");
  const [newQMarks, setNewQMarks] = useState(4);
  const [newQNegMarks, setNewQNegMarks] = useState(1);
  const [newQHasLatex, setNewQHasLatex] = useState(false);
  const [newQSolutionText, setNewQSolutionText] = useState("");
  const [newQImageFile, setNewQImageFile] = useState<File | null>(null);
  const [newQSolImageFile, setNewQSolImageFile] = useState<File | null>(null);
  const [qSubmitting, setQSubmitting] = useState(false);
  const qImageInputRef = useRef<HTMLInputElement>(null);
  const qSolImageInputRef = useRef<HTMLInputElement>(null);

  // Admin-defined custom fields (e.g. "Sub Topic")
  const [fieldDefinitions, setFieldDefinitions] = useState<QuestionFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});
  const [showManageFieldsModal, setShowManageFieldsModal] = useState(false);

  // ── Data loader ────────────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    const [qRes, stRes] = await Promise.allSettled([
      adminService.getQuestions({
        subject: qSubjectFilter || undefined,
        difficulty: qDifficultyFilter || undefined,
        classLevel: qClassLevel || undefined,
        status: qStatusFilter || undefined,
        search: qSearch.trim() || undefined,
        page: qPage,
        limit: qLimit,
      }),
      adminService.getQuestionStats(),
    ]);

    if (qRes.status === "fulfilled") {
      const val = qRes.value;
      const rawQ = val?.data?.questions || val?.questions || val?.data || val || [];
      setQuestionsList(Array.isArray(rawQ) ? rawQ : []);
      setQTotalPages(val?.data?.pagination?.totalPages || val?.pagination?.totalPages || 1);
      setQTotalItems(val?.data?.pagination?.total ?? val?.pagination?.total ?? (rawQ as unknown[]).length);
    }
    if (stRes.status === "fulfilled") {
      const s = stRes.value?.data?.stats || stRes.value?.stats || stRes.value?.data || stRes.value;
      setQStats(s && typeof s === "object" ? s : null);
    }
  }, [qSubjectFilter, qDifficultyFilter, qClassLevel, qStatusFilter, qSearch, qPage, qLimit]);

  // Mounted only while its tab is active (parent conditionally renders this
  // component) — a single effect covers both "just activated" and "filters
  // changed", since mount already happens exactly on tab activation.
  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const loadFieldDefinitions = useCallback(async () => {
    try {
      const res = await adminService.getQuestionFieldDefinitions(true);
      const list = res?.data?.fieldDefinitions || res?.fieldDefinitions || res?.data || res || [];
      setFieldDefinitions(Array.isArray(list) ? list : []);
    } catch {
      // Non-fatal — Add Question form just won't show custom fields this session.
    }
  }, []);

  useEffect(() => { loadFieldDefinitions(); }, [loadFieldDefinitions]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleViewQuestionDetails = async (id: string) => {
    setShowViewQuestionModal(true); setFetchingQuestionDetail(true); setSelectedQuestionDetail(null);
    try {
      const res = await adminService.getQuestionById(id);
      const q = res?.data?.question || res?.question || res?.data || res;
      setSelectedQuestionDetail(q && typeof q === "object" ? q : null);
    } catch (err: unknown) { showToast((err as { message?: string }).message || "Failed to fetch question", "error"); }
    finally { setFetchingQuestionDetail(false); }
  };

  /**
   * The list response deliberately excludes `correctAnswer` and `solution`
   * (see backend listQuestions' .select()) — opening the edit modal directly
   * with a list row silently lost the solution text and reset correctAnswer
   * to "A" on every save. Always fetch the full document first.
   */
  const handleEditQuestion = async (id: string) => {
    setFetchingEditId(id);
    try {
      const res = await adminService.getQuestionById(id);
      const q = res?.data?.question || res?.question || res?.data || res;
      if (q && typeof q === "object") {
        setSelectedQuestionToEdit(q);
        setShowEditQuestionModal(true);
      } else {
        showToast("Failed to load question for editing", "error");
      }
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load question for editing", "error");
    } finally {
      setFetchingEditId(null);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm("Delete this question permanently?")) return;
    try { await adminService.deleteQuestion(id); showToast("Question deleted!"); loadQuestions(); }
    catch (err: unknown) { showToast((err as { message?: string }).message || "Delete failed", "error"); }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault(); setQSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("subject", newQSubject);
      fd.append("classLevel", newQClassLevel);
      fd.append("chapter", newQChapter);
      if (newQTopic) fd.append("topic", newQTopic);
      fd.append("difficulty", newQDifficulty);
      fd.append("text", newQText);
      fd.append("options", JSON.stringify([
        { key: "A", text: newQOptA },
        { key: "B", text: newQOptB },
        { key: "C", text: newQOptC },
        { key: "D", text: newQOptD },
      ]));
      fd.append("correctAnswer", newQCorrect);
      fd.append("marks", String(newQMarks));
      fd.append("negativeMarks", String(newQNegMarks));
      fd.append("hasLatex", String(newQHasLatex));
      if (newQSolutionText) {
        fd.append("solution", JSON.stringify({ text: newQSolutionText, hasLatex: newQHasLatex }));
      }
      if (newQImageFile) fd.append("questionImage", newQImageFile);
      if (newQSolImageFile) fd.append("solutionImage", newQSolImageFile);
      fd.append("customFields", JSON.stringify(customFieldValues));

      await adminService.createQuestion(fd);
      showToast("Question added to bank!");
      setShowAddQuestionModal(false);
      setNewQChapter(""); setNewQTopic(""); setNewQText(""); setNewQSolutionText("");
      setNewQOptA(""); setNewQOptB(""); setNewQOptC(""); setNewQOptD("");
      setNewQImageFile(null); setNewQSolImageFile(null);
      setCustomFieldValues({});
      loadQuestions();
    } catch (err: unknown) { showToast((err as { message?: string }).message || "Failed to add question", "error"); }
    finally { setQSubmitting(false); }
  };

  // ── Derived values ─────────────────────────────────────────────────────
  const bySubj = ((qStats?.bySubject || qStats?.subjectCounts || {}) as Record<string, number>);
  const phyCount = bySubj["Physics"] ?? bySubj["physics"] ?? 0;
  const chemCount = bySubj["Chemistry"] ?? bySubj["chemistry"] ?? 0;
  const bioCount = bySubj["Biology"] ?? bySubj["biology"] ?? 0;
  const qTotalCount = Number(qStats?.total ?? qTotalItems);

  const solObj = selectedQuestionDetail?.solution as {
    text?: string;
    image?: { url?: string };
    images?: Array<{ url?: string }>;
    solutionImage?: { url?: string };
  } | undefined;

  const detailSolText = solObj?.text ? String(solObj.text) : "";
  const rawSolImg = selectedQuestionDetail?.solutionImage as { url?: string } | undefined;
  const detailSolImageUrl = solObj?.image?.url || solObj?.images?.[0]?.url || solObj?.solutionImage?.url || rawSolImg?.url || null;

  // Gates both Edit and Delete: super_admin can manage every question;
  // a regular admin can only manage questions they created themselves.
  // View has no restriction — any admin can view any question.
  const canManage = (q: Record<string, unknown>) => {
    if (user?.role === "super_admin") return true;
    const owner = (q.createdBy as { userId?: string } | undefined)?.userId;
    return Boolean(owner) && Boolean(user?.id) && String(owner) === String(user?.id);
  };

  /**
   * Human label for a customFields key. Looks up the live field definition
   * (so it always matches what "Manage Fields" shows); falls back to a
   * Title-Cased version of the raw key if the definition was since deleted
   * — a question can still hold a value for a key that no longer has an
   * active definition (see the preserve-on-edit logic in question.controller.js).
   */
  const formatFieldLabel = (key: string) => {
    const def = fieldDefinitions.find((d) => d.key === key);
    if (def) return def.label;
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  };

  /** Renders "Label: Value" pills for every non-empty customFields entry on a question. */
  const renderCustomFieldPills = (customFields: Record<string, unknown> | undefined, pillClass: string) => {
    if (!customFields) return null;
    const entries = Object.entries(customFields).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false);
    if (entries.length === 0) return null;
    return entries.map(([key, val]) => (
      <span key={key} className={pillClass}>
        <span className="font-black uppercase">{formatFieldLabel(key)}:</span> {val === true ? "Yes" : String(val)}
      </span>
    ));
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Question Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStatCard title="Total Questions" value={qTotalCount} icon={IconFilter} />
        <MiniStatCard title="Physics" value={phyCount} icon={IconBook} />
        <MiniStatCard title="Chemistry" value={chemCount} icon={IconBook} />
        <MiniStatCard title="Biology" value={bioCount} icon={IconBook} />
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Question Bank</h2>
            <p className="text-xs text-slate-500 font-medium">{qTotalItems} questions total</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowManageFieldsModal(true)} className="self-start flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <IconKey className="w-4 h-4" /><span>Manage Fields</span>
            </button>
            <button onClick={() => setShowAddQuestionModal(true)} className="self-start flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all">
              <IconPlus className="w-4 h-4" /><span>Add Question</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search questions..." value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" />
          </div>
          <CustomSelect
            value={qSubjectFilter}
            onChange={(val) => { setQSubjectFilter(val); setQPage(1); }}
            options={[
              { value: "", label: "All Subjects" },
              { value: "Physics", label: "Physics" },
              { value: "Chemistry", label: "Chemistry" },
              { value: "Biology", label: "Biology" },
            ]}
            className="w-full sm:w-auto min-w-[130px]"
          />
          <CustomSelect
            value={qDifficultyFilter}
            onChange={(val) => { setQDifficultyFilter(val); setQPage(1); }}
            options={[
              { value: "", label: "All Difficulties" },
              { value: "Easy", label: "Easy" },
              { value: "Medium", label: "Medium" },
              { value: "Hard", label: "Hard" },
            ]}
            className="w-full sm:w-auto min-w-[130px]"
          />
          <CustomSelect
            value={qClassLevel}
            onChange={(val) => { setQClassLevel(val); setQPage(1); }}
            options={[
              { value: "", label: "All Classes" },
              { value: "XI", label: "Class XI" },
              { value: "XII", label: "Class XII" },
            ]}
            className="w-full sm:w-auto min-w-[120px]"
          />
          <CustomSelect
            value={qStatusFilter}
            onChange={(val) => { setQStatusFilter(val as "active" | "draft" | ""); setQPage(1); }}
            options={[
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "", label: "All Statuses" },
            ]}
            className="w-full sm:w-auto min-w-[130px]"
          />
        </div>
      </div>

      {/* Questions list */}
      {questionsList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">
          No questions match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {questionsList.map((q, idx) => {
            const qId = String(q._id || q.id || idx);
            const subj = String(q.subject || "Physics");
            const diff = String(q.difficulty || "Medium");
            const status = String(q.status || "active");
            const diffColors: Record<string, string> = { easy: "bg-emerald-50 text-emerald-700 border-emerald-200", medium: "bg-amber-50 text-amber-700 border-amber-200", hard: "bg-red-50 text-red-700 border-red-200" };
            const subjColors: Record<string, string> = { physics: "bg-indigo-50 text-indigo-700 border-indigo-200", chemistry: "bg-violet-50 text-violet-700 border-violet-200", biology: "bg-teal-50 text-teal-700 border-teal-200" };
            return (
              <div key={qId} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-md transition-all shadow-sm">
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${subjColors[subj.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{subj}</span>
                  <span className="text-xs font-bold text-slate-700">{String(q.chapter || "General")}{q.topic ? ` · ${String(q.topic)}` : ""}</span>
                  {Boolean(q.classLevel) && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{String(q.classLevel)}</span>}
                  {status === "draft" && (
                    <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-amber-50 text-amber-700 border-amber-200">Draft</span>
                  )}
                  <span className={`ml-auto px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${diffColors[diff.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{diff}</span>
                </div>
                {(() => {
                  const pills = renderCustomFieldPills(
                    q.customFields as Record<string, unknown> | undefined,
                    "px-2.5 py-0.5 rounded-full border text-[10px] font-semibold bg-violet-50 text-violet-700 border-violet-200"
                  );
                  return pills ? <div className="flex flex-wrap gap-1.5 pt-2">{pills}</div> : null;
                })()}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed line-clamp-2 flex-1">
                    <MathRenderer text={String(q.text || "Question text...")} />
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleViewQuestionDetails(qId)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer">
                      <IconEye className="w-3.5 h-3.5" /><span>View</span>
                    </button>
                    {canManage(q) && (
                      <>
                        <button
                          onClick={() => handleEditQuestion(qId)}
                          disabled={fetchingEditId === qId}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {fetchingEditId === qId ? <Spinner className="w-3.5 h-3.5" /> : <IconEdit className="w-3.5 h-3.5" />}<span>Edit</span>
                        </button>
                        <button onClick={() => handleDeleteQuestion(qId)} className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-xl transition-all cursor-pointer">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <PaginationControls currentPage={qPage} totalPages={qTotalPages} totalItems={qTotalItems} onPageChange={p => setQPage(p)} />
        </div>
      )}

      {/* Edit Question */}
      <EditQuestionModal
        isOpen={showEditQuestionModal}
        questionData={selectedQuestionToEdit}
        onClose={() => setShowEditQuestionModal(false)}
        onSuccess={loadQuestions}
        showToast={showToast}
      />

      {/* Add Question – uses multipart/form-data */}
      <CommonModal isOpen={showAddQuestionModal} onClose={() => setShowAddQuestionModal(false)} title="Add Question to Bank" maxWidth="max-w-2xl">
        <form onSubmit={handleAddQuestion} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Subject</label>
              <select value={newQSubject} onChange={e => setNewQSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer">
                <option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Biology">Biology</option>
              </select></div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Class</label>
              <select value={newQClassLevel} onChange={e => setNewQClassLevel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer">
                <option value="XI">Class XI</option><option value="XII">Class XII</option>
              </select></div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Difficulty</label>
              <select value={newQDifficulty} onChange={e => setNewQDifficulty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer">
                <option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
              </select></div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Correct</label>
              <select value={newQCorrect} onChange={e => setNewQCorrect(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer">
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Chapter *</label>
              <input type="text" required value={newQChapter} onChange={e => setNewQChapter(e.target.value)} placeholder="e.g. Thermodynamics" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium" /></div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Topic</label>
              <input type="text" value={newQTopic} onChange={e => setNewQTopic(e.target.value)} placeholder="e.g. First Law" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium" /></div>
          </div>
          <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Question Text *</label>
            <textarea required rows={3} value={newQText} onChange={e => setNewQText(e.target.value)} placeholder="Enter full question text (LaTeX supported)..." className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-3 rounded-xl focus:outline-none font-medium resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            {["A", "B", "C", "D"].map((key, i) => {
              const vals = [newQOptA, newQOptB, newQOptC, newQOptD];
              const setters = [setNewQOptA, setNewQOptB, setNewQOptC, setNewQOptD];
              return (
                <div key={key}><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Option {key}</label>
                  <input type="text" required value={vals[i]} onChange={e => setters[i](e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium" /></div>
              );
            })}
          </div>
          <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Solution Explanation (Optional)</label>
            <textarea rows={2} value={newQSolutionText} onChange={e => setNewQSolutionText(e.target.value)} placeholder="Detailed step-by-step solution text..." className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-3 rounded-xl focus:outline-none font-medium resize-none" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Marks</label>
              <input type="number" min={1} value={newQMarks} onChange={e => setNewQMarks(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium" /></div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Neg. Marks</label>
              <input type="number" min={0} step={0.25} value={newQNegMarks} onChange={e => setNewQNegMarks(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium" /></div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newQHasLatex} onChange={e => setNewQHasLatex(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-xs font-semibold text-slate-700">Has LaTeX</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Question Image (optional)</label>
              <input type="file" ref={qImageInputRef} accept="image/*" onChange={e => setNewQImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
            </div>
            <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Solution Image (optional)</label>
              <input type="file" ref={qSolImageInputRef} accept="image/*" onChange={e => setNewQSolImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
            </div>
          </div>
          <DynamicCustomFieldsSection
            fieldDefinitions={fieldDefinitions}
            values={customFieldValues}
            onChange={(key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
          />
          <button type="submit" disabled={qSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer">
            {qSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Question"}
          </button>
        </form>
      </CommonModal>

      {/* Manage Custom Fields */}
      <ManageQuestionFieldsModal
        isOpen={showManageFieldsModal}
        onClose={() => setShowManageFieldsModal(false)}
        showToast={showToast}
        onFieldsChanged={loadFieldDefinitions}
      />

      {/* View Question Detail */}
      <CommonModal isOpen={showViewQuestionModal} onClose={() => setShowViewQuestionModal(false)} title="Question Details" maxWidth="max-w-2xl">
        {fetchingQuestionDetail ? (
          <div className="py-12 text-center space-y-3"><Spinner className="w-8 h-8 text-indigo-600 mx-auto" /><p className="text-xs font-semibold text-slate-500">Loading question data...</p></div>
        ) : selectedQuestionDetail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100">
              {["subject", "chapter", "topic", "classLevel", "difficulty"].map(k => {
                const val = selectedQuestionDetail[k];
                if (!val) return null;
                const valStr = String(val).toLowerCase();
                const colorCls = k === "difficulty" && valStr === "easy"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : k === "difficulty" && valStr === "hard"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";
                return <span key={k} className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${colorCls}`}>{String(val)}</span>;
              })}
              {String(selectedQuestionDetail.status || "active") === "draft" && (
                <span className="px-2.5 py-1 rounded-full border text-[10px] font-black uppercase bg-amber-50 text-amber-700 border-amber-200">Draft</span>
              )}
              <span className="ml-auto text-xs font-extrabold text-slate-400">+{String(selectedQuestionDetail.marks || 4)} / -{String(selectedQuestionDetail.negativeMarks || 1)}</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-black uppercase text-indigo-600">Question</span>
              <p className="text-sm font-bold text-slate-900 leading-relaxed"><MathRenderer text={String(selectedQuestionDetail.text || "")} /></p>
              {(selectedQuestionDetail.questionImage as { url?: string })?.url && (
                <img src={(selectedQuestionDetail.questionImage as { url?: string }).url} alt="Q img" className="max-h-56 rounded-xl border border-slate-200 object-contain mt-2" />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.isArray(selectedQuestionDetail.options) && (selectedQuestionDetail.options as Array<{ key: string; text: string; image?: { url?: string } }>).map(opt => {
                const correct = String(opt.key).toUpperCase() === String(selectedQuestionDetail.correctAnswer).toUpperCase();
                return (
                  <div key={opt.key} className={`p-4 rounded-2xl border flex items-start gap-3 ${correct ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}>
                    <span className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${correct ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{opt.key}</span>
                    <span className="text-xs font-semibold flex-1"><MathRenderer text={opt.text} inline /></span>
                    {correct && <IconCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
            {(() => {
              const pills = renderCustomFieldPills(
                selectedQuestionDetail.customFields as Record<string, unknown> | undefined,
                "px-2.5 py-1 rounded-full border text-[10px] font-semibold bg-violet-50 text-violet-700 border-violet-200"
              );
              if (!pills) return null;
              return (
                <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-violet-700 tracking-wider">Additional Fields</span>
                  <div className="flex flex-wrap gap-1.5">{pills}</div>
                </div>
              );
            })()}
            {(Boolean(detailSolText) || Boolean(detailSolImageUrl)) && (
              <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3">
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Solution Explanation</span>
                {Boolean(detailSolText) && (
                  <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white/70 p-4 rounded-xl border border-indigo-100">
                    <MathRenderer text={detailSolText} />
                  </div>
                )}
                {Boolean(detailSolImageUrl) && (
                  <div>
                    <p className="text-[10px] font-extrabold text-indigo-600 uppercase mb-1">Solution Diagram</p>
                    <img src={detailSolImageUrl!} alt="Sol img" className="max-h-64 rounded-xl border border-indigo-200 object-contain bg-white p-1" />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-xs font-semibold text-slate-400">No question data available.</p>
        )}
      </CommonModal>
    </div>
  );
}
