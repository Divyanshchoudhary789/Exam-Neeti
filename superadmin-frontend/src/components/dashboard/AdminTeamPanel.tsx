"use client";

import React, { useCallback, useEffect, useState } from "react";
import { superAdminService } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import {
  IconPlus, IconSearch, IconShield, IconFilter, IconUsers, IconMail, IconPhone,
  IconEye, IconEdit, IconUserX, IconUserCheck, IconTrash,
  StatusBadge, CardSkeleton, PaginationControls, CommonModal, Spinner, CustomSelectMenu,
} from "../common/UIComponents";
import type { AdminUser, AuditLogItem } from "./governanceShared";

interface Props {
  showToast: (text: string, type?: "success" | "error") => void;
  /** Bumping this number opens the "Invite New Admin" modal (header quick-action). */
  openCreateSignal?: number;
  /** Called after a create / delete / status change so the shell can refresh counters. */
  onTeamChanged?: () => void;
}

export function AdminTeamPanel({ showToast, openCreateSignal, onTeamChanged }: Props) {
  const { user } = useAuthStore();

  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminRoleFilter, setAdminRoleFilter] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotalPages, setAdminTotalPages] = useState(1);
  const [adminTotalItems, setAdminTotalItems] = useState(0);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const [selectedAdminDetail, setSelectedAdminDetail] = useState<{ admin: AdminUser; recentActivity: AuditLogItem[] } | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminUser | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const params: { page: number; limit: number; search?: string; role?: string; isActive?: boolean } = {
        page: adminPage, limit: 10,
      };
      if (adminSearch.trim()) params.search = adminSearch.trim();
      if (adminRoleFilter) params.role = adminRoleFilter;
      if (adminStatusFilter !== "") params.isActive = adminStatusFilter === "true";

      const res = await superAdminService.getAdminTeam(params);
      if (res?.success && res?.data) {
        setAdminList(res.data.admins || []);
        setAdminTotalPages(res.pagination?.totalPages || 1);
        setAdminTotalItems(res.pagination?.total || 0);
      }
    } catch {
      showToast("Error loading admin team accounts", "error");
    } finally {
      setAdminsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPage, adminSearch, adminRoleFilter, adminStatusFilter]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  useEffect(() => {
    if (openCreateSignal) setShowCreateModal(true);
  }, [openCreateSignal]);

  const handleViewAdminDetails = async (id: string) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await superAdminService.getAdminById(id);
      if (res?.success && res?.data) setSelectedAdminDetail(res.data);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load admin profile details", "error");
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const payload: { name: string; email: string; phone?: string; password?: string } = {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
      };
      if (newPhone.trim()) payload.phone = newPhone.trim();
      if (newPassword.trim()) payload.password = newPassword.trim();

      const res = await superAdminService.createAdmin(payload);
      showToast(res?.message || "Admin account created successfully!");
      setShowCreateModal(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
      loadAdmins();
      onTeamChanged?.();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to create admin account", "error");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEditAdmin = (adm: AdminUser) => {
    setEditAdmin(adm);
    setEditName(adm.name || "");
    setEditPhone(adm.phone || "");
  };

  const handleEditAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin) return;
    setEditSubmitting(true);
    try {
      const res = await superAdminService.updateAdmin(editAdmin._id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      showToast(res?.message || "Admin profile updated successfully!");
      setEditAdmin(null);
      loadAdmins();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to update admin profile", "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleAdminStatus = async (adm: AdminUser) => {
    try {
      if (adm.isActive) {
        await superAdminService.deactivateAdmin(adm._id);
        showToast(`Admin account ${adm.email} deactivated successfully`);
      } else {
        await superAdminService.reactivateAdmin(adm._id);
        showToast(`Admin account ${adm.email} reactivated successfully`);
      }
      loadAdmins();
      onTeamChanged?.();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Action failed", "error");
    }
  };

  const handleDeleteAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteAdminTarget) return;
    setDeleteSubmitting(true);
    try {
      const res = await superAdminService.deleteAdmin(deleteAdminTarget._id, deleteReason.trim() || undefined);
      showToast(res?.message || "Admin account permanently deleted.");
      setDeleteAdminTarget(null);
      setDeleteReason("");
      loadAdmins();
      onTeamChanged?.();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to delete admin account", "error");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Administrator Team</h2>
          <p className="text-xs text-slate-500 font-semibold">
            Manage admin accounts, update profiles, view activity logs, and revoke access.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          <IconPlus className="w-4 h-4" />
          <span>Invite New Admin</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex items-center">
          <IconSearch className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={adminSearch}
            onChange={(e) => { setAdminSearch(e.target.value); setAdminPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white text-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium shadow-sm"
          />
        </div>
        <CustomSelectMenu
          value={adminRoleFilter}
          onChange={(val) => { setAdminRoleFilter(val); setAdminPage(1); }}
          options={[
            { value: "", label: "All Roles" },
            { value: "admin", label: "Regular Admins" },
            { value: "super_admin", label: "Super Admins" },
          ]}
          icon={IconShield}
        />
        <CustomSelectMenu
          value={adminStatusFilter}
          onChange={(val) => { setAdminStatusFilter(val); setAdminPage(1); }}
          options={[
            { value: "", label: "All Statuses" },
            { value: "true", label: "Active Only" },
            { value: "false", label: "Deactivated Only" },
          ]}
          icon={IconFilter}
        />
      </div>

      {adminsLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : adminList.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-500 font-semibold space-y-2">
          <IconUsers className="w-8 h-8 mx-auto text-slate-300" />
          <p>No administrator accounts matching the selected criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {adminList.map((adm) => {
                const id = adm._id;
                const isActive = adm.isActive !== false;
                const isSuperAdmin = adm.role === "super_admin";
                const isSelf = adm._id === user?.id || adm._id === (user as unknown as { _id?: string })?._id;
                return (
                  <div key={id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100 flex items-center justify-center font-black text-sm text-indigo-700 shrink-0">
                        {adm.name?.charAt(0).toUpperCase() || "A"}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{adm.name}</p>
                          {isSelf && (
                            <span className="px-2 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black border border-indigo-200 shrink-0">YOU</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mt-0.5 min-w-0">
                          <span className="flex items-center gap-1 min-w-0 truncate">
                            <IconMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{adm.email}</span>
                          </span>
                          {adm.phone && (
                            <span className="flex items-center gap-1 shrink-0">
                              <IconPhone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{adm.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t border-slate-100 md:border-t-0 shrink-0 w-full md:w-auto">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border ${isSuperAdmin ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {isSuperAdmin ? "Super Admin" : "Admin"}
                        </span>
                        <StatusBadge status={isActive ? "Active" : "Deactivated"} />
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button onClick={() => handleViewAdminDetails(id)} className="p-2 sm:p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer" title="View Profile & Audit Logs">
                          <IconEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleOpenEditAdmin(adm)} className="p-2 sm:p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer" title="Edit Name/Phone">
                          <IconEdit className="w-4 h-4" />
                        </button>
                        {!isSelf && !isSuperAdmin && (
                          <button
                            onClick={() => handleToggleAdminStatus(adm)}
                            className={`p-2 sm:p-2.5 rounded-xl border transition-colors cursor-pointer ${isActive ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                            title={isActive ? "Deactivate Account" : "Reactivate Account"}
                          >
                            {isActive ? <IconUserX className="w-4 h-4" /> : <IconUserCheck className="w-4 h-4" />}
                          </button>
                        )}
                        {!isSelf && !isSuperAdmin && (
                          <button onClick={() => setDeleteAdminTarget(adm)} className="p-2 sm:p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer" title="Hard Delete Admin Account">
                            <IconTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <PaginationControls currentPage={adminPage} totalPages={adminTotalPages} totalItems={adminTotalItems} onPageChange={(p) => setAdminPage(p)} />
        </div>
      )}

      {/* View admin profile + activity */}
      <CommonModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedAdminDetail(null); }}
        title="Admin Profile & Activity Log"
        maxWidth="max-w-2xl"
      >
        {detailLoading || !selectedAdminDetail ? (
          <div className="p-8 text-center space-y-3">
            <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading admin profile history...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900">{selectedAdminDetail.admin.name}</h4>
                  <p className="text-xs text-slate-500 font-semibold">{selectedAdminDetail.admin.email}</p>
                </div>
                <StatusBadge status={selectedAdminDetail.admin.isActive ? "Active" : "Deactivated"} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
                <div><span className="text-slate-400 font-medium">Role:</span> <span className="font-bold text-slate-800">{selectedAdminDetail.admin.role}</span></div>
                <div><span className="text-slate-400 font-medium">Phone:</span> <span className="font-bold text-slate-800">{selectedAdminDetail.admin.phone || "N/A"}</span></div>
              </div>
            </div>
            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">Recent Audit Trail Activity</h5>
              {!selectedAdminDetail.recentActivity || selectedAdminDetail.recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold p-4 text-center">No recent audit log history.</p>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden bg-white">
                  {selectedAdminDetail.recentActivity.map((act) => (
                    <div key={act._id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-black text-indigo-600 text-[10px] uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mr-2">{act.action}</span>
                        <span className="font-medium text-slate-700 truncate">{act.targetEmail ? `Target: ${act.targetEmail}` : "System action"}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">{new Date(act.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CommonModal>

      {/* Create admin */}
      <CommonModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Invite New Administrator Account">
        <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Full Name</label>
            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sujan Saha" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Email Address</label>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@examneeti.com" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Phone Number (Optional)</label>
            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91 9876543210" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Initial Temporary Password (Optional)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to auto-generate secure temp password" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
            <p className="text-[10px] text-slate-400 font-semibold mt-1">An invitation email will be sent automatically with log in instructions.</p>
          </div>
          <button type="submit" disabled={createSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all">
            {createSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Send Admin Invitation"}
          </button>
        </form>
      </CommonModal>

      {/* Edit admin */}
      <CommonModal isOpen={Boolean(editAdmin)} onClose={() => setEditAdmin(null)} title="Edit Admin Profile Details">
        <form onSubmit={handleEditAdminSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Full Name</label>
            <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Phone Number</label>
            <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+91 9876543210" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <button type="submit" disabled={editSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all">
            {editSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Admin Profile Changes"}
          </button>
        </form>
      </CommonModal>

      {/* Delete admin */}
      <CommonModal isOpen={Boolean(deleteAdminTarget)} onClose={() => { setDeleteAdminTarget(null); setDeleteReason(""); }} title="Hard Delete Administrator Account">
        <form onSubmit={handleDeleteAdminSubmit} className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 space-y-1">
            <p className="font-bold">Are you sure you want to delete this administrator account?</p>
            <p className="font-medium text-[11px]">Account: <span className="font-black">{deleteAdminTarget?.name}</span> ({deleteAdminTarget?.email})</p>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Audit Reason / Justification (Optional)</label>
            <textarea rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="e.g. Employee offboarded from company" className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm p-3.5 rounded-xl sm:rounded-2xl transition-all outline-none font-medium" />
          </div>
          <button type="submit" disabled={deleteSubmitting} className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all">
            {deleteSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Confirm Permanent Account Deletion"}
          </button>
        </form>
      </CommonModal>
    </div>
  );
}
