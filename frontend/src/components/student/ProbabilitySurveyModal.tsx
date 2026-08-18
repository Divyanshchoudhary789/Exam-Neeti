"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner, IconCheck, IconBook, IconChevronDown } from "../common/UIComponents";
import { studentService } from "../../services/apiServices";

type QLevel = "never_studied" | "started" | "can_solve_basic" | "comfortable" | "can_explain";
type SubjectKey = "physics" | "chemistry" | "biology";

interface ChapterEntry {
  subject: SubjectKey;
  chapter: string;
  level: QLevel;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: unknown) => void;
  sprintId: string;
  initialData?: Record<string, unknown> | null;
}

const LEVEL_OPTIONS: { value: QLevel; label: string; description: string; color: string }[] = [
  { value: "never_studied",   label: "Not Started",      description: "Haven't begun studying this yet",         color: "bg-red-50 border-red-200 text-red-700" },
  { value: "started",         label: "Started",          description: "Read some topics, basics covered",        color: "bg-orange-50 border-orange-200 text-orange-700" },
  { value: "can_solve_basic", label: "Basic Proficiency",description: "Can solve straightforward NEET problems",  color: "bg-amber-50 border-amber-200 text-amber-700" },
  { value: "comfortable",     label: "Comfortable",      description: "Confident with most question types",      color: "bg-teal-50 border-teal-200 text-teal-700" },
  { value: "can_explain",     label: "Mastered",         description: "Can explain concepts and solve advanced", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
];

const SUBJECT_CHAPTERS: Record<SubjectKey, string[]> = {
  physics: [
    "Physical World & Measurement", "Kinematics", "Laws of Motion", "Work, Energy and Power",
    "Motion of System of Particles & Rigid Body", "Gravitation", "Properties of Bulk Matter",
    "Thermodynamics", "Behaviour of Perfect Gas and Kinetic Theory", "Oscillations & Waves",
    "Electrostatics", "Current Electricity", "Magnetic Effects of Current & Magnetism",
    "Electromagnetic Induction & Alternating Currents", "Electromagnetic Waves",
    "Optics", "Dual Nature of Matter and Radiation", "Atoms & Nuclei", "Electronic Devices",
  ],
  chemistry: [
    "Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements",
    "Chemical Bonding and Molecular Structure", "States of Matter", "Thermodynamics",
    "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block Elements", "p-Block Elements",
    "Organic Chemistry – Basic Principles", "Hydrocarbons", "Environmental Chemistry",
    "Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry",
    "General Principles and Processes of Isolation of Elements", "d & f Block Elements",
    "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers",
    "Aldehydes, Ketones and Carboxylic Acids", "Organic Compounds Containing Nitrogen",
    "Biomolecules", "Polymers", "Chemistry in Everyday Life",
  ],
  biology: [
    "The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom",
    "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals",
    "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division",
    "Transport in Plants", "Mineral Nutrition", "Photosynthesis in Higher Plants",
    "Respiration in Plants", "Plant Growth and Development",
    "Digestion and Absorption", "Breathing and Exchange of Gases", "Body Fluids and Circulation",
    "Excretory Products and their Elimination", "Locomotion and Movement",
    "Neural Control and Coordination", "Chemical Coordination and Integration",
    "Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction",
    "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance",
    "Evolution", "Human Health and Disease", "Strategies for Enhancement in Food Production",
    "Microbes in Human Welfare", "Biotechnology: Principles and Processes",
    "Biotechnology and its Applications", "Organisms and Populations", "Ecosystem",
    "Biodiversity and Conservation", "Environmental Issues",
  ],
};

const SUBJECT_COLORS: Record<SubjectKey, string> = {
  physics:   "text-indigo-600 bg-indigo-50 border-indigo-200",
  chemistry: "text-violet-600 bg-violet-50 border-violet-200",
  biology:   "text-teal-600 bg-teal-50 border-teal-200",
};

export function ProbabilitySurveyModal({ isOpen, onClose, onSuccess, sprintId, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSubject, setActiveSubject] = useState<SubjectKey>("physics");
  const [chapterLevels, setChapterLevels] = useState<Record<string, QLevel>>({});
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // On open, reset state & pre-fill saved chapter assessments
  useEffect(() => {
    if (isOpen) {
      setError("");
      setActiveSubject("physics");
      setExpandedChapter(null);

      const initialLevels: Record<string, QLevel> = {};
      if (initialData && Array.isArray(initialData.chapters)) {
        const savedChapters = initialData.chapters as Array<{ subject?: string; chapter?: string; questionnaireLevel?: QLevel }>;
        (Object.keys(SUBJECT_CHAPTERS) as SubjectKey[]).forEach(sKey => {
          SUBJECT_CHAPTERS[sKey].forEach(chName => {
            const match = savedChapters.find(
              sc => String(sc.subject || "").toLowerCase() === sKey.toLowerCase() &&
                    String(sc.chapter || "").toLowerCase() === chName.toLowerCase()
            );
            if (match && match.questionnaireLevel) {
              initialLevels[`${sKey}__${chName}`] = match.questionnaireLevel;
            }
          });
        });
      }
      setChapterLevels(initialLevels);
    }
  }, [isOpen, initialData]);

  const setLevel = (subject: SubjectKey, chapter: string, level: QLevel) => {
    setChapterLevels(prev => ({ ...prev, [`${subject}__${chapter}`]: level }));
  };

  const getLevel = (subject: SubjectKey, chapter: string): QLevel | null => {
    return chapterLevels[`${subject}__${chapter}`] || null;
  };

  const totalChapters = Object.values(SUBJECT_CHAPTERS).flat().length;
  const filledChapters = Object.keys(chapterLevels).length;
  const progressPct = Math.round((filledChapters / totalChapters) * 100);

  const handleSubmit = async () => {
    if (filledChapters === 0) {
      setError("Please assess at least one chapter before submitting.");
      return;
    }

    setLoading(true);
    setError("");

    const chapters: ChapterEntry[] = [];
    (Object.keys(SUBJECT_CHAPTERS) as SubjectKey[]).forEach(subject => {
      SUBJECT_CHAPTERS[subject].forEach(chapter => {
        const key = `${subject}__${chapter}`;
        if (chapterLevels[key]) {
          chapters.push({ subject, chapter, level: chapterLevels[key] });
        }
      });
    });

    try {
      const res = await studentService.submitProbabilityQuestionnaire({ sprintId, chapters });
      onSuccess(res?.data || res);
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(errorObj?.response?.data?.message || errorObj?.message || "Failed to submit assessment.");
    } finally {
      setLoading(false);
    }
  };

  const subjects: SubjectKey[] = ["physics", "chemistry", "biology"];

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title="NEET Chapter Readiness Assessment" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Rate your preparation level for each chapter. This calibrates your NEET selection probability score.
          </p>
          {/* Progress */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {filledChapters} of {totalChapters} chapters assessed
            </span>
            <span className="text-[10px] font-extrabold text-indigo-600">{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Subject Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {subjects.map(sub => {
            const filled = SUBJECT_CHAPTERS[sub].filter(ch => chapterLevels[`${sub}__${ch}`]).length;
            const total  = SUBJECT_CHAPTERS[sub].length;
            const isActive = activeSubject === sub;
            return (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span className="capitalize">{sub}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {filled}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Level Legend */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LEVEL_OPTIONS.map(opt => (
            <span key={opt.value} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${opt.color}`}>
              {opt.label}
            </span>
          ))}
        </div>

        {/* Chapters for active subject */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {SUBJECT_CHAPTERS[activeSubject].map(chapter => {
            const selected  = getLevel(activeSubject, chapter);
            const levelMeta = LEVEL_OPTIONS.find(l => l.value === selected);
            const isExpanded = expandedChapter === `${activeSubject}__${chapter}`;

            return (
              <div key={chapter} className={`rounded-xl border transition-all ${selected ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50/50"}`}>
                <button
                  onClick={() => setExpandedChapter(isExpanded ? null : `${activeSubject}__${chapter}`)}
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {selected ? (
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${levelMeta?.color || ""}`}>
                        <IconCheck className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-200 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-slate-800 truncate">{chapter}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selected && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${levelMeta?.color || ""}`}>
                        {levelMeta?.label}
                      </span>
                    )}
                    <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {LEVEL_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setLevel(activeSubject, chapter, opt.value);
                          setExpandedChapter(null);
                        }}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selected === opt.value
                            ? opt.color + " shadow-sm"
                            : "bg-white border-slate-100 hover:border-slate-200 text-slate-700"
                        }`}
                      >
                        {selected === opt.value && <IconCheck className="w-3.5 h-3.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold truncate">{opt.label}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{opt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-3 mt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || filledChapters === 0}
            className="w-full sm:w-auto min-w-0 sm:min-w-[220px] px-5 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {loading ? (
              <Spinner className="w-4 h-4 text-white" />
            ) : (
              <>
                <IconBook className="w-4 h-4 shrink-0 text-indigo-100" />
                <span>Submit Assessment</span>
                <span className="text-[11px] font-semibold opacity-90 bg-white/15 px-2 py-0.5 rounded-md shrink-0">
                  {filledChapters} {filledChapters === 1 ? "chapter" : "chapters"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </CommonModal>
  );
}
