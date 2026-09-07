"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  revenueService,
  type RevenueOverview,
  type RevenueTrendPoint,
  type RevenueByPlanRow,
  type RevenueTransaction,
} from "../../services/apiServices";
import {
  IconChart, IconUsers, IconRocket, IconDownload, IconRefresh, IconSearch,
  IconTrendingUp, IconClock, IconLayers, IconCalendar,
  CardSkeleton, PaginationControls, CustomSelectMenu, Spinner,
} from "../common/UIComponents";
import { AreaLineChart, DonutChart } from "../common/Charts";
import { formatRelativeTime } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
}

// ─── Money formatting (Indian conventions) ──────────────────────────────────
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const inrExact = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inrCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  created: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  created: "Pending",
  failed: "Failed",
};

const PLAN_DONUT_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

// ─── Stat card — local, denser variant tuned for financial figures ──────────
function StatCard({
  label, value, sub, icon: Icon, tone = "indigo", trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
  trend?: { value: number; label: string };
}) {
  const toneMap: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    rose: "bg-rose-50 border-rose-100 text-rose-600",
    slate: "bg-slate-100 border-slate-200 text-slate-600",
  };
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
          <h4 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums truncate">{value}</h4>
          {sub && <p className="text-[11px] text-slate-500 font-semibold mt-0.5 line-clamp-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border shrink-0 ${toneMap[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold">
          <span
            className={
              trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-rose-600" : "text-slate-400"
            }
          >
            {trend.value > 0 ? "▲" : trend.value < 0 ? "▼" : "—"} {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-slate-400 font-semibold">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export function RevenuePanel({ showToast }: Props) {
  // ── Summary state ──────────────────────────────────────────────────────
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [timeseries, setTimeseries] = useState<RevenueTrendPoint[]>([]);
  const [byPlan, setByPlan] = useState<RevenueByPlanRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [trendMetric, setTrendMetric] = useState<"revenue" | "orders">("revenue");

  // ── Ledger state ──────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [filteredTotals, setFilteredTotals] = useState<{ paidRevenue: number; paidCount: number }>({
    paidRevenue: 0, paidCount: 0,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await revenueService.summary({ months });
      if (res?.success && res.data) {
        setOverview(res.data.overview);
        setTimeseries(res.data.timeseries || []);
        setByPlan(res.data.byPlan || []);
      }
    } catch {
      showToast("Failed to load revenue summary", "error");
    } finally {
      setSummaryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await revenueService.transactions({
        page,
        limit: 20,
        status: statusFilter || undefined,
        planId: planFilter || undefined,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res?.success && res.data) {
        setTransactions(res.data.transactions || []);
        setFilteredTotals(res.data.filteredTotals || { paidRevenue: 0, paidCount: 0 });
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || 0);
      }
    } catch {
      showToast("Failed to load transactions", "error");
    } finally {
      setTxLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, planFilter, search, dateFrom, dateTo]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [statusFilter, planFilter, search, dateFrom, dateTo]);

  const planOptions = useMemo(
    () => [
      { value: "", label: "All plans" },
      ...byPlan.map((p) => ({ value: p.planId, label: p.name })),
    ],
    [byPlan]
  );

  const trendChartData = useMemo(
    () =>
      timeseries.map((t) => ({
        label: t.label,
        value: trendMetric === "revenue" ? t.revenue : t.orders,
        detail:
          trendMetric === "revenue"
            ? `${inr(t.revenue)} · ${t.orders} order${t.orders !== 1 ? "s" : ""}`
            : `${t.orders} order${t.orders !== 1 ? "s" : ""} · ${inr(t.revenue)}`,
      })),
    [timeseries, trendMetric]
  );

  const paidPlans = useMemo(
    () => byPlan.filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue),
    [byPlan]
  );

  const donutData = useMemo(
    () =>
      paidPlans.slice(0, 7).map((p, i) => ({
        label: p.name,
        value: p.revenue,
        color: PLAN_DONUT_COLORS[i % PLAN_DONUT_COLORS.length],
      })),
    [paidPlans]
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      // Pull every matching row (cap at 5000) so the export is the full ledger,
      // not just the visible page.
      const res = await revenueService.transactions({
        page: 1,
        limit: 2000,
        status: statusFilter || undefined,
        planId: planFilter || undefined,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const rows = res?.data?.transactions || [];
      const header = ["Created", "Paid At", "Student", "Email", "Plan", "Amount (INR)", "Status", "Razorpay Order", "Razorpay Payment"];
      const body = rows.map((t) => [
        new Date(t.createdAt).toISOString(),
        t.paidAt ? new Date(t.paidAt).toISOString() : "",
        t.student?.name || "",
        t.student?.email || "",
        t.plan?.name || "",
        t.amount.toFixed(2),
        t.status,
        t.razorpayOrderId,
        t.razorpayPaymentId || "",
      ]);
      const csv = [header, ...body]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam-neeti-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${rows.length} transaction${rows.length !== 1 ? "s" : ""}`);
    } catch {
      showToast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const anyFilter = statusFilter || planFilter || search.trim() || dateFrom || dateTo;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-dash-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Revenue &amp; Billing
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold uppercase tracking-wider">
              Root only
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            Live figures from Razorpay orders &amp; subscriptions — every number here is real payment data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <CustomSelectMenu
              value={String(months)}
              onChange={(v) => setMonths(Number(v))}
              options={[
                { value: "6", label: "Last 6 months" },
                { value: "12", label: "Last 12 months" },
                { value: "24", label: "Last 24 months" },
              ]}
              icon={IconCalendar}
            />
          </div>
          <button
            onClick={() => { loadSummary(); loadTransactions(); }}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-sm"
            title="Refresh"
          >
            <IconRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !overview ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-xs text-slate-500 font-semibold space-y-2">
          <IconChart className="w-8 h-8 mx-auto text-slate-300" />
          <p>No revenue data available.</p>
        </div>
      ) : (
        <>
          {/* ── Headline KPIs ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Lifetime revenue"
              value={inr(overview.lifetimeRevenue)}
              sub={overview.firstPaymentAt ? `Since ${new Date(overview.firstPaymentAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : "No payments yet"}
              icon={IconTrendingUp}
              tone="emerald"
            />
            <StatCard
              label="This month"
              value={inr(overview.revenueThisMonth)}
              sub={`${overview.ordersThisMonth} paid order${overview.ordersThisMonth !== 1 ? "s" : ""} · last month ${inrCompact(overview.revenueLastMonth)}`}
              icon={IconChart}
              tone="indigo"
              trend={{ value: overview.momChangePct, label: "vs last month" }}
            />
            <StatCard
              label="Paying customers"
              value={overview.payingCustomers.toLocaleString("en-IN")}
              sub={`${inr(overview.revenuePerCustomer)} avg per customer`}
              icon={IconUsers}
              tone="amber"
            />
            <StatCard
              label="Estimated MRR"
              value={inr(overview.estimatedMrr)}
              sub={`${overview.subscriptions.active} active subscription${overview.subscriptions.active !== 1 ? "s" : ""}`}
              icon={IconRocket}
              tone="indigo"
            />
            <StatCard
              label="Avg order value"
              value={inr(overview.averageOrderValue)}
              sub={`${overview.paidOrders} paid orders all-time`}
              icon={IconLayers}
              tone="slate"
            />
            <StatCard
              label="Checkout conversion"
              value={`${overview.checkoutConversionPct}%`}
              sub={`${overview.paidOrders} paid · ${overview.failedOrders} failed · ${overview.pendingOrders} pending`}
              icon={IconChart}
              tone={overview.checkoutConversionPct >= 60 ? "emerald" : overview.checkoutConversionPct >= 35 ? "amber" : "rose"}
            />
            <StatCard
              label="Trial → paid"
              value={`${overview.students.paidConversionPct}%`}
              sub={`${overview.students.paying} paying of ${overview.students.selfServe} self-serve`}
              icon={IconTrendingUp}
              tone={overview.students.paidConversionPct >= 15 ? "emerald" : "amber"}
            />
            <StatCard
              label="Students on trial"
              value={overview.students.onTrial.toLocaleString("en-IN")}
              sub={`${overview.subscriptions.trial} trial subs · ${overview.subscriptions.expired} expired`}
              icon={IconUsers}
              tone="slate"
            />
          </div>

          {/* ── Students split strip ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Student base</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { k: "Total students", v: overview.students.total },
                { k: "Active", v: overview.students.active },
                { k: "Self-serve", v: overview.students.selfServe },
                { k: "Paying now", v: overview.students.paying },
                { k: "On trial", v: overview.students.onTrial },
                { k: "Coaching", v: overview.students.coaching },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-lg font-black text-slate-900 tabular-nums">{s.v.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{s.k}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Trend + plan split ───────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-black text-slate-900">
                  {trendMetric === "revenue" ? "Monthly revenue" : "Monthly paid orders"}
                </p>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                  {(["revenue", "orders"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTrendMetric(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold capitalize transition-all cursor-pointer ${trendMetric === m ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <AreaLineChart
                data={trendChartData}
                height={220}
                valueFormatter={(v) => (trendMetric === "revenue" ? inrCompact(v) : `${Math.round(v)}`)}
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
              <p className="text-sm font-black text-slate-900 mb-3">Revenue by plan</p>
              {donutData.length ? (
                <DonutChart
                  data={donutData}
                  size={150}
                  centerLabel={inrCompact(overview.lifetimeRevenue)}
                  centerSublabel="lifetime"
                />
              ) : (
                <p className="text-xs text-slate-400 font-semibold py-8 text-center">No paid plans yet.</p>
              )}
            </div>
          </div>

          {/* ── Per-plan table ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-black text-slate-900">Plan performance</p>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/60">
                    <th className="px-4 sm:px-5 py-2.5">Plan</th>
                    <th className="px-3 py-2.5">Price</th>
                    <th className="px-3 py-2.5 text-right">Revenue</th>
                    <th className="px-3 py-2.5 w-40">Share</th>
                    <th className="px-3 py-2.5 text-right">Paid orders</th>
                    <th className="px-3 py-2.5 text-right">Customers</th>
                    <th className="px-3 py-2.5 text-right">Active subs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byPlan.map((p) => (
                    <tr key={p.planId} className="text-xs font-semibold text-slate-700 hover:bg-slate-50/60">
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{p.name}</span>
                          {p.isTrial && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase">Trial</span>}
                          {!p.isActive && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-black uppercase">Inactive</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-500">
                        {p.isFree ? "Free" : inr(p.priceRupees)}
                        {p.durationDays ? <span className="text-slate-400">{` / ${p.durationDays}d`}</span> : p.isFree ? "" : <span className="text-slate-400"> one-time</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-black text-slate-900">{inr(p.revenue)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, p.revenueShare)}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums text-slate-400 w-9 text-right">{p.revenueShare}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.paidOrders}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.customers}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.activeSubscriptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Transaction ledger ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Payment ledger</p>
            <p className="text-[11px] text-slate-500 font-semibold">
              {anyFilter
                ? `${filteredTotals.paidCount} paid · ${inr(filteredTotals.paidRevenue)} in this filter`
                : "Every Razorpay checkout — paid, pending and failed"}
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={exporting || !transactions.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {exporting ? <Spinner className="w-3.5 h-3.5 text-slate-500" /> : <IconDownload className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Student, email or Razorpay id…"
              className="w-64 pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>
          <div className="w-40">
            <CustomSelectMenu
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All statuses" },
                { value: "paid", label: "Paid" },
                { value: "created", label: "Pending" },
                { value: "failed", label: "Failed" },
              ]}
              icon={IconChart}
            />
          </div>
          <div className="w-44">
            <CustomSelectMenu
              value={planFilter}
              onChange={setPlanFilter}
              options={planOptions}
              icon={IconRocket}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </label>
          {anyFilter && (
            <button
              onClick={() => { setStatusFilter(""); setPlanFilter(""); setSearch(""); setDateFrom(""); setDateTo(""); }}
              className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {txLoading ? (
          <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 font-semibold space-y-2">
            <IconClock className="w-8 h-8 mx-auto text-slate-300" />
            <p>No transactions{anyFilter ? " match these filters" : " yet"}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left" style={{ minWidth: 760 }}>
              <thead>
                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-4 sm:px-5 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Plan</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Razorpay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t._id} className="text-xs font-semibold text-slate-700 hover:bg-slate-50/60">
                    <td className="px-4 sm:px-5 py-3 min-w-0">
                      <div className="font-black text-slate-900 truncate max-w-[180px]">{t.student?.name || "—"}</div>
                      <div className="text-[10px] text-slate-400 font-semibold truncate max-w-[180px]">{t.student?.email || ""}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{t.plan?.name || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-black text-slate-900">{inrExact(t.amount)}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${STATUS_STYLE[t.status] || STATUS_STYLE.created}`}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-500">
                      <div>{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <div className="text-[10px] text-slate-400">{formatRelativeTime(t.paidAt || t.createdAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]" title={t.razorpayOrderId}>{t.razorpayOrderId}</div>
                      {t.razorpayPaymentId && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]" title={t.razorpayPaymentId}>{t.razorpayPaymentId}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 sm:px-5 pb-4 pt-2">
          <PaginationControls currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
