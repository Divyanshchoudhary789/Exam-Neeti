"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminService } from "../../services/apiServices";
import { MathRenderer } from "../common/MathRenderer";
import {
  IconEdit, IconTrash, IconUpload, IconDownload, IconSearch,
  Spinner, PaginationControls,
} from "../common/UIComponents";
import { EditQuestionModal } from "./EditQuestionModal";
import { BulkUploadQuestionsModal } from "./BulkUploadQuestionsModal";

interface MyQuestionsPanelProps {
  showToast: (text: string, type?: "success" | "error") => void;
}

type StatusFilter = "draft" | "active" | "";

/**
 * "My Questions" — every question the CURRENT admin created (bulk-uploaded
 * or manually added), regardless of status. Defaults to the Draft tab since
 * reviewing fresh bulk uploads is the primary reason to visit this page.
 * Bulk upload + sample template download live here.
 */
export function MyQuestionsPanel({ showToast }: MyQuestionsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("draft");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [questionsList, setQuestionsList] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false);
  const [selectedQuestionToEdit, setSelectedQuestionToEdit] = useState<Record<string, unknown> | null>(null);
  const [fetchingEditId, setFetchingEditId] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "xlsx" | null>(null);

  const loadMyQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getQuestions({
        mine: true,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      });
      const rawQ = res?.data?.questions || res?.questions || res?.data || res || [];
      setQuestionsList(Array.isArray(rawQ) ? rawQ : []);
      setTotalPages(res?.data?.pagination?.totalPages || res?.pagination?.totalPages || 1);
      setTotalItems(res?.data?.pagination?.total ?? res?.pagination?.total ?? (rawQ as unknown[]).length);
    } catch {
      showToast("Failed to load your questions", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, limit, showToast]);

  useEffect(() => { loadMyQuestions(); }, [loadMyQuestions]);

  /**
   * The list response excludes `correctAnswer` and `solution` (see backend
   * listQuestions' .select()) — always fetch the full document before
   * opening the edit modal, or solution text/correct answer silently break.
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
        showToast("Failed to load question for review", "error");
      }
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load question for review", "error");
    } finally {
      setFetchingEditId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this question permanently?")) return;
    try {
      await adminService.deleteQuestion(id);
      showToast("Question deleted!");
      loadMyQuestions();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Delete failed", "error");
    }
  };

  const handleDownloadTemplate = async (format: "docx" | "xlsx") => {
    setDownloadingFormat(format);
    try {
      const { objectUrl, filename } = await adminService.downloadQuestionTemplate(format);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to download template", "error");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const tabs: Array<{ id: StatusFilter; label: string }> = [
    { id: "draft", label: "Draft" },
    { id: "active", label: "Active" },
    { id: "", label: "All" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header / actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">My Questions</h2>
            <p className="text-xs text-slate-500 font-medium">Questions you've added — bulk-uploaded or created manually.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDownloadTemplate("xlsx")}
              disabled={downloadingFormat !== null}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingFormat === "xlsx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
              <span>Excel Template</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate("docx")}
              disabled={downloadingFormat !== null}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingFormat === "docx" ? <Spinner className="w-3.5 h-3.5" /> : <IconDownload className="w-3.5 h-3.5" />}
              <span>Word Template</span>
            </button>
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <IconUpload className="w-4 h-4" /><span>Bulk Upload</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setStatusFilter(t.id); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-indigo-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search your questions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Spinner className="w-6 h-6 text-indigo-600 mx-auto" />
        </div>
      ) : questionsList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">
          {statusFilter === "draft"
            ? "No draft questions to review. Bulk-upload a file to get started."
            : "No questions match this view."}
        </div>
      ) : (
        <div className="space-y-3">
          {questionsList.map((q, idx) => {
            const qId = String(q._id || q.id || idx);
            const status = String(q.status || "active");
            const diff = String(q.difficulty || "Medium");
            const diffColors: Record<string, string> = { easy: "bg-emerald-50 text-emerald-700 border-emerald-200", medium: "bg-amber-50 text-amber-700 border-amber-200", hard: "bg-red-50 text-red-700 border-red-200" };
            return (
              <div key={qId} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-md transition-all shadow-sm">
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${
                    status === "draft" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>{status}</span>
                  <span className="text-xs font-bold text-slate-700">{String(q.subject || "")} · {String(q.chapter || "General")}{q.topic ? ` · ${String(q.topic)}` : ""}</span>
                  <span className={`ml-auto px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase ${diffColors[diff.toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{diff}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed line-clamp-2 flex-1">
                    <MathRenderer text={String(q.text || "Question text...")} />
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEditQuestion(qId)}
                      disabled={fetchingEditId === qId}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {fetchingEditId === qId ? <Spinner className="w-3.5 h-3.5" /> : <IconEdit className="w-3.5 h-3.5" />}<span>{status === "draft" ? "Review" : "Edit"}</span>
                    </button>
                    <button onClick={() => handleDelete(qId)} className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-xl transition-all cursor-pointer">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <PaginationControls currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
        </div>
      )}

      <EditQuestionModal
        isOpen={showEditQuestionModal}
        questionData={selectedQuestionToEdit}
        onClose={() => setShowEditQuestionModal(false)}
        onSuccess={loadMyQuestions}
        showToast={showToast}
      />

      <BulkUploadQuestionsModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        onSuccess={loadMyQuestions}
        showToast={showToast}
      />
    </div>
  );
}
