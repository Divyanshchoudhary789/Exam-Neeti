"use client";

import React from "react";
import type { QuestionFieldDefinition, CustomFieldValues, CustomFieldValue } from "../../types/questionFields";

interface DynamicCustomFieldsSectionProps {
  fieldDefinitions: QuestionFieldDefinition[];
  values: CustomFieldValues;
  onChange: (key: string, value: CustomFieldValue) => void;
}

const inputClass =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-medium";
const selectClass =
  "w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none font-semibold cursor-pointer";
const labelClass = "text-[10px] font-extrabold uppercase text-slate-500 block mb-1";

/**
 * Renders one input per active QuestionFieldDefinition, styled identically
 * to the built-in Question fields. Shared by the Add Question form
 * (QuestionBankPanel.tsx) and the Edit Question form (EditQuestionModal.tsx)
 * so admin-defined fields behave the same in both places.
 */
export function DynamicCustomFieldsSection({ fieldDefinitions, values, onChange }: DynamicCustomFieldsSectionProps) {
  if (fieldDefinitions.length === 0) return null;

  const sorted = [...fieldDefinitions].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3 pt-3 border-t border-slate-200">
      <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Additional Fields</p>
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((def) => {
          const value = values[def.key];

          if (def.type === "textarea") {
            return (
              <div key={def.key} className="col-span-2">
                <label className={labelClass}>{def.label}{def.required ? " *" : ""}</label>
                <textarea
                  rows={2}
                  required={def.required}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange(def.key, e.target.value)}
                  className={`${inputClass} p-3 resize-none`}
                />
                {def.helpText && <p className="text-[10px] text-slate-400 font-medium mt-1">{def.helpText}</p>}
              </div>
            );
          }

          if (def.type === "select") {
            return (
              <div key={def.key}>
                <label className={labelClass}>{def.label}{def.required ? " *" : ""}</label>
                <select
                  required={def.required}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange(def.key, e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select...</option>
                  {(def.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {def.helpText && <p className="text-[10px] text-slate-400 font-medium mt-1">{def.helpText}</p>}
              </div>
            );
          }

          if (def.type === "boolean") {
            return (
              <div key={def.key} className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => onChange(def.key, e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-xs font-semibold text-slate-700">{def.label}</span>
                </label>
              </div>
            );
          }

          if (def.type === "number") {
            return (
              <div key={def.key}>
                <label className={labelClass}>{def.label}{def.required ? " *" : ""}</label>
                <input
                  type="number"
                  required={def.required}
                  min={def.min ?? undefined}
                  max={def.max ?? undefined}
                  value={typeof value === "number" ? value : (typeof value === "string" ? value : "")}
                  onChange={(e) => onChange(def.key, e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputClass}
                />
                {def.helpText && <p className="text-[10px] text-slate-400 font-medium mt-1">{def.helpText}</p>}
              </div>
            );
          }

          // text (default)
          return (
            <div key={def.key}>
              <label className={labelClass}>{def.label}{def.required ? " *" : ""}</label>
              <input
                type="text"
                required={def.required}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(def.key, e.target.value)}
                className={inputClass}
              />
              {def.helpText && <p className="text-[10px] text-slate-400 font-medium mt-1">{def.helpText}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
