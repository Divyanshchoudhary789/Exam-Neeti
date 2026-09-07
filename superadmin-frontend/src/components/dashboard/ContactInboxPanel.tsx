"use client";

import React, { useCallback, useEffect, useState } from "react";
import { contactService, type ContactMessage } from "../../services/apiServices";
import {
  IconMail, IconSearch, IconTrash, IconClock, IconCheck, IconArrowRight,
  CardSkeleton, PaginationControls, CustomSelectMenu,
} from "../common/UIComponents";
import { formatRelativeTime } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "new", label: "New" },
  { id: "read", label: "Read" },
  { id: "replied", label: "Replied" },
  { id: "archived", label: "Archived" },
];

const STATUS_STYLE: Record<string, string> = {
  new: "bg-indigo-50 text-indigo-700 border-indigo-200",
  read: "bg-slate-100 text-slate-600 border-slate-200",
  replied: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
};

export function ContactInboxPanel({ showToast }: Props) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; status?: string; reason?: string; search?: string } = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (reasonFilter) params.reason = reasonFilter;
      if (search.trim()) params.search = search.trim();
      const res = await contactService.list(params);
      if (res?.success && res?.data) {
        setMessages(res.data.messages || []);
        setUnread(res.data.unread || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || 0);
      }
    } catch {
      showToast("Failed to load contact messages", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, reasonFilter, search]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (m: ContactMessage, status: ContactMessage["status"]) => {
    try {
      await contactService.setStatus(m._id, status);
      showToast(`Marked ${status}`);
      load();
    } catch (e: unknown) {
      showToast((e as { message?: string }).message || "Update failed", "error");
    }
  };

  const del = async (m: ContactMessage) => {
    if (!window.confirm(`Delete the message from ${m.name}?`)) return;
    try {
      await contactService.remove(m._id);
      showToast("Message deleted");
      load();
    } catch (e: unknown) {
      showToast((e as { message?: string }).message || "Delete failed", "error");
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Support Inbox
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">{unread} new</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 font-semibold">Messages sent from the website contact form. Each one also emails the support address.</p>
        </div>
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
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, text…"
              className="w-56 pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" />
          </div>
          <CustomSelectMenu
            value={reasonFilter}
            onChange={(v) => { setReasonFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All topics" },
              { value: "Student Support", label: "Student Support" },
              { value: "Institute Partnership", label: "Institute Partnership" },
              { value: "Demo Request", label: "Demo Request" },
              { value: "Billing", label: "Billing" },
              { value: "Other", label: "Other" },
            ]}
            icon={IconMail}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : messages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-xs text-slate-500 font-semibold space-y-2">
          <IconMail className="w-8 h-8 mx-auto text-slate-300" />
          <p>No messages{statusFilter ? ` marked "${statusFilter}"` : " yet"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m._id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{m.name}</span>
                    <a href={`mailto:${m.email}`} className="text-xs font-semibold text-indigo-600 hover:underline">{m.email}</a>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${STATUS_STYLE[m.status] || STATUS_STYLE.read}`}>{m.status}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">{m.reason}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                    <IconClock className="w-3 h-3" /> {formatRelativeTime(m.createdAt)}
                    {m.handledBy?.email && <span className="ml-1">· handled by {m.handledBy.email}</span>}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3">{m.message}</p>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <a href={`mailto:${m.email}?subject=Re: your message to Exam Neeti (${m.reason})`}
                  onClick={() => { if (m.status === "new" || m.status === "read") setStatus(m, "replied"); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors">
                  Reply by email <IconArrowRight className="w-3.5 h-3.5" />
                </a>
                {m.status !== "read" && m.status !== "replied" && (
                  <button onClick={() => setStatus(m, "read")} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors">Mark read</button>
                )}
                {m.status !== "replied" && (
                  <button onClick={() => setStatus(m, "replied")} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer transition-colors">
                    <IconCheck className="w-3.5 h-3.5" /> Replied
                  </button>
                )}
                {m.status !== "archived" && (
                  <button onClick={() => setStatus(m, "archived")} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors">Archive</button>
                )}
                <button onClick={() => del(m)} className="ml-auto p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors" title="Delete">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls currentPage={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
    </div>
  );
}
