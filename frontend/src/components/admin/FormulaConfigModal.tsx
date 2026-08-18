"use client";

import React, { useState, useEffect } from "react";
import { CommonModal, Spinner } from "../common/UIComponents";
import { adminService } from "../../services/apiServices";

interface FormulaConfigModalProps {
  isOpen: boolean;
  sprintId: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function FormulaConfigModal({
  isOpen,
  sprintId,
  onClose,
  showToast,
}: FormulaConfigModalProps) {
  const [accuracyWeight, setAccuracyWeight] = useState(0.4);
  const [speedWeight, setSpeedWeight] = useState(0.3);
  const [consistencyWeight, setConsistencyWeight] = useState(0.3);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && sprintId) {
      const fetchConfig = async () => {
        setLoading(true);
        try {
          const res = await adminService.getFormulaConfigBySprint(sprintId);
          const rawConfigs =
            res?.data?.configs || res?.configs || res?.data?.formulaConfig || res?.formulaConfig || res?.data || [];
          const configsList = Array.isArray(rawConfigs) ? rawConfigs : [rawConfigs];
          const config =
            configsList.find((c: Record<string, unknown>) => c.metricKey === "scoring_formula_weights") ||
            configsList[0];

          if (config) {
            const p = (config.params || config.weights || {}) as Record<string, unknown>;
            if (p.accuracy !== undefined && p.accuracy !== null) setAccuracyWeight(Number(p.accuracy));
            if (p.speed !== undefined && p.speed !== null) setSpeedWeight(Number(p.speed));
            if (p.consistency !== undefined && p.consistency !== null) setConsistencyWeight(Number(p.consistency));
          }
        } catch {
          // Keep defaults if no config yet
        } finally {
          setLoading(false);
        }
      };
      fetchConfig();
    }
  }, [isOpen, sprintId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintId) {
      showToast("Select a sprint first", "error");
      return;
    }

    const total = accuracyWeight + speedWeight + consistencyWeight;
    if (Math.abs(total - 1.0) > 0.05) {
      showToast(`Formula weights must sum up to 1.0 (Current sum: ${total.toFixed(2)})`, "error");
      return;
    }

    setSubmitting(true);
    try {
      await adminService.updateFormulaConfig({
        sprintId,
        metricKey: "scoring_formula_weights",
        label: "Sprint Scoring Formula Weights",
        description: "Weights for accuracy, speed, and consistency used in sprint performance calculations",
        params: {
          accuracy: accuracyWeight,
          speed: speedWeight,
          consistency: consistencyWeight,
        },
      });

      showToast("Scoring formula weights updated successfully!", "success");
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: string[] } }; message?: string })?.response
          ?.data?.errors?.join(", ") ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string }).message ||
        "Failed to update formula weights";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tune Sprint Scoring Formula Weights"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Adjust the weighting parameters used by the analytics engine for evaluating overall student performance in this sprint.
        </p>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <Spinner className="w-6 h-6 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading formula config...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Accuracy Weight</span>
                <span>{(accuracyWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={accuracyWeight}
                onChange={(e) => setAccuracyWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Speed / Time Management Weight</span>
                <span>{(speedWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={speedWeight}
                onChange={(e) => setSpeedWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Consistency Weight</span>
                <span>{(consistencyWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={consistencyWeight}
                onChange={(e) => setConsistencyWeight(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-100 flex justify-between items-center text-xs font-extrabold">
              <span>Total Weight Sum:</span>
              <span className={(accuracyWeight + speedWeight + consistencyWeight).toFixed(2) === "1.00" ? "text-emerald-600" : "text-amber-600"}>
                {(accuracyWeight + speedWeight + consistencyWeight).toFixed(2)} / 1.00
              </span>
            </div>
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
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Formula"}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
