"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchadmin, getadmindetails } from "../../store/commonapi";

interface AdminUser {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string | number | Date;
  [key: string]: unknown;
}

interface ActivityLog {
  _id?: string;
  action?: string;
  createdAt?: string | number | Date;
  actor?: string | { name?: string; email?: string; role?: string } | null;
  actorRole?: string;
  ip?: string;
  [key: string]: unknown;
}

export function AdminList() {
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // "all", "true", "false"
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected Admin Popup Modal State
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeParam =
        statusFilter === "true"
          ? true
          : statusFilter === "false"
          ? false
          : undefined;

      const data = await fetchadmin({
        page,
        limit: 10,
        search,
        role: roleFilter,
        isActive: activeParam,
      });

      const list =
        data?.admins ??
        data?.users ??
        data?.data?.admins ??
        data?.data?.users ??
        (Array.isArray(data?.data) ? data?.data : Array.isArray(data) ? data : []);

      const total =
        data?.totalPages ??
        data?.data?.totalPages ??
        Math.ceil((data?.total ?? data?.data?.total ?? list.length) / 10) ??
        1;

      setAdminList(list);
      setTotalPages(total || 1);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to load admin list:", errorObj);
      setError(
        errorObj?.response?.data?.message ??
        errorObj?.message ??
        "Failed to fetch admins."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const execute = async () => {
      await Promise.resolve();
      if (!ignore) {
        loadAdmins();
      }
    };
    execute();
    return () => {
      ignore = true;
    };
  }, [loadAdmins]);

  const handleAdminClick = async (admin: AdminUser) => {
    const adminId = admin._id || admin.id;
    setIsModalOpen(true);
    setSelectedAdmin(admin); // set initial basic data immediately
    setRecentActivity([]);
    setDetailLoading(true);
    setDetailError("");

    if (!adminId) {
      setDetailLoading(false);
      return;
    }

    try {
      const data = await getadmindetails(adminId);
      const adminData =
        data?.data?.admin ??
        data?.admin ??
        data?.user ??
        data?.data ??
        data;

      const activities =
        data?.data?.recentActivity ??
        data?.recentActivity ??
        [];

      setSelectedAdmin(adminData);
      setRecentActivity(activities);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to fetch admin details:", errorObj);
      setDetailError(
        errorObj?.response?.data?.message ??
        errorObj?.message ??
        "Failed to fetch detailed info."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAdmin(null);
    setRecentActivity([]);
    setDetailError("");
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">Admin Team Panel</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click on any admin row to view complete details in a popup window.
          </p>
        </div>
        <button
          onClick={loadAdmins}
          disabled={loading}
          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#1e69ff] border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search admins by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#1e69ff]"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2.5 focus:outline-none focus:border-[#1e69ff] cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
            <option value="manager">Manager</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2.5 focus:outline-none focus:border-[#1e69ff] cursor-pointer"
          >
            <option value="all">All Accounts (Active & Inactive)</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          <span className="font-semibold">{error}</span>
          <button
            onClick={loadAdmins}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Admin Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-semibold text-[11px] border-b border-slate-100 pb-2">
                <th className="pb-3 px-3 font-semibold">Admin</th>
                <th className="pb-3 px-3 font-semibold">Email</th>
                <th className="pb-3 px-3 font-semibold">Phone</th>
                <th className="pb-3 px-3 font-semibold">Role</th>
                <th className="pb-3 px-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {adminList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold">
                    No admin members found matching your search.
                  </td>
                </tr>
              ) : (
                adminList.map((admin, idx) => {
                  const adminName = admin.name || admin.fullName || "Admin User";
                  const email = admin.email || "No email";
                  const phone = admin.phone || admin.phoneNumber || "N/A";
                  const role = admin.role || "Admin";
                  const isActive = admin.isActive !== false;

                  return (
                    <tr
                      key={admin._id || admin.id || idx}
                      onClick={() => handleAdminClick(admin)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                      title="Click to view full admin details"
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                            {adminName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900 group-hover:text-[#1e69ff] transition-colors">{adminName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-mono">{email}</td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono">{phone}</td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 capitalize">
                          {role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${isActive
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-rose-50 text-rose-600 border border-rose-200"
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-all"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ================= ADMIN DETAILS POPUP MODAL ================= */}
      {isModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div
            className="fixed inset-0"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                  {(selectedAdmin.name || selectedAdmin.fullName || "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedAdmin.name || selectedAdmin.fullName || "Admin Details"}
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400 capitalize">
                    {selectedAdmin.role || "Admin"} Account
                  </span>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {detailLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                  <span className="text-xs font-semibold">Loading full details...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {detailError}
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Full Name</span>
                      <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                        {selectedAdmin.name || selectedAdmin.fullName || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Account ID</span>
                      <span className="font-mono text-slate-600 text-[11px] mt-0.5 block truncate" title={selectedAdmin._id || selectedAdmin.id}>
                        {selectedAdmin._id || selectedAdmin.id || "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/60 gap-1">
                      <span className="text-slate-400 font-semibold">Email Address</span>
                      <span className="font-mono font-bold text-slate-800 break-all">{selectedAdmin.email || "N/A"}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/60 gap-1">
                      <span className="text-slate-400 font-semibold">Phone Number</span>
                      <span className="font-mono font-bold text-slate-800">{selectedAdmin.phone || selectedAdmin.phoneNumber || "N/A"}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                      <span className="text-slate-400 font-semibold">User Role</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 capitalize">
                        {selectedAdmin.role || "Admin"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Account Status</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedAdmin.isActive !== false
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-rose-50 text-rose-600 border border-rose-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedAdmin.isActive !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {selectedAdmin.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Recent Activity Log Section */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                      Recent Activity Audit ({recentActivity.length})
                    </h4>

                    {recentActivity.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-400 text-center font-medium">
                        No recent activity logs available.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {recentActivity.map((act, idx) => (
                          <div key={act._id || idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-left">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                              <span className="font-bold text-slate-800 text-[11px] capitalize">
                                {act.action?.replace(/_/g, " ") || "Action performed"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {act.createdAt ? new Date(act.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                            {act.actor && (
                              <p className="text-[10px] text-slate-500">
                                By: <strong className="text-slate-700">{typeof act.actor === "object" && act.actor !== null ? (act.actor.name || act.actor.email || JSON.stringify(act.actor)) : String(act.actor)}</strong> ({typeof act.actorRole === "string" ? act.actorRole : (typeof act.actor === "object" && act.actor !== null && act.actor.role ? String(act.actor.role) : "N/A")})
                              </p>
                            )}

                            {act.ip && (
                              <span className="inline-block text-[9px] font-mono text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                IP: {act.ip}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {Boolean(selectedAdmin.createdAt) && (
                    <div className="flex justify-between items-center px-1 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                      <span>Created Date:</span>
                      <span className="font-mono">{new Date(selectedAdmin.createdAt!).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

