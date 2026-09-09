"use client";

import React from "react";
import { CommonModal, IconCheck, IconBook, IconUsers, IconLayers } from "../common/UIComponents";
import type { PlanOverviewRow } from "../../services/apiServices";

interface Props {
  isOpen: boolean;
  plan: PlanOverviewRow | null;
  onClose: () => void;
  /** Jump to the Exams tab filtered to this plan's batch. */
  onViewExams?: (batchId: string) => void;
}

const PROGRAM_LABEL: Record<string, string> = {
  class_xi: "Class XI",
  class_xii: "Class XII",
  dropper: "Dropper / Repeater",
};

const inr = (n: number) => n.toLocaleString("en-IN");

/**
 * Read-only "everything about this plan" popup — opened from the View button on
 * a plan card. Surfaces the pricing the students see plus the test budget
 * (included vs already created vs still to build) so an admin knows exactly how
 * many exams this plan's batch still needs.
 */
export function PlanDetailModal({ isOpen, plan, onClose, onViewExams }: Props) {
  if (!plan) return null;

  const isAnnual = plan.durationDays != null && plan.durationDays >= 300;
  const perMonth = isAnnual ? Math.round(plan.priceRupees / 12) : null;
  const hasDiscount = plan.mrpRupees != null && plan.mrpRupees > plan.priceRupees;
  const pctOff = hasDiscount ? Math.round((1 - plan.priceRupees / plan.mrpRupees!) * 100) : null;
  const saving = hasDiscount ? plan.mrpRupees! - plan.priceRupees : 0;

  const included = plan.testsIncluded;
  const created = plan.examCount;
  const remaining = Math.max(0, included - created);
  const draft = Math.max(0, plan.examCount - plan.publishedCount);

  const bd = plan.examBreakdown || { minor: 0, semiMajor: 0, major: 0 };
  const hasBreakdown = bd.minor + bd.semiMajor + bd.major > 0;

  return (
    <CommonModal isOpen={isOpen} onClose={onClose} title={`Plan details — ${plan.name}`} maxWidth="max-w-2xl">
      <div className="space-y-5 text-slate-800">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
            plan.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            {plan.isActive ? "Active" : "Inactive"}
          </span>
          {plan.isFreeTier && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">Free tier</span>}
          {plan.featured && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">Featured</span>}
          {plan.programType && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{PROGRAM_LABEL[plan.programType] || plan.programType}</span>}
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono">{plan.key}</span>
        </div>

        {/* Pricing */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400">Pricing (what students see)</h4>
          {plan.isFreeTier ? (
            <p className="text-2xl font-black text-slate-900 mt-1.5">Free</p>
          ) : (
            <div className="mt-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-black text-slate-900">₹{inr(plan.priceRupees)}</span>
                <span className="text-xs font-semibold text-slate-500">
                  {isAnnual ? "per year" : plan.durationDays ? `for ${plan.durationDays} days` : "one-time"}
                </span>
                {perMonth != null && (
                  <span className="text-xs font-semibold text-indigo-600">≈ ₹{inr(perMonth)}/month</span>
                )}
              </div>
              {hasDiscount && (
                <p className="text-[11px] font-bold text-slate-500 mt-1.5">
                  <span className="line-through">₹{inr(plan.mrpRupees!)}</span>
                  <span className="ml-2 inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-rose-600">{pctOff}% OFF</span>
                  <span className="ml-2 text-emerald-600">saves ₹{inr(saving)}</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Test budget */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400">Test budget for this plan</h4>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Included" value={included} tone="slate" />
            <Stat label={`Created${draft ? ` (${draft} draft)` : ""}`} value={created} tone="indigo" />
            <Stat label="Left to add" value={remaining} tone={remaining === 0 && included > 0 ? "emerald" : "amber"} />
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-3">
            {included === 0
              ? "No test cap on this plan — students get every exam assigned to its batch."
              : remaining > 0
                ? `Create ${remaining} more exam${remaining === 1 ? "" : "s"} for the “${plan.batchName || plan.batchSlug}” batch to fully stock this plan.`
                : `All ${included} exams for this plan are already created.`}
          </p>
          {hasBreakdown && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Chip>{bd.minor} Minor</Chip>
              <Chip>{bd.semiMajor} Semi-Major</Chip>
              <Chip>{bd.major} Major</Chip>
              <Chip>{plan.publishedCount} published</Chip>
            </div>
          )}
        </section>

        {/* Access + audience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={IconBook} label="Access" value={plan.durationDays ? `${plan.durationDays}-day access` : "Never expires"} />
          <InfoRow icon={IconLayers} label="Batch" value={plan.batchName || plan.batchSlug} />
          <InfoRow icon={IconUsers} label="On this plan now" value={String(plan.studentCount)} />
          <InfoRow icon={IconUsers} label="Subscription records (all time)" value={String(plan.subscriberCount)} />
        </div>
        <p className="text-[10.5px] text-slate-400 font-semibold -mt-1">
          “On this plan now” = students whose batch is currently this plan&apos;s batch.
          “Subscription records” counts every Subscription ever written for this plan —
          {plan.isTrial ? " one per user who registered" : " one per purchase / renewal"} —
          including expired and cancelled ones, so it only goes up.
        </p>

        {/* Tagline / description */}
        {(plan.tagline || plan.description) && (
          <section className="text-xs text-slate-600 leading-relaxed">
            {plan.tagline && <p className="font-bold text-slate-800">{plan.tagline}</p>}
            {plan.description && <p className="mt-1">{plan.description}</p>}
          </section>
        )}

        {/* Features */}
        {plan.features?.length > 0 && (
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Feature bullets</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-xs text-slate-600">
                  <IconCheck className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">
            Close
          </button>
          {onViewExams && plan.batchId && (
            <button
              onClick={() => { onViewExams(plan.batchId!); onClose(); }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
            >
              View / add this plan&apos;s tests
            </button>
          )}
        </div>
      </div>
    </CommonModal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "slate" | "indigo" | "amber" | "emerald" }) {
  const toneCls = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 text-center ${toneCls}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wide mt-1 opacity-80 leading-tight">{label}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.FC<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xs font-bold text-slate-800 truncate">{value}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">{children}</span>
  );
}
