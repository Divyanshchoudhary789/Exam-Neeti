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

type OptionImages = Record<"A" | "B" | "C" | "D", File | null>;

function imgUrl(v: unknown): string | null {
  return (v as { url?: string } | undefined)?.url || null;
}

/**
 * Object-URL preview for a locally-selected (not-yet-uploaded) file, with
 * proper cleanup so the preview reflects a newly chosen file immediately —
 * without this, "Live Preview" could only ever show the OLD saved image,
 * never what the admin just picked in the file input.
 */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (files.length === 0) { setUrls([]); return; }
    const objectUrls = files.map((f) => URL.createObjectURL(f));
    setUrls(objectUrls);
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
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
  const [status, setStatus] = useState<"draft" | "active">("active");
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
  const [solutionImageFiles, setSolutionImageFiles] = useState<File[]>([]);
  const [optionImages, setOptionImages] = useState<OptionImages>({ A: null, B: null, C: null, D: null });
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const solFileInputRef = useRef<HTMLInputElement>(null);

  // Existing image URLs (for "already uploaded" previews) — read fresh from
  // questionData each render rather than mirrored into state, since they're
  // display-only and never edited directly (only replaced via file inputs).
  const existingQuestionImage = imgUrl(questionData?.questionImage);
  const existingSolutionImage = imgUrl((questionData?.solution as { image?: unknown } | undefined)?.image);
  const existingSolutionImages = (((questionData?.solution as { images?: unknown[] } | undefined)?.images) || [])
    .map((i) => imgUrl(i))
    .filter(Boolean) as string[];
  const existingOptionImages: Record<string, string | null> = {};
  (questionData?.options as Array<{ key: string; image?: unknown }> | undefined || []).forEach((o) => {
    existingOptionImages[String(o.key).toUpperCase()] = imgUrl(o.image);
  });

  const isDraft = String(questionData?.status || "active") === "draft";

  // Preview URLs — a newly-selected (not-yet-uploaded) file always wins over
  // the existing saved image, so the preview shows exactly what will be
  // saved on submit.
  const newQuestionImageUrl = useObjectUrl(imageFile);
  const newSolutionImageUrl = useObjectUrl(solutionImageFile);
  const newSolutionImageUrls = useObjectUrls(solutionImageFiles);
  const newOptionImageUrlA = useObjectUrl(optionImages.A);
  const newOptionImageUrlB = useObjectUrl(optionImages.B);
  const newOptionImageUrlC = useObjectUrl(optionImages.C);
  const newOptionImageUrlD = useObjectUrl(optionImages.D);

  const previewQuestionImage = newQuestionImageUrl || existingQuestionImage;
  const previewSolutionImage = newSolutionImageUrl || existingSolutionImage;
  const previewSolutionImages = newSolutionImageUrls.length > 0 ? newSolutionImageUrls : existingSolutionImages;
  const previewOptionImages: Record<"A" | "B" | "C" | "D", string | null> = {
    A: newOptionImageUrlA || existingOptionImages.A || null,
    B: newOptionImageUrlB || existingOptionImages.B || null,
    C: newOptionImageUrlC || existingOptionImages.C || null,
    D: newOptionImageUrlD || existingOptionImages.D || null,
  };

  useEffect(() => {
    if (questionData) {
      setSubject(String(questionData.subject || "Physics"));
      setClassLevel(String(questionData.classLevel || "XII"));
      setChapter(String(questionData.chapter || ""));
      setTopic(String(questionData.topic || ""));
      setDifficulty(String(questionData.difficulty || "Medium"));
      setStatus(String(questionData.status || "active") === "draft" ? "draft" : "active");
      setText(String(questionData.text || ""));
      setCorrectAnswer(String(questionData.correctAnswer || "A").toUpperCase());
      setMarks(Number(questionData.marks ?? 4));
      setNegativeMarks(Number(questionData.negativeMarks ?? 1));
      setHasLatex(Boolean(questionData.hasLatex));
      setImageFile(null);
      setSolutionImageFile(null);
      setSolutionImageFiles([]);
      setOptionImages({ A: null, B: null, C: null, D: null });

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
      fd.append("status", status);
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
      for (const f of solutionImageFiles) {
        fd.append("solutionImages", f);
      }
      (Object.keys(optionImages) as Array<keyof OptionImages>).forEach((k) => {
        const f = optionImages[k];
        if (f) fd.append(`optionImage_${k}`, f);
      });

      await adminService.updateQuestion(qId, fd);
      showToast(
        status === "active" && isDraft
          ? "Question reviewed and activated — it's now usable in exams!"
          : "Question updated successfully!",
        "success"
      );
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
        {isDraft && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-amber-100 text-amber-700 border-amber-300 shrink-0">Draft</span>
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              This question was bulk-uploaded and is not usable in exams yet. Add any missing images below, review the fields, then set Status to <b>Active</b> and save.
            </p>
          </div>
        )}

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
            <p className="text-[10px] font-black uppercase text-indigo-600">Question Preview</p>
            <div className="text-xs font-semibold text-slate-900 leading-relaxed">
              <MathRenderer text={text || "Enter question text to preview..."} />
            </div>
            {previewQuestionImage && (
              <img src={previewQuestionImage} alt="Question preview" className="max-h-40 rounded-xl border border-indigo-100 object-contain bg-white p-1" />
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100">
              {[
                { k: "A" as const, val: optA },
                { k: "B" as const, val: optB },
                { k: "C" as const, val: optC },
                { k: "D" as const, val: optD },
              ].map(({ k, val }) => {
                const correct = correctAnswer === k;
                return (
                  <div key={k} className={`p-2 rounded-lg border text-xs space-y-1.5 ${correct ? "bg-emerald-50 border-emerald-300" : "bg-white border-indigo-100"}`}>
                    <div className="flex items-center gap-1.5">
                      <b className={correct ? "text-emerald-700" : "text-indigo-600"}>{k}:</b>
                      <MathRenderer text={val || "—"} inline />
                      {correct && <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-auto" />}
                    </div>
                    {previewOptionImages[k] && (
                      <img src={previewOptionImages[k]!} alt={`Option ${k} preview`} className="h-16 rounded-lg border border-slate-200 object-contain bg-white" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-indigo-100 space-y-2">
              <p className="text-[10px] font-black uppercase text-indigo-600">Solution Preview</p>
              <div className="text-xs font-medium text-slate-800 leading-relaxed bg-white/70 p-3 rounded-xl border border-indigo-100">
                <MathRenderer text={solutionText || "No solution text entered yet..."} />
              </div>
              {previewSolutionImage && (
                <img src={previewSolutionImage} alt="Solution preview" className="max-h-40 rounded-xl border border-indigo-100 object-contain bg-white p-1" />
              )}
              {previewSolutionImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewSolutionImages.map((u, i) => (
                    <img key={i} src={u} alt={`Solution diagram ${i + 1} preview`} className="h-16 rounded-lg border border-indigo-100 object-contain bg-white" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active")}
              className={`w-full border text-xs px-3 py-2 rounded-xl focus:outline-none font-bold cursor-pointer ${status === "draft" ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-emerald-50 border-emerald-300 text-emerald-800"}`}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
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
            { k: "A" as const, val: optA, set: setOptA },
            { k: "B" as const, val: optB, set: setOptB },
            { k: "C" as const, val: optC, set: setOptC },
            { k: "D" as const, val: optD, set: setOptD },
          ].map(({ k, val, set }) => (
            <div key={k}>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Option {k}</label>
              <input
                type="text"
                required
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium mb-1.5"
              />
              {existingOptionImages[k] && (
                <img src={existingOptionImages[k]!} alt={`Option ${k}`} className="h-12 rounded-lg border border-slate-200 object-contain bg-white mb-1" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setOptionImages((prev) => ({ ...prev, [k]: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-600 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
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
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Question Image</label>
            {existingQuestionImage && (
              <img src={existingQuestionImage} alt="Question" className="h-16 rounded-lg border border-slate-200 object-contain bg-white mb-1.5" />
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1">{existingQuestionImage ? "Uploading replaces the current image." : "No image uploaded yet."}</p>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Solution Image</label>
            {existingSolutionImage && (
              <img src={existingSolutionImage} alt="Solution" className="h-16 rounded-lg border border-slate-200 object-contain bg-white mb-1.5" />
            )}
            <input
              type="file"
              ref={solFileInputRef}
              accept="image/*"
              onChange={(e) => setSolutionImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 font-medium mt-1">{existingSolutionImage ? "Uploading replaces the current image." : "No image uploaded yet."}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Additional Solution Diagrams (multiple, optional)</label>
          {existingSolutionImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {existingSolutionImages.map((u, i) => (
                <img key={i} src={u} alt={`Solution ${i + 1}`} className="h-14 rounded-lg border border-slate-200 object-contain bg-white" />
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setSolutionImageFiles(Array.from(e.target.files || []))}
            className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          />
          <p className="text-[10px] text-slate-400 font-medium mt-1">{existingSolutionImages.length > 0 ? "Uploading replaces ALL current additional diagrams." : "No additional diagrams uploaded yet."}</p>
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
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : status === "active" && isDraft ? "Save & Activate" : "Save Changes"}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
