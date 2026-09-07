"use client";

import React, { useCallback, useEffect, useState } from "react";
import { newsletterService, type Subscriber } from "../../services/apiServices";
import {
  IconMail, IconSearch, IconTrash, IconClock, IconDownload,
  CardSkeleton, PaginationControls, CustomSelectMenu,
} from "../common/UIComponents";
import { formatRelativeTime } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "active", label: "Active" },
  { id: "unsubscribed", label: "Unsubscribed" },
];

const SOURCE_LABEL: Record<string, string> = {
  contact_section: "Contact page",
  footer: "Site footer",
  other: "Other",
};

export function SubscribersPanel({ showToast }: Props) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; status?: string; source?: string; search?: string } = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (search.trim()) params.search = search.trim();
      const res = await newsletterService.list(params);
      if (res?.success && res?.data) {
        setSubscribers(res.data.subscribers || []);
        setActive(res.data.active || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || 0);
      }
    } catch {
      showToast("Failed to load subscribers", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, sourceFilter, search]);

  useEffect(() => { load(); }, [load]);

  const del = async (s: Subscriber) => {
    if (!window.confirm(`Remove ${s.email} from the list?`)) return;
    try {
      await newsletterService.remove(s._id);
      showToast("Subscriber removed");
      load();
    } catch (e: unknown) {
      showToast((e as { message?: string }).message || "Delete failed", "error");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["email", "status", "source", "subscribed_at"],
      ...subscribers.map((s) => [s.email, s.status, s.source, s.createdAt]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Strategy Briefings Subscribers
            {active > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">{active} active</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 font-semibold">Email addresses that opted in to the newsletter from the website.</p>
        </div>
        <button onClick={exportCsv} disabled={!subscribers.length}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <IconDownload className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button key={t.id} onClick={() => { setStatusFilter(t.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search email…"
              className="w-52 pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" />
          </div>
          <CustomSelectMenu
            value={sourceFilter}
            onChange={(v) => { setSourceFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All sources" },
              { value: "contact_section", label: "Contact page" },
              { value: "footer", label: "Site footer" },
              { value: "other", label: "Other" },
            ]}
            icon={IconMail}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : subscribers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-xs text-slate-500 font-semibold space-y-2">
          <IconMail className="w-8 h-8 mx-auto text-slate-300" />
          <p>No subscribers{statusFilter ? ` (${statusFilter})` : " yet"}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm divide-y divide-slate-100">
          {subscribers.map((s) => (
            <div key={s._id} className="flex flex-wrap items-center gap-3 p-3.5 sm:px-5">
              <a href={`mailto:${s.email}`} className="text-xs font-bold text-indigo-600 hover:underline min-w-0 truncate">{s.email}</a>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${s.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>{s.status}</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{SOURCE_LABEL[s.source] || s.source}</span>
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <IconClock className="w-3 h-3" /> {formatRelativeTime(s.createdAt)}
              </span>
              <button onClick={() => del(s)} className="ml-auto p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors" title="Remove">
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PaginationControls currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </div>
  );
}
