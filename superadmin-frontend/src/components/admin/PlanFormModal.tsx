"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CommonModal, Spinner, IconPlus, IconTrash, IconInfo } from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import {
  adminService,
  type PlanOverviewRow,
  type PlanFormPayload,
  type PlanProgramType,
} from "../../services/apiServices";

interface Props {
  isOpen: boolean;
  mode: "create" | "edit";
  plan: PlanOverviewRow | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

type Billing = "one_time" | "annual" | "custom";

const PROGRAM_OPTIONS = [
  { value: "", label: "No class level" },
  { value: "class_xi", label: "Class XI" },
  { value: "class_xii", label: "Class XII" },
  { value: "dropper", label: "Dropper / Repeater" },
];

const slugPreview = (name: string) =>
  "plan-" +
  (name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plan");

const num = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function PlanFormModal({ isOpen, mode, plan, onClose, onSuccess, showToast }: Props) {
  const [name, setName] = useState("");
  const [priceRupees, setPriceRupees] = useState("0");
  const [billing, setBilling] = useState<Billing>("annual");
  const [customDays, setCustomDays] = useState("365");
  const [testsIncluded, setTestsIncluded] = useState("0");
  const [programType, setProgramType] = useState<string>("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [minor, setMinor] = useState("0");
  const [semiMajor, setSemiMajor] = useState("0");
  const [major, setMajor] = useState("0");
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const isTrial = mode === "edit" && plan?.isTrial;

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && plan) {
      setName(plan.name);
      setPriceRupees(String(plan.priceRupees));
      setBilling(plan.durationDays == null ? "one_time" : plan.durationDays === 365 ? "annual" : "custom");
      setCustomDays(String(plan.durationDays ?? 365));
      setTestsIncluded(String(plan.testsIncluded));
      setProgramType(plan.programType || "");
      setTagline(plan.tagline || "");
      setDescription(plan.description || "");
      setFeatures(plan.features?.length ? [...plan.features] : []);
      setMinor(String(plan.examBreakdown?.minor ?? 0));
      setSemiMajor(String(plan.examBreakdown?.semiMajor ?? 0));
      setMajor(String(plan.examBreakdown?.major ?? 0));
      setFeatured(Boolean(plan.featured));
      setSortOrder(String(plan.sortOrder ?? 0));
    } else {
      setName(""); setPriceRupees("0"); setBilling("annual"); setCustomDays("365");
      setTestsIncluded("0"); setProgramType(""); setTagline(""); setDescription("");
      setFeatures([]); setMinor("0"); setSemiMajor("0"); setMajor("0");
      setFeatured(false); setSortOrder("0");
    }
    setSubmitting(false);
  }, [isOpen, mode, plan]);

  const durationDays = useMemo<number | null>(() => {
    if (billing === "one_time") return null;
    if (billing === "annual") return 365;
    return Math.max(1, num(customDays, 365));
  }, [billing, customDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return showToast("Plan name must be at least 2 characters.", "error");
    const price = num(priceRupees);
    if (price < 0) return showToast("Price can't be negative.", "error");

    const payload: PlanFormPayload = {
      name: trimmed,
      priceRupees: isTrial ? 0 : price,
      durationDays,
      testsIncluded: Math.max(0, num(testsIncluded)),
      description: description.trim(),
      programType: (programType || null) as PlanProgramType,
      tagline: tagline.trim(),
      features: features.map((f) => f.trim()).filter(Boolean),
      examBreakdown: {
        minor: Math.max(0, num(minor)),
        semiMajor: Math.max(0, num(semiMajor)),
        major: Math.max(0, num(major)),
      },
      featured,
      sortOrder: Math.max(0, num(sortOrder)),
    };

    setSubmitting(true);
    try {
      if (mode === "edit" && plan?._id) {
        await adminService.updatePlan(plan._id, payload);
        showToast("Plan updated.", "success");
      } else {
        await adminService.createPlan({ ...payload, batchMode: "create" });
        showToast("Plan created — its batch is ready in the Batches tab.", "success");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data?.errors?.[0] ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Couldn't save the plan.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const L = "text-[11px] font-extrabold uppercase tracking-wide text-slate-600 block mb-1";
  const I =
    "w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold";

  return (
    <CommonModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "edit" ? `Edit plan — ${plan?.name || ""}` : "Create a new plan"}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
        {isTrial && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] font-semibold text-amber-800">
            <IconInfo className="w-4 h-4 shrink-0 mt-0.5" />
            <span>The free Trial is required by the platform — its price stays ₹0 and it can&apos;t be deactivated or deleted.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={L}>Plan name *</label>
            <input className={I} required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Core, Class 11 Foundation…" />
          </div>

          <div>
            <label className={L}>Price (₹) {isTrial && "· locked"}</label>
            <input className={I} type="number" min={0} disabled={Boolean(isTrial)} value={isTrial ? "0" : priceRupees} onChange={(e) => setPriceRupees(e.target.value)} />
          </div>
          <div>
            <label className={L}>Tests included</label>
            <input className={I} type="number" min={0} value={testsIncluded} onChange={(e) => setTestsIncluded(e.target.value)} />
          </div>

          <div>
            <label className={L}>Billing</label>
            <CustomSelect
              value={billing}
              onChange={(v) => setBilling(v as Billing)}
              options={[
                { value: "annual", label: "Yearly (365 days)" },
                { value: "one_time", label: "One-time (never expires)" },
                { value: "custom", label: "Custom duration" },
              ]}
            />
          </div>
          {billing === "custom" && (
            <div>
              <label className={L}>Duration (days)</label>
              <input className={I} type="number" min={1} value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            </div>
          )}

          <div>
            <label className={L}>Class level</label>
            <CustomSelect value={programType} onChange={setProgramType} options={PROGRAM_OPTIONS} />
          </div>
          <div>
            <label className={L}>Pricing-page order</label>
            <input className={I} type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className={L}>Tagline</label>
            <input className={I} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Build the strongest base." />
          </div>
          <div className="sm:col-span-2">
            <label className={L}>Description</label>
            <textarea rows={2} className={`${I} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Exam breakdown */}
        <div>
          <label className={L}>Test breakdown (shown on the pricing card)</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Minor", minor, setMinor],
              ["Semi Major", semiMajor, setSemiMajor],
              ["Major", major, setMajor],
            ].map(([label, val, setter]) => (
              <div key={label as string}>
                <input
                  className={I}
                  type="number"
                  min={0}
                  value={val as string}
                  onChange={(e) => (setter as (s: string) => void)(e.target.value)}
                />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1 text-center">{label as string}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <label className={L}>Feature bullets (pricing card)</label>
          <div className="space-y-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={I}
                  value={f}
                  onChange={(e) => setFeatures((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder="e.g. Detailed Analytics for Every Test"
                />
                <button
                  type="button"
                  onClick={() => setFeatures((arr) => arr.filter((_, j) => j !== i))}
                  className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer shrink-0"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFeatures((arr) => [...arr, ""])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" /> Add feature
            </button>
            <p className="text-[10px] text-slate-400 font-semibold">Leave empty to use the standard SIGNATURE feature list.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          Highlight this plan on the pricing page
        </label>

        {/* Batch note */}
        <div className="flex items-start gap-2 rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-[11px] font-semibold text-indigo-800">
          <IconInfo className="w-4 h-4 shrink-0 mt-0.5" />
          {mode === "edit" ? (
            <span>Students who buy this plan join <b>{plan?.batchName || plan?.batchSlug}</b>. Assign its tests from the Exams tab (pick it as the Audience).</span>
          ) : (
            <span>A public batch <b>{name.trim() || "…"}</b> (<code>{slugPreview(name)}</code>) will be created automatically. Buyers of this plan land in it; then you assign exams to that batch.</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            {submitting ? <Spinner className="w-4 h-4 text-white" /> : mode === "edit" ? "Save changes" : "Create plan"}
          </button>
        </div>
      </form>
    </CommonModal>
  );
}
