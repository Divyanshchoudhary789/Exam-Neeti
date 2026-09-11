"use client";

import React, { useState, useRef, useEffect } from "react";
import { IconCheck, IconChevronDown } from "./UIComponents";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Shows a filter input at the top of the panel — for long option lists (e.g. chapters/topics). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown under the search box (or in place of the list) when it filters/starts to zero options. */
  emptyMessage?: string;
  disabled?: boolean;
  /**
   * Opt-in: when `value` doesn't match any option, show the raw `value`
   * itself (in amber) instead of falling back to `placeholder`. Default
   * false — every OTHER existing caller of this shared dropdown relies on
   * "unmatched value -> placeholder" reading as "nothing selected" (e.g. a
   * stale batch ObjectId or a syllabus chapter renamed after a sprint was
   * created), and would look broken if a raw id/string suddenly appeared.
   * Only turn this on where showing that raw text is actually useful — e.g.
   * a chapter/topic field the bulk-upload syllabus matcher couldn't
   * confidently reconcile, where the admin needs to SEE the stored value to
   * fix it.
   */
  showUnmatchedValue?: boolean;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select option",
  className = "",
  buttonClassName = "",
  icon: Icon,
  searchable = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No matches found.",
  disabled = false,
  showUnmatchedValue = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOpt = options.find((o) => o.value === value);
  const showRaw = !selectedOpt && showUnmatchedValue && Boolean(value);
  const displayLabel = selectedOpt ? selectedOpt.label : showRaw ? value : placeholder;

  const closeDropdown = () => { setIsOpen(false); setSearch(""); };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) searchInputRef.current?.focus();
  }, [isOpen, searchable]);

  const filteredOptions = searchable && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className={`relative ${isOpen ? "z-50" : "z-10"} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : setIsOpen(true))}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
          <span className={`truncate ${showRaw ? "text-amber-600" : ""}`}>{displayLabel}</span>
        </div>
        <IconChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-indigo-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-1.5 space-y-0.5 min-w-[220px]">
          {searchable && (
            <div className="p-1 pb-1.5 sticky top-0 bg-white">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 font-semibold text-center">{emptyMessage}</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      closeDropdown();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white font-bold shadow-xs"
                        : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <IconCheck className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
