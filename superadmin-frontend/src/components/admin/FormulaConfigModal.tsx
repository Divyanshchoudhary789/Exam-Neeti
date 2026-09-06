"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner, IconRefresh } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface FormulaConfigModalProps {
  isOpen: boolean;
  sprintId: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

interface FieldDef {
  key: string;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  default: number;
  suffix?: string;
}

interface GroupDef {
  metricKey: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

// This mirrors the exact keys the analytics engine reads at runtime — see the
// `DEFAULTS` blocks in backend/services/analytics.service.js and
// backend/services/advancedAnalytics.service.js. Editing anything outside this
// list would be saved to the database but silently ignored by the engine, so
// every field here corresponds 1:1 to a real formula parameter.
const FIELD_GROUPS: GroupDef[] = [
  {
    metricKey: "scoring_marks",
    label: "Scoring",
    description: "Marks awarded/deducted per question — drives the exam score and every marks-based metric.",
    fields: [
      { key: "correct_marks", label: "Marks per correct answer", help: "Awarded for each correct response.", min: 1, max: 10, step: 1, default: 4 },
      { key: "incorrect_marks", label: "Marks per incorrect answer", help: "Negative marking — enter as a negative number.", min: -10, max: 0, step: 0.25, default: -1 },
    ],
  },
  {
    metricKey: "topic_thresholds",
    label: "Topic Strength Thresholds",
    description: "Where a topic's accuracy crosses over into \"weak\" or \"strong\" across the analytics views.",
    fields: [
      { key: "weak_topic_accuracy_threshold", label: "Weak topic threshold", help: "Accuracy below this marks a topic weak.", min: 0, max: 100, step: 5, default: 40, suffix: "%" },
      { key: "strong_topic_accuracy_threshold", label: "Strong topic threshold", help: "Accuracy at/above this marks a topic strong.", min: 0, max: 100, step: 5, default: 80, suffix: "%" },
    ],
  },
  {
    metricKey: "error_detection",
    label: "Guess & Error Detection",
    description: "Confidence and timing cutoffs used to classify a wrong answer as a guess, silly mistake, or concept error.",
    fields: [
      { key: "guess_attempt_time_threshold_seconds", label: "Guess time cutoff", help: "Attempted+wrong answers faster than this count toward Guess Rate.", min: 1, max: 60, step: 1, default: 5, suffix: "s" },
      { key: "guess_confidence_threshold", label: "Guess confidence cutoff", help: "Below this confidence, a fast answer is classified as a guess.", min: 0, max: 100, step: 5, default: 50, suffix: "%" },
      { key: "guess_time_factor", label: "Guess speed factor", help: "\"Fast\" = time spent below this × your average time per question.", min: 0.1, max: 1, step: 0.05, default: 0.6, suffix: "×" },
      { key: "silly_mistake_confidence_threshold", label: "Silly mistake confidence cutoff", help: "High confidence AND still wrong, above this, counts as a silly mistake.", min: 0, max: 100, step: 5, default: 80, suffix: "%" },
      { key: "concept_error_confidence_min", label: "Concept error confidence — min", help: "Lower bound of the mid-confidence band for concept errors.", min: 0, max: 100, step: 5, default: 50, suffix: "%" },
      { key: "concept_error_confidence_max", label: "Concept error confidence — max", help: "Upper bound of the mid-confidence band for concept errors.", min: 0, max: 100, step: 5, default: 80, suffix: "%" },
    ],
  },
  {
    metricKey: "recoverable_marks",
    label: "Recoverable Marks",
    description: "How the \"marks you could still recover\" estimate is weighted.",
    fields: [
      { key: "recoverable_incorrect_easy_weight", label: "Wrong-easy recovery weight", help: "Multiplier on marks lost to wrong easy questions.", min: 0, max: 2, step: 0.1, default: 1.0, suffix: "×" },
      { key: "recoverable_negative_weight", label: "Negative-marking recovery weight", help: "Multiplier on marks lost to negative marking.", min: 0, max: 2, step: 0.1, default: 1.0, suffix: "×" },
      { key: "high_roi_min_marks", label: "High-value question threshold", help: "Unattempted questions worth at least this many marks count as missed high-value opportunities.", min: 1, max: 10, step: 1, default: 4, suffix: "marks" },
    ],
  },
  {
    metricKey: "roi_metrics",
    label: "ROI Classification & Penalties",
    description: "Questions are classified High / Medium / Low ROI RELATIVE to the rest of the same test (ROI = expected marks per minute). By default the top 25% by ROI are 'high', the middle 50% 'medium', the bottom 25% 'low'. These percentile cutoffs, plus how much each avoidable mistake counts against the Opportunity Index, are tuned here.",
    fields: [
      { key: "roi_high_percentile", label: "High-ROI percentile", help: "Questions in the top (100 − this)% of the test by ROI are classified high-ROI.", min: 50, max: 95, step: 5, default: 75, suffix: "th %ile" },
      { key: "roi_low_percentile", label: "Low-ROI percentile", help: "Questions in the bottom this% of the test by ROI are classified low-ROI.", min: 5, max: 50, step: 5, default: 25, suffix: "th %ile" },
      { key: "silly_mistake_reward", label: "Silly mistake penalty", help: "Opportunity Index points per silly mistake.", min: 0, max: 20, step: 1, default: 5 },
      { key: "high_roi_skip_penalty", label: "High-ROI skip penalty", help: "Opportunity Index points per skipped high-value question.", min: 0, max: 20, step: 1, default: 4 },
      { key: "low_roi_wrong_penalty", label: "Low-ROI wrong penalty", help: "Opportunity Index points per wrong low-value question.", min: 0, max: 20, step: 1, default: 1 },
      { key: "guess_penalty", label: "Guessing penalty", help: "Opportunity Index points per wrong guess.", min: 0, max: 20, step: 1, default: 1 },
    ],
  },
  {
    metricKey: "fatigue_curve",
    label: "Fatigue Curve",
    description: "How the rolling-accuracy fatigue curve is windowed and what counts as a critical drop or a recovery.",
    fields: [
      { key: "rolling_window_size", label: "Rolling window size", help: "Number of consecutive questions averaged per fatigue-curve point.", min: 3, max: 15, step: 1, default: 5, suffix: "Qs" },
      { key: "critical_accuracy_threshold", label: "Critical accuracy threshold", help: "A rolling window below this accuracy counts as a critical drop.", min: 0, max: 100, step: 5, default: 40, suffix: "%" },
      { key: "recovery_accuracy_threshold", label: "Recovery accuracy threshold", help: "Accuracy needed to count as recovered after a critical drop.", min: 0, max: 100, step: 5, default: 60, suffix: "%" },
    ],
  },
  {
    metricKey: "order_quality",
    label: "Attempt Order Priority Weights",
    description: "How much ROI, easy-question bonus, and raw marks each count toward a question's \"ideal priority\" when scoring attempt order quality (Spearman ρ). These three should sum to 1.0.",
    fields: [
      { key: "order_weight_roi", label: "ROI weight", help: "Weight on expected marks-per-minute.", min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: "order_weight_easy", label: "Easy-question weight", help: "Weight on the quick-win bonus for easy questions.", min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: "order_weight_marks", label: "Marks weight", help: "Weight on raw marks available for the question.", min: 0, max: 1, step: 0.05, default: 0.2 },
      { key: "order_min_sequenced", label: "Minimum sequenced questions", help: "Below this many ordered questions, order quality isn't computed.", min: 3, max: 20, step: 1, default: 5, suffix: "Qs" },
    ],
  },
  {
    metricKey: "display_counts",
    label: "Display Counts",
    description: "How many questions are listed in the fastest/slowest breakdown shown to students.",
    fields: [
      { key: "top_fastest_count", label: "Fastest questions shown", help: "", min: 1, max: 20, step: 1, default: 5, suffix: "Qs" },
      { key: "top_slowest_count", label: "Slowest questions shown", help: "", min: 1, max: 20, step: 1, default: 5, suffix: "Qs" },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);
const defaultValues = (): Record<string, number> =>
  Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f.default]));

export function FormulaConfigModal({
  isOpen,
  sprintId,
  onClose,
  showToast,
}: FormulaConfigModalProps) {
  const [values, setValues] = useState<Record<string, number>>(defaultValues());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(FIELD_GROUPS[0].metricKey);

  useEffect(() => {
    if (isOpen && sprintId) {
      const fetchConfig = async () => {
        setLoading(true);
        setValues(defaultValues());
        try {
          const res = await adminService.getFormulaConfigBySprint(sprintId);
          const rawConfigs =
            res?.data?.configs || res?.configs || res?.data?.formulaConfig || res?.formulaConfig || res?.data || [];
          const configsList = Array.isArray(rawConfigs) ? rawConfigs : [rawConfigs];

          setValues((prev) => {
            const next = { ...prev };
            for (const config of configsList as Record<string, unknown>[]) {
              const p = (config?.params || {}) as Record<string, unknown>;
              for (const [key, val] of Object.entries(p)) {
                if (val !== undefined && val !== null && Number.isFinite(Number(val))) {
                  next[key] = Number(val);
                }
              }
            }
            return next;
          });
        } catch {
          // Keep defaults if no config saved yet for this sprint
        } finally {
          setLoading(false);
        }
      };
      fetchConfig();
    }
  }, [isOpen, sprintId]);

  const setField = (key: string, val: number) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const orderWeightSum =
    (values.order_weight_roi ?? 0) + (values.order_weight_easy ?? 0) + (values.order_weight_marks ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintId) {
      showToast("Select a sprint first", "error");
      return;
    }
    if (Math.abs(orderWeightSum - 1.0) > 0.05) {
      showToast(`Attempt order priority weights must sum to 1.0 (current: ${orderWeightSum.toFixed(2)})`, "error");
      setOpenGroup("order_quality");
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        FIELD_GROUPS.map((group) =>
          adminService.updateFormulaConfig({
            sprintId,
            metricKey: group.metricKey,
            label: group.label,
            description: group.description,
            params: Object.fromEntries(group.fields.map((f) => [f.key, values[f.key] ?? f.default])),
          })
        )
      );

      showToast("Formula configuration updated — takes effect on the next submitted attempt.", "success");
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: string[] } }; message?: string })?.response
          ?.data?.errors?.join(", ") ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Failed to update formula configuration";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Analytics Formula Configuration"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-slate-800">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            These are the exact parameters the analytics engine reads for this sprint — every value below
            directly changes how scores, accuracy classifications, ROI, and fatigue metrics are computed for
            students in this sprint. Unsaved groups keep using the defaults shown.
          </p>
          <button
            type="button"
            onClick={() => setValues(defaultValues())}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <IconRefresh className="w-3.5 h-3.5" />Reset all
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center space-y-2">
            <Spinner className="w-6 h-6 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading formula config...</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {FIELD_GROUPS.map((group) => {
              const isOpenGroup = openGroup === group.metricKey;
              return (
                <div key={group.metricKey} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(isOpenGroup ? null : group.metricKey)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">{group.label}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5 line-clamp-1">{group.description}</p>
                    </div>
                    <span className={`shrink-0 text-slate-400 transition-transform ${isOpenGroup ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>

                  {isOpenGroup && (
                    <div className="px-4 py-3.5 space-y-3 border-t border-slate-100">
                      <p className="text-[10.5px] text-slate-500 leading-relaxed">{group.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.fields.map((f) => (
                          <div key={f.key}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="text-[11px] font-bold text-slate-700">{f.label}</label>
                              <span className="text-[11px] font-black text-indigo-600 tabular-nums shrink-0">
                                {values[f.key] ?? f.default}{f.suffix ? ` ${f.suffix}` : ""}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              value={values[f.key] ?? f.default}
                              onChange={(e) => setField(f.key, Number(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer"
                            />
                            {f.help && <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{f.help}</p>}
                          </div>
                        ))}
                      </div>

                      {group.metricKey === "order_quality" && (
                        <div className="p-2.5 rounded-xl bg-slate-100 flex justify-between items-center text-[11px] font-extrabold">
                          <span>ROI + Easy + Marks weight sum:</span>
                          <span className={Math.abs(orderWeightSum - 1) <= 0.05 ? "text-emerald-600" : "text-amber-600"}>
                            {orderWeightSum.toFixed(2)} / 1.00
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Formula Config"}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
