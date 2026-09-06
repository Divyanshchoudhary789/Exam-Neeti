"use client";

import React, { useCallback, useEffect, useState } from "react";
import { superAdminService } from "../../services/apiServices";
import {
  IconClock, IconDownload, IconRefresh, IconFilter, IconSearch, IconCross,
  IconChevronDown, IconCopy, IconCode, IconArrowRight,
  CardSkeleton, PaginationControls, CommonModal,
} from "../common/UIComponents";
import { type AuditLogItem, formatRelativeTime, getActionBadgeStyle } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
}

export function AuditTrailPanel({ showToast }: Props) {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTotalItems, setLogTotalItems] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logAdminIdFilter, setLogAdminIdFilter] = useState("");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");

  const [selectedLogMetadata, setSelectedLogMetadata] = useState<Record<string, unknown> | null>(null);
  const [selectedLogItem, setSelectedLogItem] = useState<AuditLogItem | null>(null);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: { page: number; limit: number; action?: string; adminId?: string; startDate?: string; endDate?: string } = {
        page: logPage, limit: 15,
      };
      if (logActionFilter.trim()) params.action = logActionFilter.trim();
      if (logAdminIdFilter.trim()) params.adminId = logAdminIdFilter.trim();
      if (logStartDate) params.startDate = logStartDate;
      if (logEndDate) params.endDate = logEndDate;

      const res = await superAdminService.getAuditLogs(params);
      if (res?.success && res?.data) {
        setAuditLogs(res.data.logs || []);
        setLogTotalPages(res.pagination?.totalPages || 1);
        setLogTotalItems(res.pagination?.total || 0);
      }
    } catch {
      showToast("Error loading platform audit logs", "error");
    } finally {
      setLogsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPage, logActionFilter, logAdminIdFilter, logStartDate, logEndDate]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleSetDatePreset = (preset: "today" | "7days" | "30days") => {
    const today = new Date();
    const endDateStr = today.toISOString().split("T")[0];
    const startDateObj = new Date();
    if (preset === "7days") startDateObj.setDate(today.getDate() - 7);
    else if (preset === "30days") startDateObj.setDate(today.getDate() - 30);
    setLogStartDate(startDateObj.toISOString().split("T")[0]);
    setLogEndDate(endDateStr);
    setLogPage(1);
  };

  const resetLogFilters = () => {
    setLogActionFilter(""); setLogAdminIdFilter(""); setLogStartDate(""); setLogEndDate(""); setLogPage(1);
  };

  const activeFiltersCount = [logActionFilter, logAdminIdFilter, logStartDate, logEndDate].filter(Boolean).length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  const handleExportAuditLogsCSV = () => {
    if (!auditLogs || auditLogs.length === 0) return;
    const headers = ["Log ID", "Timestamp", "Action", "Actor Name", "Actor Email", "Actor Role", "Target Name/Email", "Target ID", "IP Address", "User Agent", "Metadata JSON"];
    const rows = auditLogs.map((log) => [
      log._id,
      new Date(log.createdAt).toISOString(),
      log.action,
      log.actor?.name || "",
      log.actor?.email || "",
      log.actorRole || "",
      log.target?.name || log.target?.email || log.targetEmail || "",
      log.target?._id || "",
      log.ip || "",
      `"${(log.userAgent || "").replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `platform_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit logs exported to CSV successfully!", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"><IconClock className="w-5 h-5" /></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">Security &amp; Compliance</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live Audit Logging Active
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">Platform Audit Trail</h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Immutable append-only activity records capturing every high-privilege administrator action on Exam Neeti for compliance and governance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button onClick={() => loadLogs()} disabled={logsLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 text-xs font-bold transition-all cursor-pointer shadow-sm" title="Refresh Audit Logs">
              <IconRefresh className={`w-4 h-4 ${logsLoading ? "animate-spin text-indigo-300" : ""}`} /><span>Refresh</span>
            </button>
            <button onClick={handleExportAuditLogsCSV} disabled={auditLogs.length === 0} className="flex items-center gap-2 px-4.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <IconDownload className="w-4 h-4" /><span>Export CSV</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Activity Logs</div>
            <div className="text-lg sm:text-xl font-black text-white mt-1">{logTotalItems}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Page View Items</div>
            <div className="text-lg sm:text-xl font-black text-indigo-300 mt-1">{auditLogs.length} logs</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Filters</div>
            <div className="text-lg sm:text-xl font-black text-amber-300 mt-1">{activeFiltersCount === 0 ? "None" : `${activeFiltersCount} Active`}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tamper Resistance</div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">Immutable</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><IconFilter className="w-4 h-4" /></div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Audit Log Filter Engine</h3>
              <p className="text-[11px] font-medium text-slate-500">Filter by action type, admin actor/target name or email, or date range</p>
            </div>
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={resetLogFilters} className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer">
              <IconCross className="w-3.5 h-3.5" /><span>Clear All Filters ({activeFiltersCount})</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Action Type</label>
            <div className="relative">
              <select value={logActionFilter} onChange={(e) => { setLogActionFilter(e.target.value); setLogPage(1); }} className="w-full pl-3.5 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800 appearance-none cursor-pointer">
                <option value="">All Action Types</option>
                <option value="login">LOGIN / AUTH</option>
                <option value="admin_created">ADMIN_CREATED</option>
                <option value="admin_updated">ADMIN_UPDATED</option>
                <option value="admin_deactivated">ADMIN_DEACTIVATED</option>
                <option value="admin_reactivated">ADMIN_REACTIVATED</option>
                <option value="admin_deleted">ADMIN_DELETED</option>
                <option value="role_changed">ROLE_CHANGED</option>
                <option value="password_changed">PASSWORD_CHANGED</option>
                <option value="password_reset">PASSWORD_RESET</option>
                <option value="student_deactivated">STUDENT_DEACTIVATED</option>
                <option value="student_reactivated">STUDENT_REACTIVATED</option>
                <option value="student_deleted">STUDENT_DELETED</option>
                <option value="batch_deactivated">BATCH_DEACTIVATED</option>
                <option value="batch_reactivated">BATCH_REACTIVATED</option>
                <option value="batch_deleted">BATCH_DELETED</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><IconChevronDown className="w-4 h-4" /></div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Actor / Target Search</label>
            <div className="relative">
              <input type="text" placeholder="Search Actor / Target name, email or ID..." value={logAdminIdFilter} onChange={(e) => { setLogAdminIdFilter(e.target.value); setLogPage(1); }} className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800 placeholder:text-slate-400" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IconSearch className="w-4 h-4" /></div>
              {logAdminIdFilter && (
                <button onClick={() => { setLogAdminIdFilter(""); setLogPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer">
                  <IconCross className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Start Date</label>
            <input type="date" value={logStartDate} onChange={(e) => { setLogStartDate(e.target.value); setLogPage(1); }} className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">End Date</label>
            <input type="date" value={logEndDate} onChange={(e) => { setLogEndDate(e.target.value); setLogPage(1); }} className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
            <button onClick={() => handleSetDatePreset("today")} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer">Today</button>
            <button onClick={() => handleSetDatePreset("7days")} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer">Last 7 Days</button>
            <button onClick={() => handleSetDatePreset("30days")} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer">Last 30 Days</button>
            {(logStartDate || logEndDate) && (
              <button onClick={() => { setLogStartDate(""); setLogEndDate(""); setLogPage(1); }} className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer">Clear Dates</button>
            )}
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            Showing <span className="text-slate-800 font-extrabold">{auditLogs.length}</span> of <span className="text-slate-800 font-extrabold">{logTotalItems}</span> records
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {logsLoading ? (
          <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto"><IconFilter className="w-6 h-6" /></div>
            <h3 className="text-sm font-black text-slate-800">No audit logs matching filters</h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">No activity logs were found matching your current action type, actor search, or date range selection.</p>
            {activeFiltersCount > 0 && (
              <button onClick={resetLogFilters} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm">Reset All Filters</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {auditLogs.map((log) => {
              const badgeStyle = getActionBadgeStyle(log.action);
              const relTime = formatRelativeTime(log.createdAt);
              const fullDateStr = new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
              return (
                <div key={log._id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border shrink-0 transition-colors ${badgeStyle.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />{badgeStyle.label}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">{relTime}</span>
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                        <IconClock className="w-3 h-3 text-slate-400" />{fullDateStr}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] font-black uppercase text-indigo-700">Actor:</span>
                        <span className="text-slate-900 font-extrabold">{log.actor?.name || log.actor?.email || "System"}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">{log.actorRole || log.actor?.role || "super_admin"}</span>
                      </div>
                      {(log.target || log.targetEmail) && (
                        <div className="inline-flex items-center gap-1.5 bg-violet-50/80 px-2.5 py-1 rounded-xl border border-violet-200/60">
                          <IconArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                          <span className="text-[10px] font-black uppercase text-violet-700">Target:</span>
                          <span className="text-slate-900 font-extrabold">{log.target?.name || log.target?.email || log.targetEmail || log.target?._id}</span>
                          {log.target?.role && <span className="text-[10px] font-bold text-violet-600 bg-violet-100/60 px-1.5 py-0.5 rounded-md">{log.target.role}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500 pt-0.5">
                      {log.ip && (
                        <button onClick={() => copyToClipboard(log.ip || "", "IP Address")} className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg font-mono text-slate-700 transition-colors cursor-pointer" title="Click to copy IP Address">
                          <IconCopy className="w-3 h-3 text-slate-400" /><span>IP: {log.ip}</span>
                        </button>
                      )}
                      {log.userAgent && (
                        <span className="text-slate-400 truncate max-w-md" title={log.userAgent}>
                          • {log.userAgent.slice(0, 60)}{log.userAgent.length > 60 ? "..." : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {hasMetadata && (
                    <div className="shrink-0 self-start md:self-center">
                      <button onClick={() => { setSelectedLogItem(log); setSelectedLogMetadata(log.metadata || {}); }} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-95">
                        <IconCode className="w-3.5 h-3.5 text-indigo-600" /><span>Inspect Payload</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PaginationControls currentPage={logPage} totalPages={logTotalPages} totalItems={logTotalItems} onPageChange={(p) => setLogPage(p)} />

      <CommonModal
        isOpen={Boolean(selectedLogMetadata)}
        onClose={() => { setSelectedLogMetadata(null); setSelectedLogItem(null); }}
        title="Audit Event Metadata Payload"
      >
        <div className="space-y-4">
          {selectedLogItem && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-indigo-700 uppercase tracking-wider text-[10px] bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">{selectedLogItem.action}</span>
                <span className="text-[10px] font-extrabold text-slate-400">{new Date(selectedLogItem.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <p className="font-semibold text-slate-800">
                Actor: <span className="font-extrabold text-slate-900">{selectedLogItem.actor?.name || selectedLogItem.actor?.email || "System"}</span> ({selectedLogItem.actorRole || "super_admin"})
                {(selectedLogItem.target || selectedLogItem.targetEmail) && (
                  <span> &rarr; Target: <span className="font-extrabold text-slate-900">{selectedLogItem.target?.name || selectedLogItem.target?.email || selectedLogItem.targetEmail}</span></span>
                )}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">JSON Payload Details:</p>
            <button onClick={() => copyToClipboard(JSON.stringify(selectedLogMetadata, null, 2), "JSON Payload")} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-extrabold transition-colors cursor-pointer">
              <IconCopy className="w-3.5 h-3.5" /><span>Copy JSON</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto border border-slate-800 shadow-inner max-h-80 leading-relaxed">
            {JSON.stringify(selectedLogMetadata, null, 2)}
          </pre>
        </div>
      </CommonModal>
    </div>
  );
}
