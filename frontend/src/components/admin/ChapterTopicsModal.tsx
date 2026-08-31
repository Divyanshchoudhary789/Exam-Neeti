"use client";

import React, { useState } from "react";
import { CommonModal, IconEdit, IconSearch, IconFileText, IconCheck, IconCross, IconPlus, IconTrash, IconLayers } from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";

export interface SubtopicItem {
  _id: string;
  name: string;
  weightage?: 1 | 2 | 3 | null;
}

export interface TopicItem {
  _id?: string;
  id?: string;
  topic?: string;
  name?: string;
  weight?: number;
  weightage?: number;
  topicWeightage?: 1 | 2 | 3 | null;
  subtopics?: SubtopicItem[];
  questionCount?: number;
  conceptCoverage?: number;
  unitCode?: string;
  isActive?: boolean;
  topicOrder?: number;
  chapterOrder?: number;
  subject?: string;
  classLevel?: string;
  chapter?: string;
}

export interface ChapterData {
  chapter?: string;
  name?: string;
  subject?: string;
  classLevel?: string;
  unitCode?: string;
  chapterWeightage?: 1 | 2 | 3 | null;
  topics?: TopicItem[];
}

// Weightage Framework — 1 (High) / 2 (Medium) / 3 (Low), same scale at
// chapter/topic/subtopic level. Taxonomy-only, never tagged on questions.
const WEIGHTAGE_LABELS: Record<number, string> = { 1: "High", 2: "Medium", 3: "Low" };
const WEIGHTAGE_COLORS: Record<number, string> = {
  1: "bg-red-50 text-red-700 border-red-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-slate-100 text-slate-600 border-slate-200",
};

function WeightageBadge({ value }: { value?: number | null }) {
  if (!value) {
    return <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-slate-50 text-slate-400 border-slate-200">Not set</span>;
  }
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${WEIGHTAGE_COLORS[value] || WEIGHTAGE_COLORS[2]}`}>
      {value} · {WEIGHTAGE_LABELS[value] || ""}
    </span>
  );
}

const WEIGHTAGE_SELECT_OPTIONS = [
  { value: "", label: "Weightage — not set" },
  { value: "1", label: "1 · High Priority" },
  { value: "2", label: "2 · Medium Priority" },
  { value: "3", label: "3 · Low Priority" },
];

/** Compact colour-coded CustomSelect for a 1/2/3 weightage value — used for
 *  topic/subtopic weightage so it visually matches the rest of the app's
 *  dropdowns instead of a raw browser `<select>`. */
function WeightageSelect({
  value,
  onChange,
  title,
}: {
  value?: 1 | 2 | 3 | null;
  onChange: (v: 1 | 2 | 3 | null) => void;
  title?: string;
}) {
  return (
    // No fixed width on mobile — a hardcoded px width doesn't shrink, which
    // is exactly what was forcing rows sideways on narrow real devices
    // (confirmed against production: long real topic names + this pill
    // together overflowed and the modal's body silently scrolled
    // horizontally instead of wrapping). `min-w-0` lets it shrink below its
    // content size when needed; CustomSelect's own label already truncates
    // with an ellipsis, so shrinking never clips it mid-character.
    <div title={title} className="min-w-0 flex-1 basis-[130px] sm:flex-none sm:basis-auto sm:w-[168px]">
      <CustomSelect
        value={value ? String(value) : ""}
        onChange={(val) => onChange(val ? (Number(val) as 1 | 2 | 3) : null)}
        options={WEIGHTAGE_SELECT_OPTIONS}
        buttonClassName={`!py-1.5 !px-2.5 !text-[10px] !rounded-lg ${value ? WEIGHTAGE_COLORS[value] : "!bg-slate-50 !text-slate-400 !border-slate-200"}`}
      />
    </div>
  );
}

interface ChapterTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterData: ChapterData | null;
  onUpdateTopicWeight?: (topicId: string, newWeight: number) => void;
  onAddTopicClick?: (chapter: string, subject: string, classLevel: string, unitCode: string) => void;
  onEditTopicClick?: (topic: TopicItem) => void;
  onDeleteTopicClick?: (topicId: string, topicName: string) => void;
  onToggleTopicActive?: (topicId: string) => void;
  onUpdateChapterWeightage?: (subject: string, classLevel: string, chapter: string, weightage: 1 | 2 | 3) => void;
  onUpdateTopicWeightage?: (topicId: string, weightage: 1 | 2 | 3 | null) => void;
  onAddSubtopic?: (topicId: string, name: string, weightage: 1 | 2 | 3 | null) => void;
  onUpdateSubtopic?: (topicId: string, subtopicId: string, data: { name?: string; weightage?: 1 | 2 | 3 | null }) => void;
  onDeleteSubtopic?: (topicId: string, subtopicId: string) => void;
}

export function ChapterTopicsModal({
  isOpen,
  onClose,
  chapterData,
  onUpdateTopicWeight,
  onAddTopicClick,
  onEditTopicClick,
  onDeleteTopicClick,
  onToggleTopicActive,
  onUpdateChapterWeightage,
  onUpdateTopicWeightage,
  onAddSubtopic,
  onUpdateSubtopic,
  onDeleteSubtopic,
}: ChapterTopicsModalProps) {
  const [topicSearch, setTopicSearch] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editWeightVal, setEditWeightVal] = useState<string>("");
  const [editingChapterWeightage, setEditingChapterWeightage] = useState(false);
  const [pendingChapterWeightage, setPendingChapterWeightage] = useState<string>("");
  const [expandedSubtopicsFor, setExpandedSubtopicsFor] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState("");
  const [newSubtopicWeightage, setNewSubtopicWeightage] = useState<string>("");

  if (!chapterData) return null;

  const chapterTitle = String(chapterData.chapter || chapterData.name || "Chapter Details");
  const subject = String(chapterData.subject || "General");
  const classLevel = chapterData.classLevel ? String(chapterData.classLevel) : "";
  const unitCode = chapterData.unitCode ? String(chapterData.unitCode) : "";
  const topicsList = (chapterData.topics || []) as TopicItem[];

  // Filter topics by topicSearch
  const filteredTopics = topicsList.filter((t) => {
    const name = String(t.topic || t.name || "").toLowerCase();
    return name.includes(topicSearch.toLowerCase().trim());
  });

  // Calculate stats
  const totalWeight = topicsList.reduce((acc, t) => acc + Number(t.weight ?? t.weightage ?? 1.0), 0);
  const avgWeight = topicsList.length > 0 ? (totalWeight / topicsList.length).toFixed(2) : "0";

  const handleSaveWeight = (topicId: string) => {
    const parsed = parseFloat(editWeightVal);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 10.0) {
      if (onUpdateTopicWeight) {
        onUpdateTopicWeight(topicId, parsed);
      }
      setEditingTopicId(null);
    } else {
      alert("Weight must be a number between 0.1 and 10.0");
    }
  };

  const subjBadges: Record<string, string> = {
    physics: "bg-indigo-50 text-indigo-700 border-indigo-200",
    chemistry: "bg-violet-50 text-violet-700 border-violet-200",
    biology: "bg-teal-50 text-teal-700 border-teal-200",
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Chapter Topics & Taxonomy Specification"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Header Badges & Chapter Title */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${
                  subjBadges[subject.toLowerCase()] || "bg-slate-100 text-slate-800 border-slate-200"
                }`}
              >
                {subject}
              </span>
              {classLevel && (
                <span className="px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-bold">
                  Class {classLevel}
                </span>
              )}
              {unitCode && (
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                  Unit {unitCode}
                </span>
              )}
            </div>

            {onAddTopicClick && (
              <button
                type="button"
                onClick={() => onAddTopicClick(chapterTitle, subject, classLevel, unitCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <IconPlus className="w-3.5 h-3.5" />
                <span>Add Topic to Chapter</span>
              </button>
            )}
          </div>

          <h3 className="text-lg font-black text-slate-900 leading-snug">{chapterTitle}</h3>

          {/* Chapter Weightage — applies to EVERY topic in this chapter at once (taxonomy-level, not per-question) */}
          {onUpdateChapterWeightage && (
            <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl bg-white border border-slate-200/70">
              <IconLayers className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-[10px] font-extrabold uppercase text-slate-500 shrink-0">Chapter Weightage</span>
              {editingChapterWeightage ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <WeightageSelect
                    value={(pendingChapterWeightage ? Number(pendingChapterWeightage) : chapterData.chapterWeightage) as 1 | 2 | 3 | null}
                    onChange={(v) => setPendingChapterWeightage(v ? String(v) : "")}
                  />
                  <button
                    type="button"
                    disabled={!pendingChapterWeightage}
                    onClick={() => {
                      onUpdateChapterWeightage(subject, classLevel, chapterTitle, Number(pendingChapterWeightage) as 1 | 2 | 3);
                      setEditingChapterWeightage(false);
                      setPendingChapterWeightage("");
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                    title={`Applies to all ${topicsList.length} topic(s) in this chapter`}
                  >
                    <IconCheck className="w-3 h-3" /> Apply to all {topicsList.length} topics
                  </button>
                  <button
                    onClick={() => { setEditingChapterWeightage(false); setPendingChapterWeightage(""); }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    <IconCross className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingChapterWeightage(true)}
                  className="flex items-center gap-1.5 cursor-pointer group"
                  title="Sets this for every topic in the chapter — click to change"
                >
                  <WeightageBadge value={chapterData.chapterWeightage} />
                  <IconEdit className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>
              )}
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 text-center">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Total Topics</span>
              <span className="text-sm font-black text-slate-900">{topicsList.length}</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Cumulative Weight</span>
              <span className="text-sm font-black text-indigo-600">{totalWeight.toFixed(1)}</span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Avg Topic Weight</span>
              <span className="text-sm font-black text-emerald-600">{avgWeight}</span>
            </div>
          </div>
        </div>

        {/* Search Bar inside Modal */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter topics in this chapter..."
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>
          {topicSearch && (
            <button
              onClick={() => setTopicSearch("")}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Topics List Table / Cards */}
        {filteredTopics.length > 0 ? (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredTopics.map((top, idx) => {
              const topId = String(top._id || top.id || idx);
              const topName = String(top.topic || top.name || `Topic ${idx + 1}`);
              const currentWeight = Number(top.weight ?? top.weightage ?? 1.0);
              const isEditingWeight = editingTopicId === topId;
              const isTopicActive = top.isActive !== false;

              const fullTopicItem: TopicItem = {
                ...top,
                _id: topId,
                topic: topName,
                chapter: chapterTitle,
                subject,
                classLevel,
                unitCode,
                weight: currentWeight,
                isActive: isTopicActive,
              };

              return (
                <React.Fragment key={topId}>
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isTopicActive
                      ? "bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-sm"
                      : "bg-slate-50 border-slate-200/60 opacity-75"
                  }`}
                >
                  {/* Row 1 — identity (left) + primary actions (right). Kept on
                      its own row, independent of how much secondary metadata
                      row 2 below carries, so a long title / inactive badge
                      never pushes into or overlaps the action buttons. */}
                  <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-900 leading-snug">{topName}</p>
                          {!isTopicActive && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">
                              Inactive / Omitted
                            </span>
                          )}
                        </div>
                        {top.questionCount !== undefined && (
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {top.questionCount} question{top.questionCount !== 1 ? "s" : ""} tagged
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Primary actions — always top-right, never reflows with row 2 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onToggleTopicActive && (
                        <button
                          type="button"
                          onClick={() => onToggleTopicActive(topId)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isTopicActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          }`}
                          title={isTopicActive ? "Click to deactivate topic" : "Click to activate topic"}
                        >
                          {isTopicActive ? "Active" : "Inactive"}
                        </button>
                      )}
                      {onEditTopicClick && (
                        <button
                          type="button"
                          onClick={() => onEditTopicClick(fullTopicItem)}
                          className="p-2 bg-slate-100 hover:bg-slate-800 text-slate-600 hover:text-white rounded-xl transition-all cursor-pointer"
                          title="Edit Full Topic Details"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteTopicClick && (
                        <button
                          type="button"
                          onClick={() => onDeleteTopicClick(topId, topName)}
                          className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-xl transition-all cursor-pointer"
                          title="Delete Topic"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 2 — secondary metadata: Weight, Topic Weightage, Subtopics.
                      Own row + top border, so it can wrap freely on narrow
                      screens without ever disturbing row 1's layout. */}
                  <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
                    {isEditingWeight ? (
                      <div className="flex items-center gap-1.5 bg-indigo-50 p-1.5 rounded-xl border border-indigo-200">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10.0"
                          value={editWeightVal}
                          onChange={(e) => setEditWeightVal(e.target.value)}
                          className="w-16 px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveWeight(topId)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                          title="Save Weight"
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTopicId(null)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <IconCross className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTopicId(topId);
                          setEditWeightVal(String(currentWeight));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        title="Coverage Weight — used only for the Weighted Coverage % analytics"
                      >
                        <span>Weight: <b className="text-indigo-600">{currentWeight}</b></span>
                        <IconEdit className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" />
                      </button>
                    )}

                    {onUpdateTopicWeightage && (
                      <WeightageSelect
                        value={top.topicWeightage}
                        onChange={(v) => onUpdateTopicWeightage(topId, v)}
                        title="Topic Weightage — taxonomy priority for test-generation strategy, separate from Weight"
                      />
                    )}

                    {(onAddSubtopic || (top.subtopics && top.subtopics.length > 0)) && (
                      <button
                        type="button"
                        onClick={() => setExpandedSubtopicsFor(expandedSubtopicsFor === topId ? null : topId)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          expandedSubtopicsFor === topId ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <IconLayers className="w-3 h-3" />
                        Subtopics ({(top.subtopics || []).length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtopics panel — admin-managed, each with its own 1-3 Weightage */}
                {expandedSubtopicsFor === topId && (
                  <div className="mt-2 ml-2 sm:ml-10 p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                    {(top.subtopics || []).length === 0 && (
                      <p className="text-[11px] text-slate-400 font-medium">No subtopics yet — add one below.</p>
                    )}
                    {(top.subtopics || []).map((sub) => (
                      <div key={sub._id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 flex-wrap sm:flex-nowrap">
                        <span className="flex-1 min-w-[100px] text-xs font-semibold text-slate-800">{sub.name}</span>
                        {onUpdateSubtopic ? (
                          <WeightageSelect value={sub.weightage} onChange={(v) => onUpdateSubtopic(topId, sub._id, { weightage: v })} />
                        ) : (
                          <WeightageBadge value={sub.weightage} />
                        )}
                        {onDeleteSubtopic && (
                          <button
                            type="button"
                            onClick={() => onDeleteSubtopic(topId, sub._id)}
                            className="p-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 rounded-lg transition-all cursor-pointer shrink-0"
                            title="Delete subtopic"
                          >
                            <IconTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}

                    {onAddSubtopic && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="New subtopic name..."
                          value={expandedSubtopicsFor === topId ? newSubtopicName : ""}
                          onChange={(e) => setNewSubtopicName(e.target.value)}
                          className="min-w-0 flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        {/* flex-wrap here is the safety net: an input element's
                            own default min-width plus a select plus a button
                            in ONE unwrapped row is exactly what forced the
                            whole modal body into silent horizontal scroll on
                            a real narrow device — confirmed against
                            production. */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <WeightageSelect
                            value={newSubtopicWeightage ? (Number(newSubtopicWeightage) as 1 | 2 | 3) : null}
                            onChange={(v) => setNewSubtopicWeightage(v ? String(v) : "")}
                          />
                          <button
                            type="button"
                            disabled={!newSubtopicName.trim()}
                            onClick={() => {
                              onAddSubtopic(topId, newSubtopicName.trim(), newSubtopicWeightage ? (Number(newSubtopicWeightage) as 1 | 2 | 3) : null);
                              setNewSubtopicName("");
                              setNewSubtopicWeightage("");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0"
                          >
                            <IconPlus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="py-12 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <IconFileText className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">No matching topics found</h4>
            <p className="text-[11px] text-slate-500 font-medium max-w-xs mx-auto">
              Try adjusting your search query to view topics in this chapter.
            </p>
          </div>
        )}
      </div>
    </CommonModal>
  );
}
