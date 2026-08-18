"use client";

import React, { useState, useEffect, useRef } from "react";
import { CommonModal, Spinner, IconEye, IconCheck, IconCross } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";
import { MathRenderer } from "../common/MathRenderer";

interface EditQuestionModalProps {
  isOpen: boolean;
  questionData: Record<string, unknown> | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function EditQuestionModal({
  isOpen,
  questionData,
  onClose,
  onSuccess,
  showToast,
}: EditQuestionModalProps) {
  const [subject, setSubject] = useState("Physics");
  const [classLevel, setClassLevel] = useState("XII");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [text, setText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("A");
  const [marks, setMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);
  const [hasLatex, setHasLatex] = useState(false);
  const [solutionText, setSolutionText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [solutionImageFile, setSolutionImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const solFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (questionData) {
      setSubject(String(questionData.subject || "Physics"));
      setClassLevel(String(questionData.classLevel || "XII"));
      setChapter(String(questionData.chapter || ""));
      setTopic(String(questionData.topic || ""));
      setDifficulty(String(questionData.difficulty || "Medium"));
      setText(String(questionData.text || ""));
      setCorrectAnswer(String(questionData.correctAnswer || "A").toUpperCase());
      setMarks(Number(questionData.marks ?? 4));
      setNegativeMarks(Number(questionData.negativeMarks ?? 1));
      setHasLatex(Boolean(questionData.hasLatex));

      const sol = questionData.solution as { text?: string } | undefined;
      setSolutionText(sol?.text ? String(sol.text) : "");

      const opts = questionData.options as Array<{ key: string; text: string }> | undefined;
      if (Array.isArray(opts)) {
        opts.forEach((o) => {
          const k = String(o.key).toUpperCase();
          if (k === "A") setOptA(o.text || "");
          if (k === "B") setOptB(o.text || "");
          if (k === "C") setOptC(o.text || "");
          if (k === "D") setOptD(o.text || "");
        });
      }
    }
  }, [questionData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionData?._id && !questionData?.id) {
      showToast("Invalid question reference", "error");
      return;
    }

    const qId = String(questionData._id || questionData.id);
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("classLevel", classLevel);
      fd.append("chapter", chapter);
      if (topic) fd.append("topic", topic);
      fd.append("difficulty", difficulty);
      fd.append("text", text);
      fd.append(
        "options",
        JSON.stringify([
          { key: "A", text: optA },
          { key: "B", text: optB },
          { key: "C", text: optC },
          { key: "D", text: optD },
        ])
      );
      fd.append("correctAnswer", correctAnswer);
      fd.append("marks", String(marks));
      fd.append("negativeMarks", String(negativeMarks));
      fd.append("hasLatex", String(hasLatex));
      if (solutionText) {
        fd.append("solution", JSON.stringify({ text: solutionText, hasLatex }));
      }
      if (imageFile) {
        fd.append("questionImage", imageFile);
      }
      if (solutionImageFile) {
        fd.append("solutionImage", solutionImageFile);
      }

      await adminService.updateQuestion(qId, fd);
      showToast("Question updated successfully!", "success");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string }).message ||
        "Failed to update question";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Question"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">Question Editor</span>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-lg transition-all"
          >
            <IconEye className="w-3.5 h-3.5" />
            <span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
          </button>
        </div>

        {showPreview && (
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
            <p className="text-[10px] font-black uppercase text-indigo-600">Math & Text Preview</p>
            <div className="text-xs font-semibold text-slate-900 leading-relaxed">
              <MathRenderer text={text || "Enter question text to preview..."} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100">
              {[
                { k: "A", val: optA },
                { k: "B", val: optB },
                { k: "C", val: optC },
                { k: "D", val: optD },
              ].map(({ k, val }) => (
                <div key={k} className="p-2 bg-white rounded-lg border border-indigo-100 text-xs">
                  <b className="text-indigo-600 mr-2">{k}:</b>
                  <MathRenderer text={val || "—"} inline />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Class</label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer"
            >
              <option value="XI">Class XI</option>
              <option value="XII">Class XII</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Correct Answer</label>
            <select
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Chapter *</label>
            <input
              type="text"
              required
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium"
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Question Text *</label>
          <textarea
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-3 rounded-xl focus:outline-none font-medium resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "A", val: optA, set: setOptA },
            { k: "B", val: optB, set: setOptB },
            { k: "C", val: optC, set: setOptC },
            { k: "D", val: optD, set: setOptD },
          ].map(({ k, val, set }) => (
            <div key={k}>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Option {k}</label>
              <input
                type="text"
                required
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Solution Explanation (Optional)</label>
          <textarea
            rows={2}
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
            placeholder="Detailed step-by-step solution text..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs p-3 rounded-xl focus:outline-none font-medium resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Marks</label>
            <input
              type="number"
              min={1}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium"
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Neg. Marks</label>
            <input
              type="number"
              min={0}
              step={0.25}
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasLatex}
                onChange={(e) => setHasLatex(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span className="text-xs font-semibold text-slate-700">Has LaTeX</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Replace Question Image</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Replace Solution Image</label>
            <input
              type="file"
              ref={solFileInputRef}
              accept="image/*"
              onChange={(e) => setSolutionImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
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
