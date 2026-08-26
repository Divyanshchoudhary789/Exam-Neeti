"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminService } from "../../services/apiServices";
import { CommonModal, Spinner, IconPlus, IconEdit, IconTrash, IconCross } from "../common/UIComponents";
import type { QuestionFieldDefinition, QuestionFieldType } from "../../types/questionFields";

interface ManageQuestionFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  /** Called after any create/update/toggle/delete so parents can refresh their active-field list. */
  onFieldsChanged: () => void;
}

const TYPE_LABELS: Record<QuestionFieldType, string> = {
  text: "Text",
  textarea: "Paragraph",
  number: "Number",
  select: "Dropdown",
  boolean: "Yes / No",
};

/**
 * Built-in Question fields — these already exist on every question (see
 * backend/models/Question.model.js) and are shown here read-only so an admin
 * can see what's already available before adding a new custom field. Their
 * `key`s are exactly what the backend rejects as reserved when creating a
 * custom field (see RESERVED_KEYS in questionFieldDefinition.controller.js).
 */
const BUILT_IN_FIELDS: Array<{ label: string; key: string }> = [
  { label: "Subject", key: "subject" },
  { label: "Class Level", key: "classLevel" },
  { label: "Chapter", key: "chapter" },
  { label: "Topic", key: "topic" },
  { label: "Question Category", key: "questionCategory" },
  { label: "Question Variant", key: "questionVariant" },
  { label: "Difficulty", key: "difficulty" },
  { label: "Ideal Time (seconds)", key: "idealTimeSeconds" },
  { label: "Question Text", key: "text" },
  { label: "Options (A–D)", key: "options" },
  { label: "Correct Answer", key: "correctAnswer" },
  { label: "Marks", key: "marks" },
  { label: "Negative Marks", key: "negativeMarks" },
  { label: "Solution Explanation", key: "solution" },
  { label: "Source Ref", key: "sourceRef" },
  { label: "Has LaTeX", key: "hasLatex" },
  { label: "Status (Draft/Active)", key: "status" },
];

const inputClass =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium";
const selectClass =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer";
const labelClass = "text-[10px] font-extrabold uppercase text-slate-500 block mb-1";

function slugifyToKey(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const [first, ...rest] = words;
  let key =
    first.toLowerCase() +
    rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
  key = key.replace(/^[^a-z]+/, "");
  return key.slice(0, 40);
}

const emptyForm = {
  label: "",
  key: "",
  type: "text" as QuestionFieldType,
  options: [] as string[],
  required: false,
  order: 0,
  helpText: "",
  min: "" as number | "",
  max: "" as number | "",
};

/**
 * Admin/super_admin self-service CRUD for custom Question fields (e.g. "Sub
 * Topic"). List mode shows every definition (active + inactive); form mode
 * creates a new one or edits an existing one. Key + Type are immutable once
 * a definition exists — the form disables both fields in edit mode.
 */
export function ManageQuestionFieldsModal({ isOpen, onClose, showToast, onFieldsChanged }: ManageQuestionFieldsModalProps) {
  const [loading, setLoading] = useState(false);
  const [fieldDefinitions, setFieldDefinitions] = useState<QuestionFieldDefinition[]>([]);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [keyTouched, setKeyTouched] = useState(false);
  const [optionDraft, setOptionDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadFieldDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getQuestionFieldDefinitions();
      const list = res?.data?.fieldDefinitions || res?.fieldDefinitions || res?.data || res || [];
      setFieldDefinitions(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load custom fields", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      setMode("list");
      loadFieldDefinitions();
    }
  }, [isOpen, loadFieldDefinitions]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setKeyTouched(false);
    setOptionDraft("");
    setMode("form");
  };

  const openEditForm = (def: QuestionFieldDefinition) => {
    setEditingId(def._id);
    setForm({
      label: def.label,
      key: def.key,
      type: def.type,
      options: def.options || [],
      required: def.required,
      order: def.order,
      helpText: def.helpText || "",
      min: def.min ?? "",
      max: def.max ?? "",
    });
    setKeyTouched(true);
    setOptionDraft("");
    setMode("form");
  };

  const handleLabelChange = (label: string) => {
    setForm((f) => ({ ...f, label, key: keyTouched || editingId ? f.key : slugifyToKey(label) }));
  };

  const addOption = () => {
    const val = optionDraft.trim();
    if (!val || form.options.includes(val)) { setOptionDraft(""); return; }
    setForm((f) => ({ ...f, options: [...f.options, val] }));
    setOptionDraft("");
  };

  const removeOption = (opt: string) => {
    setForm((f) => ({ ...f, options: f.options.filter((o) => o !== opt) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.type === "select" && form.options.length === 0) {
      showToast("Add at least one option for a dropdown field", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await adminService.updateQuestionFieldDefinition(editingId, {
          label: form.label,
          options: form.type === "select" ? form.options : undefined,
          required: form.required,
          order: form.order,
          helpText: form.helpText,
          min: form.type === "number" && form.min !== "" ? Number(form.min) : null,
          max: form.type === "number" && form.max !== "" ? Number(form.max) : null,
        });
        showToast("Field updated!");
      } else {
        await adminService.createQuestionFieldDefinition({
          label: form.label,
          key: form.key,
          type: form.type,
          options: form.type === "select" ? form.options : undefined,
          required: form.required,
          order: form.order,
          helpText: form.helpText,
          min: form.type === "number" && form.min !== "" ? Number(form.min) : null,
          max: form.type === "number" && form.max !== "" ? Number(form.max) : null,
        });
        showToast("Field created!");
      }
      setMode("list");
      await loadFieldDefinitions();
      onFieldsChanged();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Failed to save field";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (def: QuestionFieldDefinition) => {
    try {
      await adminService.toggleQuestionFieldDefinition(def._id);
      showToast(def.isActive ? "Field deactivated" : "Field activated");
      await loadFieldDefinitions();
      onFieldsChanged();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to update field", "error");
    }
  };

  const handleDelete = async (def: QuestionFieldDefinition) => {
    if (!window.confirm(`Delete "${def.label}"? This cannot be undone.`)) return;
    try {
      await adminService.deleteQuestionFieldDefinition(def._id);
      showToast("Field deleted!");
      await loadFieldDefinitions();
      onFieldsChanged();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Delete failed";
      showToast(msg, "error");
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "list" ? "Manage Custom Question Fields" : editingId ? "Edit Field" : "Add New Field"}
      maxWidth="max-w-2xl"
    >
      {mode === "list" ? (
        <div className="space-y-5">
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
              Built-in Fields — already on every question
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUILT_IN_FIELDS.map((f) => (
                <span
                  key={f.key}
                  title={f.key}
                  className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-600"
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Custom Fields</p>
              <p className="text-[11px] text-slate-500 font-medium">
                Fields you add here appear automatically on the Add/Edit Question forms.
              </p>
            </div>
            <button
              onClick={openCreateForm}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <IconPlus className="w-3.5 h-3.5" /><span>Add Field</span>
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center"><Spinner className="w-6 h-6 text-indigo-600 mx-auto" /></div>
          ) : fieldDefinitions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 font-semibold bg-slate-50 rounded-2xl border border-slate-200">
              No custom fields yet. Click &quot;Add Field&quot; to create one.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {[...fieldDefinitions].sort((a, b) => a.order - b.order).map((def) => (
                <div key={def._id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">{def.label}</span>
                      <span className="text-[10px] font-mono text-slate-400">{def.key}</span>
                      <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                        {TYPE_LABELS[def.type]}
                      </span>
                      {def.required && (
                        <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-amber-50 text-amber-700 border-amber-200">Required</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(def)}
                    className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase cursor-pointer transition-all ${
                      def.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {def.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => openEditForm(def)}
                    className="shrink-0 p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <IconEdit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(def)}
                    className="shrink-0 p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-xl transition-all cursor-pointer"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Label *</label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Sub Topic"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Key {editingId ? "" : "*"}</label>
              <input
                type="text"
                required
                disabled={Boolean(editingId)}
                value={form.key}
                onChange={(e) => { setKeyTouched(true); setForm((f) => ({ ...f, key: e.target.value })); }}
                placeholder="e.g. subTopic"
                className={`${inputClass} ${editingId ? "opacity-60 cursor-not-allowed" : ""} font-mono`}
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {editingId ? "Key can't be changed after creation." : "Auto-filled from label. Lowercase, letters/numbers only."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Field Type {editingId ? "" : "*"}</label>
              <select
                disabled={Boolean(editingId)}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as QuestionFieldType }))}
                className={`${selectClass} ${editingId ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {(Object.keys(TYPE_LABELS) as QuestionFieldType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              {editingId && <p className="text-[10px] text-slate-400 font-medium mt-1">Type can&apos;t be changed after creation.</p>}
            </div>
            <div>
              <label className={labelClass}>Display Order</label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
          </div>

          {form.type === "select" && (
            <div>
              <label className={labelClass}>Dropdown Options *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionDraft}
                  onChange={(e) => setOptionDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                  placeholder="Type an option and press Enter"
                  className={inputClass}
                />
                <button type="button" onClick={addOption} className="shrink-0 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold cursor-pointer">
                  Add
                </button>
              </div>
              {form.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.options.map((opt) => (
                    <span key={opt} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                      {opt}
                      <button type="button" onClick={() => removeOption(opt)} className="p-0.5 hover:bg-slate-300 rounded-full cursor-pointer">
                        <IconCross className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.type === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Min (optional)</label>
                <input type="number" value={form.min} onChange={(e) => setForm((f) => ({ ...f, min: e.target.value === "" ? "" : Number(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max (optional)</label>
                <input type="number" value={form.max} onChange={(e) => setForm((f) => ({ ...f, max: e.target.value === "" ? "" : Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Help Text (optional)</label>
            <textarea
              rows={2}
              value={form.helpText}
              onChange={(e) => setForm((f) => ({ ...f, helpText: e.target.value }))}
              placeholder="Shown under the field on the Add/Edit Question form"
              className={`${inputClass} p-3 resize-none`}
            />
          </div>

          {form.type !== "boolean" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span className="text-xs font-semibold text-slate-700">Required field</span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setMode("list")} className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {submitting ? <Spinner className="w-4 h-4 text-white" /> : editingId ? "Save Changes" : "Create Field"}
            </button>
          </div>
        </form>
      )}
    </CommonModal>
  );
}
