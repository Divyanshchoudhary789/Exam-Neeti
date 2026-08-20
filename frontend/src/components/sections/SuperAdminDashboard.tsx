"use client";

import React, { useState, useEffect, useCallback } from "react";
import { superAdminService, adminService } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import { changepassword } from "../../store/commonapi";
import {
  IconUsers,
  IconShield,
  IconChart,
  IconClock,
  IconPlus,
  IconTrash,
  IconCheck,
  IconCross,
  IconSearch,
  IconEdit,
  IconEye,
  IconFilter,
  IconKey,
  IconAlertTriangle,
  IconRefresh,
  IconUserCheck,
  IconUserX,
  IconMail,
  IconPhone,
  IconDownload,
  IconCopy,
  IconCode,
  IconArrowRight,
  IconChevronDown,
  StatusBadge,
  MiniStatCard,
  CommonModal,
  Spinner,
  CardSkeleton,
  PaginationControls,
  CustomSelectMenu,
} from "../common/UIComponents";

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

const TABS = [
  { id: "system", label: "System Overview", icon: IconChart },
  { id: "admins", label: "Admin Team", icon: IconUsers },
  { id: "logs", label: "Platform Audit Trail", icon: IconClock },
  { id: "governance", label: "Governance & Purge", icon: IconAlertTriangle },
  { id: "settings", label: "Security", icon: IconShield },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "super_admin";
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuditLogItem {
  _id: string;
  actor?: { _id?: string; name?: string; email?: string; role?: string };
  actorRole?: string;
  action: string;
  target?: { _id?: string; name?: string; email?: string; role?: string };
  targetEmail?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 30) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateString;
  }
}

function getActionBadgeStyle(action: string) {
  const act = (action || "").toUpperCase();
  if (act.includes("LOGIN")) {
    return {
      bg: "bg-indigo-50/90 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100",
      dot: "bg-indigo-500",
      label: "AUTH LOGIN",
    };
  }
  if (act.includes("CREATE") || act.includes("REACTIVATE")) {
    return {
      bg: "bg-emerald-50/90 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100",
      dot: "bg-emerald-500",
      label: act,
    };
  }
  if (act.includes("DELETE") || act.includes("PURGE")) {
    return {
      bg: "bg-rose-50/90 text-rose-700 border-rose-200/80 hover:bg-rose-100",
      dot: "bg-rose-500",
      label: act,
    };
  }
  if (act.includes("DEACTIVATE")) {
    return {
      bg: "bg-amber-50/90 text-amber-700 border-amber-200/80 hover:bg-amber-100",
      dot: "bg-amber-500",
      label: act,
    };
  }
  return {
    bg: "bg-purple-50/90 text-purple-700 border-purple-200/80 hover:bg-purple-100",
    dot: "bg-purple-500",
    label: act,
  };
}

export function SuperAdminDashboard({ onLogout }: SuperAdminDashboardProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Platform stats
  const [platformStats, setPlatformStats] = useState<{
    team?: { totalAdmins?: number; activeAdmins?: number; inactiveAdmins?: number };
    students?: { total?: number; active?: number; inactive?: number };
    platform?: { totalBatches?: number; activeBatches?: number; totalExams?: number; totalAttempts?: number };
    recentAdmins?: AdminUser[];
  } | null>(null);

  // Admin Team list & filters
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminRoleFilter, setAdminRoleFilter] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotalPages, setAdminTotalPages] = useState(1);
  const [adminTotalItems, setAdminTotalItems] = useState(0);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // View single admin detail modal
  const [selectedAdminDetail, setSelectedAdminDetail] = useState<{
    admin: AdminUser;
    recentActivity: AuditLogItem[];
  } | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create admin modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit admin modal state
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete admin modal state
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminUser | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTotalItems, setLogTotalItems] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logAdminIdFilter, setLogAdminIdFilter] = useState("");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");

  // Inspect raw audit metadata modal
  const [selectedLogMetadata, setSelectedLogMetadata] = useState<Record<string, unknown> | null>(null);
  const [selectedLogItem, setSelectedLogItem] = useState<AuditLogItem | null>(null);

  const handleSetDatePreset = (preset: "today" | "7days" | "30days") => {
    const today = new Date();
    const endDateStr = today.toISOString().split("T")[0];

    let startDateObj = new Date();
    if (preset === "today") {
      startDateObj = today;
    } else if (preset === "7days") {
      startDateObj.setDate(today.getDate() - 7);
    } else if (preset === "30days") {
      startDateObj.setDate(today.getDate() - 30);
    }

    const startDateStr = startDateObj.toISOString().split("T")[0];
    setLogStartDate(startDateStr);
    setLogEndDate(endDateStr);
    setLogPage(1);
  };

  const resetLogFilters = () => {
    setLogActionFilter("");
    setLogAdminIdFilter("");
    setLogStartDate("");
    setLogEndDate("");
    setLogPage(1);
  };

  const activeFiltersCount = [
    logActionFilter,
    logAdminIdFilter,
    logStartDate,
    logEndDate,
  ].filter(Boolean).length;

  const handleExportAuditLogsCSV = () => {
    if (!auditLogs || auditLogs.length === 0) return;

    const headers = [
      "Log ID",
      "Timestamp",
      "Action",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Target Name/Email",
      "Target ID",
      "IP Address",
      "User Agent",
      "Metadata JSON",
    ];

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  // Governance / Purge state
  const [purgeStudentId, setPurgeStudentId] = useState("");
  const [purgeStudentEmailConfirm, setPurgeStudentEmailConfirm] = useState("");
  const [purgeStudentSubmitting, setPurgeStudentSubmitting] = useState(false);

  const [studentOptions, setStudentOptions] = useState<
    { _id: string; name: string; email: string; phone?: string; batch?: { _id?: string; name?: string } | string; isActive?: boolean }[]
  >([]);
  const [selectedStudentForPurge, setSelectedStudentForPurge] = useState<{
    _id: string;
    name: string;
    email: string;
    phone?: string;
    batch?: { _id?: string; name?: string } | string;
    isActive?: boolean;
  } | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [purgeBatchId, setPurgeBatchId] = useState("");
  const [purgeBatchNameConfirm, setPurgeBatchNameConfirm] = useState("");
  const [purgeBatchForce, setPurgeBatchForce] = useState(false);
  const [purgeBatchSubmitting, setPurgeBatchSubmitting] = useState(false);

  const [batchOptions, setBatchOptions] = useState<{ _id: string; name: string; programType?: string; description?: string }[]>([]);

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await superAdminService.getPlatformStats();
      if (res?.success && res?.data) {
        setPlatformStats(res.data);
      }
    } catch {
      showToast("Failed to load platform overview stats", "error");
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        search?: string;
        role?: string;
        isActive?: boolean;
      } = { page: adminPage, limit: 10 };

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
  }, [adminPage, adminSearch, adminRoleFilter, adminStatusFilter]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        action?: string;
        adminId?: string;
        startDate?: string;
        endDate?: string;
      } = { page: logPage, limit: 15 };

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
  }, [logPage, logActionFilter, logAdminIdFilter, logStartDate, logEndDate]);

  const loadBatchesForPurge = useCallback(async () => {
    try {
      const res = await adminService.getBatches();
      const bList = res?.data?.batches || res?.batches || (Array.isArray(res?.data) ? res.data : []);
      setBatchOptions(Array.isArray(bList) ? bList : []);
    } catch {
      // Non-critical background fetch
    }
  }, []);

  const loadStudentsForPurge = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const res = await adminService.getUsers({ role: "student", limit: 100 });
      const list =
        res?.data?.students ||
        res?.data?.users ||
        res?.students ||
        res?.users ||
        (Array.isArray(res?.data) ? res.data : []);
      setStudentOptions(Array.isArray(list) ? list : []);
    } catch {
      // Non-critical background fetch
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadStats();
      setPageLoading(false);
    };
    init();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === "admins") loadAdmins();
  }, [activeTab, loadAdmins]);

  useEffect(() => {
    if (activeTab === "logs") loadLogs();
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab === "governance") {
      loadBatchesForPurge();
      loadStudentsForPurge();
    }
  }, [activeTab, loadBatchesForPurge, loadStudentsForPurge]);

  // Handle Admin Profile View Modal
  const handleViewAdminDetails = async (id: string) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await superAdminService.getAdminById(id);
      if (res?.success && res?.data) {
        setSelectedAdminDetail(res.data);
      }
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load admin profile details", "error");
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle Create Admin
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
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      loadAdmins();
      loadStats();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to create admin account", "error");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit Admin Profile
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

  // Handle Deactivate / Reactivate
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
      loadStats();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Action failed", "error");
    }
  };

  // Handle Delete Admin with Reason
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
      loadStats();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to delete admin account", "error");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Handle Hard Delete Student (Governance)
  const handlePurgeStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeStudentId.trim() || !purgeStudentEmailConfirm.trim()) {
      showToast("Please provide both Student ID and exact Confirmation Email", "error");
      return;
    }
    setPurgeStudentSubmitting(true);
    try {
      const res = await superAdminService.hardDeleteStudent(
        purgeStudentId.trim(),
        purgeStudentEmailConfirm.trim().toLowerCase()
      );
      showToast(res?.message || "Student account permanently purged.");
      setPurgeStudentId("");
      setPurgeStudentEmailConfirm("");
      loadStats();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Hard delete student failed", "error");
    } finally {
      setPurgeStudentSubmitting(false);
    }
  };

  // Handle Hard Delete Batch (Governance)
  const handlePurgeBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeBatchId || !purgeBatchNameConfirm.trim()) {
      showToast("Please select a Batch and type exact confirmation name", "error");
      return;
    }
    setPurgeBatchSubmitting(true);
    try {
      const res = await superAdminService.hardDeleteBatch(
        purgeBatchId,
        purgeBatchNameConfirm.trim(),
        purgeBatchForce
      );
      showToast(res?.message || "Batch permanently purged from platform.");
      setPurgeBatchId("");
      setPurgeBatchNameConfirm("");
      setPurgeBatchForce(false);
      loadBatchesForPurge();
      loadStats();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Hard delete batch failed", "error");
    } finally {
      setPurgeBatchSubmitting(false);
    }
  };

  // Handle Change SuperAdmin Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showToast("New passwords do not match", "error");
      return;
    }
    if (newPw.length < 8) {
      showToast("Password must be at least 8 characters long", "error");
      return;
    }
    setPwLoading(true);
    try {
      await changepassword({ currentPassword, newPassword: newPw, confirmNewPassword: confirmPw });
      showToast("SuperAdmin password updated successfully!");
      setCurrentPassword("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Password update failed", "error");
    } finally {
      setPwLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Spinner className="w-12 h-12 text-indigo-600 mx-auto" />
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
            Initializing Root Governance Portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5f9] font-sans antialiased text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 inset-x-4 sm:top-6 sm:right-6 sm:left-auto sm:inset-x-auto z-[99999] flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-2xl text-xs font-bold transition-all animate-bounce max-w-sm sm:max-w-none mx-auto sm:mx-0 ${toast.type === "success"
            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
            : "bg-red-50 border-red-300 text-red-900"
            }`}
        >
          {toast.type === "success" ? (
            <IconCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <IconCross className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <IconCross className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Executive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-indigo-600 via-purple-600 to-amber-500" />
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 pl-1 sm:pl-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 shadow-sm">
              <IconShield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  Root Platform Governance
                </h1>
                <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5 truncate">
                Full System Control &bull; Logged in as{" "}
                <span className="text-indigo-600 font-bold">{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-auto w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <button
              onClick={() => {
                loadStats();
                if (activeTab === "admins") loadAdmins();
                if (activeTab === "logs") loadLogs();
              }}
              className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Refresh Data"
            >
              <IconRefresh className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="px-3.5 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0"
            >
              <span>Logout</span>
              <span className="hidden sm:inline">Governance Portal</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation - Mobile Select Dropdown & Desktop Tab Bar */}
        <div className="space-y-2">
          <div className="sm:hidden">
            <CustomSelectMenu
              value={activeTab}
              onChange={(val) => setActiveTab(val as TabId)}
              options={TABS.map((t) => ({ value: t.id, label: t.label }))}
              icon={IconFilter}
              buttonClassName="bg-white text-indigo-900 border-indigo-200 font-bold text-xs"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200/80">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeTab === id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-300"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ========================================== */}
        {/* TAB 1: SYSTEM OVERVIEW & HEALTH */}
        {/* ========================================== */}
        {activeTab === "system" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <MiniStatCard
                title="Admin Team Accounts"
                value={platformStats?.team?.totalAdmins ?? 0}
                subtitle={`${platformStats?.team?.activeAdmins ?? 0} Active \u2022 ${platformStats?.team?.inactiveAdmins ?? 0
                  } Deactivated`}
                icon={IconUsers}
                ringValue={platformStats?.team?.totalAdmins ? Math.round((Number(platformStats.team.activeAdmins ?? 0) / Number(platformStats.team.totalAdmins)) * 100) : undefined}
              />
              <MiniStatCard
                title="Total Enrolled Students"
                value={platformStats?.students?.total ?? 0}
                subtitle={`${platformStats?.students?.active ?? 0} Active \u2022 ${platformStats?.students?.inactive ?? 0
                  } Inactive`}
                icon={IconUsers}
                ringValue={platformStats?.students?.total ? Math.round((Number(platformStats.students.active ?? 0) / Number(platformStats.students.total)) * 100) : undefined}
              />
              <MiniStatCard
                title="Active Batches"
                value={platformStats?.platform?.activeBatches ?? 0}
                subtitle={`Out of ${platformStats?.platform?.totalBatches ?? 0} total batches`}
                icon={IconClock}
                ringValue={platformStats?.platform?.totalBatches ? Math.round((Number(platformStats.platform.activeBatches ?? 0) / Number(platformStats.platform.totalBatches)) * 100) : undefined}
              />
              <MiniStatCard
                title="Exam Submissions"
                value={platformStats?.platform?.totalAttempts ?? 0}
                subtitle={`${platformStats?.platform?.totalExams ?? 0} Total Exams Created`}
                icon={IconChart}
              />
            </div>

            {/* Architecture Overview & Recent Admins Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Admin Accounts */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconUsers className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-base font-black text-slate-900">Recent Admin Team Accounts</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab("admins")}
                    className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    View All Admins &rarr;
                  </button>
                </div>

                {!platformStats?.recentAdmins || platformStats.recentAdmins.length === 0 ? (
                  <p className="text-xs text-slate-500 font-semibold p-6 text-center">No recent admin records.</p>
                ) : (
                  <div className="divide-y divide-slate-100 overflow-x-auto">
                    {platformStats.recentAdmins.map((adm) => (
                      <div
                        key={adm._id}
                        className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-xs text-indigo-700">
                            {adm.name?.charAt(0).toUpperCase() || "A"}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900">{adm.name}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{adm.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${adm.role === "super_admin"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                          >
                            {adm.role === "super_admin" ? "Super Admin" : "Admin"}
                          </span>
                          <StatusBadge status={adm.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Infrastructure Status */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <IconShield className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-black text-slate-900">Platform Health</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Database Layer", status: "MongoDB Atlas Connected", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                    { label: "API Gateway", status: "Express v1 Router Active", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
                    { label: "Analytics Engine", status: "69 Formula Computations", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                    { label: "Audit Logger", status: "Immutable Trail Active", color: "text-purple-600 bg-purple-50 border-purple-200" },
                  ].map(({ label, status, color }) => (
                    <div key={label} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">{label}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${color}`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: ADMIN TEAM MANAGEMENT */}
        {/* ========================================== */}
        {activeTab === "admins" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Administrator Team</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Manage admin accounts, update roles, view activity logs, and revoke access.
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

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="relative flex items-center">
                <IconSearch className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={adminSearch}
                  onChange={(e) => {
                    setAdminSearch(e.target.value);
                    setAdminPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white text-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium shadow-sm"
                />
              </div>

              <CustomSelectMenu
                value={adminRoleFilter}
                onChange={(val) => {
                  setAdminRoleFilter(val);
                  setAdminPage(1);
                }}
                options={[
                  { value: "", label: "All Roles" },
                  { value: "admin", label: "Regular Admins" },
                  { value: "super_admin", label: "Super Admins" },
                ]}
                icon={IconShield}
              />

              <CustomSelectMenu
                value={adminStatusFilter}
                onChange={(val) => {
                  setAdminStatusFilter(val);
                  setAdminPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "true", label: "Active Only" },
                  { value: "false", label: "Deactivated Only" },
                ]}
                icon={IconFilter}
              />
            </div>

            {/* Admin Accounts Table */}
            {adminsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
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
                        <div
                          key={id}
                          className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-indigo-100 flex items-center justify-center font-black text-sm text-indigo-700 shrink-0">
                              {adm.name?.charAt(0).toUpperCase() || "A"}
                            </div>
                            <div className="min-w-0 flex-grow">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{adm.name}</p>
                                {isSelf && (
                                  <span className="px-2 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black border border-indigo-200 shrink-0">
                                    YOU
                                  </span>
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
                              <span
                                className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border ${isSuperAdmin
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                              >
                                {isSuperAdmin ? "Super Admin" : "Admin"}
                              </span>

                              <StatusBadge status={isActive ? "Active" : "Deactivated"} />
                            </div>

                            <div className="flex items-center gap-1 sm:gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => handleViewAdminDetails(id)}
                                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="View Profile & Audit Logs"
                              >
                                <IconEye className="w-4 h-4" />
                              </button>

                              {/* Edit Profile */}
                              <button
                                onClick={() => handleOpenEditAdmin(adm)}
                                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Edit Name/Phone"
                              >
                                <IconEdit className="w-4 h-4" />
                              </button>

                              {/* Toggle Active Status */}
                              {!isSelf && !isSuperAdmin && (
                                <button
                                  onClick={() => handleToggleAdminStatus(adm)}
                                  className={`p-2 sm:p-2.5 rounded-xl border transition-colors cursor-pointer ${isActive
                                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    }`}
                                  title={isActive ? "Deactivate Account" : "Reactivate Account"}
                                >
                                  {isActive ? <IconUserX className="w-4 h-4" /> : <IconUserCheck className="w-4 h-4" />}
                                </button>
                              )}

                              {/* Delete Admin Account */}
                              {!isSelf && !isSuperAdmin && (
                                <button
                                  onClick={() => setDeleteAdminTarget(adm)}
                                  className="p-2 sm:p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                                  title="Hard Delete Admin Account"
                                >
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

                <PaginationControls
                  currentPage={adminPage}
                  totalPages={adminTotalPages}
                  totalItems={adminTotalItems}
                  onPageChange={(p) => setAdminPage(p)}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: PLATFORM AUDIT TRAIL */}
        {/* ========================================== */}
        {activeTab === "logs" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Banner with Gradient & Stats */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="p-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                      <IconClock className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
                      Security & Compliance
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Audit Logging Active
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                    Platform Audit Trail
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                    Immutable append-only activity records capturing every high-privilege administrator action on Exam Neeti for compliance and governance.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => loadLogs()}
                    disabled={logsLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Refresh Audit Logs"
                  >
                    <IconRefresh className={`w-4 h-4 ${logsLoading ? "animate-spin text-indigo-300" : ""}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleExportAuditLogsCSV}
                    disabled={auditLogs.length === 0}
                    className="flex items-center gap-2 px-4.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconDownload className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Strip */}
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
                  <div className="text-lg sm:text-xl font-black text-amber-300 mt-1">
                    {activeFiltersCount === 0 ? "None" : `${activeFiltersCount} Active`}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tamper Resistance</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">Immutable</div>
                </div>
              </div>
            </div>

            {/* Filter Controls Panel */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <IconFilter className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Audit Log Filter Engine</h3>
                    <p className="text-[11px] font-medium text-slate-500">Filter by action type, admin actor/target name or email, or date range</p>
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetLogFilters}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <IconCross className="w-3.5 h-3.5" />
                    <span>Clear All Filters ({activeFiltersCount})</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Action Type Dropdown */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Action Type</label>
                  <div className="relative">
                    <select
                      value={logActionFilter}
                      onChange={(e) => {
                        setLogActionFilter(e.target.value);
                        setLogPage(1);
                      }}
                      className="w-full pl-3.5 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800 appearance-none cursor-pointer"
                    >
                      <option value="">All Action Types</option>
                      <option value="login">🔑 LOGIN / AUTH</option>
                      <option value="admin_created">👤 ADMIN_CREATED</option>
                      <option value="admin_updated">✏️ ADMIN_UPDATED</option>
                      <option value="admin_deactivated">⚠️ ADMIN_DEACTIVATED</option>
                      <option value="admin_reactivated">✅ ADMIN_REACTIVATED</option>
                      <option value="admin_deleted">🚨 ADMIN_DELETED</option>
                      <option value="role_changed">⚡ ROLE_CHANGED</option>
                      <option value="password_changed">🔒 PASSWORD_CHANGED</option>
                      <option value="password_reset">🔐 PASSWORD_RESET</option>
                      <option value="student_deactivated">🛑 STUDENT_DEACTIVATED</option>
                      <option value="student_reactivated">❇️ STUDENT_REACTIVATED</option>
                      <option value="student_deleted">🗑️ STUDENT_DELETED</option>
                      <option value="batch_deactivated">⏸️ BATCH_DEACTIVATED</option>
                      <option value="batch_reactivated">▶️ BATCH_REACTIVATED</option>
                      <option value="batch_deleted">💥 BATCH_DELETED</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <IconChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Actor / Target Search */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Actor / Target Search</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search Actor / Target name, email or ID..."
                      value={logAdminIdFilter}
                      onChange={(e) => {
                        setLogAdminIdFilter(e.target.value);
                        setLogPage(1);
                      }}
                      className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800 placeholder:text-slate-400"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <IconSearch className="w-4 h-4" />
                    </div>
                    {logAdminIdFilter && (
                      <button
                        onClick={() => {
                          setLogAdminIdFilter("");
                          setLogPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        <IconCross className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={logStartDate}
                    onChange={(e) => {
                      setLogStartDate(e.target.value);
                      setLogPage(1);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={logEndDate}
                    onChange={(e) => {
                      setLogEndDate(e.target.value);
                      setLogPage(1);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl transition-all outline-none font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
                  <button
                    onClick={() => handleSetDatePreset("today")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleSetDatePreset("7days")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Last 7 Days
                  </button>
                  <button
                    onClick={() => handleSetDatePreset("30days")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Last 30 Days
                  </button>
                  {(logStartDate || logEndDate) && (
                    <button
                      onClick={() => {
                        setLogStartDate("");
                        setLogEndDate("");
                        setLogPage(1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Clear Dates
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-bold text-slate-400">
                  Showing <span className="text-slate-800 font-extrabold">{auditLogs.length}</span> of{" "}
                  <span className="text-slate-800 font-extrabold">{logTotalItems}</span> records
                </div>
              </div>
            </div>

            {/* Audit Logs Table / Cards Container */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              {logsLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                    <IconFilter className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">No audit logs matching filters</h3>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                    No activity logs were found matching your current action type, actor search, or date range selection.
                  </p>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetLogFilters}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {auditLogs.map((log) => {
                    const badgeStyle = getActionBadgeStyle(log.action);
                    const relTime = formatRelativeTime(log.createdAt);
                    const fullDateStr = new Date(log.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    });

                    const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                    return (
                      <div
                        key={log._id}
                        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Event Details */}
                        <div className="space-y-2.5 min-w-0 flex-1">
                          {/* Top Row: Action Badge + Relative Time + Full Date */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border shrink-0 transition-colors ${badgeStyle.bg}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                              {badgeStyle.label}
                            </span>

                            <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                              {relTime}
                            </span>

                            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                              <IconClock className="w-3 h-3 text-slate-400" />
                              {fullDateStr}
                            </span>
                          </div>

                          {/* Actor & Target Relationship Box */}
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                            {/* Actor */}
                            <div className="inline-flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-xl border border-slate-200/60">
                              <span className="text-[10px] font-black uppercase text-indigo-700">Actor:</span>
                              <span className="text-slate-900 font-extrabold">
                                {log.actor?.name || log.actor?.email || "System"}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                                {log.actorRole || log.actor?.role || "super_admin"}
                              </span>
                            </div>

                            {/* Target (if present) */}
                            {(log.target || log.targetEmail) && (
                              <div className="inline-flex items-center gap-1.5 bg-violet-50/80 px-2.5 py-1 rounded-xl border border-violet-200/60">
                                <IconArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                                <span className="text-[10px] font-black uppercase text-violet-700">Target:</span>
                                <span className="text-slate-900 font-extrabold">
                                  {log.target?.name || log.target?.email || log.targetEmail || log.target?._id}
                                </span>
                                {log.target?.role && (
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-100/60 px-1.5 py-0.5 rounded-md">
                                    {log.target.role}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Client Details (IP & User-Agent) */}
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500 pt-0.5">
                            {log.ip && (
                              <button
                                onClick={() => copyToClipboard(log.ip || "", "IP Address")}
                                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg font-mono text-slate-700 transition-colors cursor-pointer"
                                title="Click to copy IP Address"
                              >
                                <IconCopy className="w-3 h-3 text-slate-400" />
                                <span>IP: {log.ip}</span>
                              </button>
                            )}

                            {log.userAgent && (
                              <span className="text-slate-400 truncate max-w-md" title={log.userAgent}>
                                • {log.userAgent.slice(0, 60)}{log.userAgent.length > 60 ? "..." : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Column: Inspect Payload Button */}
                        {hasMetadata && (
                          <div className="shrink-0 self-start md:self-center">
                            <button
                              onClick={() => {
                                setSelectedLogItem(log);
                                setSelectedLogMetadata(log.metadata || {});
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              <IconCode className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Inspect Payload</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <PaginationControls
              currentPage={logPage}
              totalPages={logTotalPages}
              totalItems={logTotalItems}
              onPageChange={(p) => setLogPage(p)}
            />
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: GOVERNANCE & PURGE HUB */}
        {/* ========================================== */}
        {activeTab === "governance" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-red-50/80 border border-red-200 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-red-100 rounded-2xl text-red-700 shrink-0">
                <IconAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-red-900">Irreversible Platform Hard Delete Operations</h3>
                <p className="text-xs text-red-800/90 font-medium leading-relaxed">
                  These operations permanently purge data from the MongoDB database. Soft deactivation is recommended
                  for normal administrative workflows. Hard deletes bypass soft flags and cannot be undone.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purge Student Account */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-red-700">
                  <IconTrash className="w-5 h-5" />
                  <h3 className="text-base font-black text-slate-900">Permanently Purge Student Account</h3>
                </div>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Select a student from the system database or enter details. Requires exact email confirmation.
                </p>

                <form onSubmit={handlePurgeStudentSubmit} className="space-y-4 pt-1">
                  <CustomSelectMenu
                    id="selectStudentPurge"
                    label="Select Target Student from Database"
                    value={selectedStudentForPurge?._id || ""}
                    onChange={(stdId) => {
                      const std = studentOptions.find((s) => s._id === stdId) || null;
                      setSelectedStudentForPurge(std);
                      // SAFETY: never auto-fill the confirmation field — it exists
                      // specifically to make the admin type the exact email before
                      // an irreversible delete, and picker selection alone must
                      // not be enough to satisfy it.
                      if (std) {
                        setPurgeStudentId(std._id);
                        setPurgeStudentEmailConfirm("");
                      }
                    }}
                    placeholder={studentsLoading ? "Loading students..." : "-- Search by Name or Email --"}
                    options={studentOptions.map((s) => ({
                      value: s._id,
                      label: `${s.name} (${s.email})`,
                      sublabel: `Batch: ${typeof s.batch === "object" ? s.batch?.name : s.batch || "Unassigned"} • ID: ${s._id}`,
                      badge: s.isActive !== false ? "Active" : "Inactive",
                    }))}
                    icon={IconUsers}
                    searchable={true}
                  />

                  {/* Student Live Info Card */}
                  {selectedStudentForPurge && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold uppercase text-[10px] text-indigo-800 tracking-wider">
                          Selected Student Record
                        </span>
                        <StatusBadge status={selectedStudentForPurge.isActive !== false ? "Active" : "Inactive"} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                        <div>
                          <span className="text-slate-400 font-normal">Name:</span>{" "}
                          <span className="font-bold text-slate-900">{selectedStudentForPurge.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-normal">Email:</span>{" "}
                          <span className="font-bold text-slate-900">{selectedStudentForPurge.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-normal">Phone:</span>{" "}
                          <span className="font-bold text-slate-900">{selectedStudentForPurge.phone || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-normal">Batch:</span>{" "}
                          <span className="font-bold text-slate-900">
                            {typeof selectedStudentForPurge.batch === "object"
                              ? selectedStudentForPurge.batch?.name
                              : selectedStudentForPurge.batch || "Unassigned"}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          MongoDB ID: <code className="text-indigo-900 font-mono font-bold">{selectedStudentForPurge._id}</code>
                        </span>
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          <IconAlertTriangle className="w-3.5 h-3.5" /> Type email below to confirm
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                      Student ID (24-char ObjectId)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 64f8a123bc45678901234567"
                      value={purgeStudentId}
                      onChange={(e) => {
                        setPurgeStudentId(e.target.value);
                        const match = studentOptions.find((s) => s._id === e.target.value.trim());
                        if (match) setSelectedStudentForPurge(match);
                      }}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                      Confirm Student Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={purgeStudentEmailConfirm}
                      onChange={(e) => setPurgeStudentEmailConfirm(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={purgeStudentSubmitting}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {purgeStudentSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Purge Student Account"}
                  </button>
                </form>
              </div>

              {/* Purge Batch */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-red-700">
                  <IconTrash className="w-5 h-5" />
                  <h3 className="text-base font-black text-slate-900">Permanently Purge Batch</h3>
                </div>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Permanently deletes a batch from the system. If active students exist, set Force to true.
                </p>

                <form onSubmit={handlePurgeBatchSubmit} className="space-y-4 pt-1">
                  <CustomSelectMenu
                    id="purgeBatchId"
                    label="Select Target Batch"
                    value={purgeBatchId}
                    onChange={(bId) => {
                      setPurgeBatchId(bId);
                      // SAFETY: don't auto-fill the confirmation field — see the
                      // matching note on the student-purge picker above.
                      setPurgeBatchNameConfirm("");
                    }}
                    placeholder="-- Search or Select Batch --"
                    options={batchOptions.map((b) => ({
                      value: b._id,
                      label: b.name,
                      sublabel: `Program: ${b.programType || "Standard"} • ID: ${b._id}`,
                    }))}
                    icon={IconFilter}
                    searchable={true}
                  />

                  {/* Batch Live Info Card */}
                  {purgeBatchId && (() => {
                    const selBatch = batchOptions.find((b) => b._id === purgeBatchId);
                    if (!selBatch) return null;
                    return (
                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold uppercase text-[10px] text-amber-800 tracking-wider">
                            Selected Batch Details
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                            {selBatch.programType || "Batch Record"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium">
                          <div>
                            <span className="text-slate-400 font-normal">Name:</span>{" "}
                            <span className="font-bold text-slate-900">{selBatch.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-normal">Batch ID:</span>{" "}
                            <code className="font-mono text-slate-800 font-bold">{selBatch._id}</code>
                          </div>
                        </div>
                        {selBatch.description && (
                          <p className="text-[11px] text-slate-500 font-medium">{selBatch.description}</p>
                        )}
                        <div className="pt-1 text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                          <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>Confirmation name set to: "{selBatch.name}"</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                      Confirm Batch Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Exact batch name"
                      value={purgeBatchNameConfirm}
                      onChange={(e) => setPurgeBatchNameConfirm(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="forcePurgeBatch"
                      checked={purgeBatchForce}
                      onChange={(e) => setPurgeBatchForce(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="forcePurgeBatch" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Force delete even if active students are assigned
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={purgeBatchSubmitting}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {purgeBatchSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Purge Batch Record"}
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Student Directory Table for Governance & Purge */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <IconUsers className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-black text-slate-900">Enrolled Students Database Directory</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase border border-indigo-100">
                      {studentOptions.length} Enrolled
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Browse all enrolled student records to auto-select and populate purge confirmation fields.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadStudentsForPurge()}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <IconRefresh className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reload Student Data</span>
                </button>
              </div>

              {studentsLoading ? (
                <div className="p-6 text-center space-y-2">
                  <Spinner className="w-6 h-6 text-indigo-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">Loading student directory...</p>
                </div>
              ) : studentOptions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-slate-200/60">
                  No enrolled student records found in the platform database.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/30">
                  {studentOptions.map((s) => (
                    <div key={s._id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 truncate">{s.name}</p>
                          <StatusBadge status={s.isActive !== false ? "Active" : "Inactive"} />
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {s.email} {s.phone ? `\u2022 ${s.phone}` : ""} &bull; Batch: {typeof s.batch === "object" ? s.batch?.name : s.batch || "Unassigned"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID: {s._id}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForPurge(s);
                          setPurgeStudentId(s._id);
                          // SAFETY: leave the confirmation field empty — the admin
                          // must still type the exact email before this irreversible
                          // delete can proceed.
                          setPurgeStudentEmailConfirm("");
                          window.scrollTo({ top: 350, behavior: "smooth" });
                        }}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                      >
                        Select for Purge &rarr;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: SECURITY SETTINGS */}
        {/* ========================================== */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Security Governance</h2>
              <p className="text-xs text-slate-500 font-semibold">
                Manage SuperAdmin security policies and credentials.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <IconKey className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Change SuperAdmin Password</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Must be at least 8 characters long.
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
                >
                  {pwLoading ? <Spinner className="w-4 h-4 text-white" /> : "Update Security Credentials"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL 1: VIEW ADMIN PROFILE & AUDIT TRAIL */}
      {/* ========================================== */}
      <CommonModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedAdminDetail(null);
        }}
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
                <div>
                  <span className="text-slate-400 font-medium">Role:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedAdminDetail.admin.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Phone:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedAdminDetail.admin.phone || "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Recent Audit Trail Activity
              </h5>
              {!selectedAdminDetail.recentActivity || selectedAdminDetail.recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold p-4 text-center">No recent audit log history.</p>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden bg-white">
                  {selectedAdminDetail.recentActivity.map((act) => (
                    <div key={act._id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-black text-indigo-600 text-[10px] uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mr-2">
                          {act.action}
                        </span>
                        <span className="font-medium text-slate-700 truncate">
                          {act.targetEmail ? `Target: ${act.targetEmail}` : "System action"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {new Date(act.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CommonModal>

      {/* ========================================== */}
      {/* MODAL 2: CREATE ADMIN (INVITE) */}
      {/* ========================================== */}
      <CommonModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Invite New Administrator Account"
      >
        <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sujan Saha"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@examneeti.com"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
              Initial Temporary Password (Optional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to auto-generate secure temp password"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              An invitation email will be sent automatically with log in instructions.
            </p>
          </div>

          <button
            type="submit"
            disabled={createSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {createSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Send Admin Invitation"}
          </button>
        </form>
      </CommonModal>

      {/* ========================================== */}
      {/* MODAL 3: EDIT ADMIN PROFILE */}
      {/* ========================================== */}
      <CommonModal
        isOpen={Boolean(editAdmin)}
        onClose={() => setEditAdmin(null)}
        title="Edit Admin Profile Details"
      >
        <form onSubmit={handleEditAdminSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Phone Number</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={editSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {editSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Save Admin Profile Changes"}
          </button>
        </form>
      </CommonModal>

      {/* ========================================== */}
      {/* MODAL 4: DELETE ADMIN CONFIRMATION */}
      {/* ========================================== */}
      <CommonModal
        isOpen={Boolean(deleteAdminTarget)}
        onClose={() => {
          setDeleteAdminTarget(null);
          setDeleteReason("");
        }}
        title="Hard Delete Administrator Account"
      >
        <form onSubmit={handleDeleteAdminSubmit} className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 space-y-1">
            <p className="font-bold">Are you sure you want to delete this administrator account?</p>
            <p className="font-medium text-[11px]">
              Account: <span className="font-black">{deleteAdminTarget?.name}</span> ({deleteAdminTarget?.email})
            </p>
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
              Audit Reason / Justification (Optional)
            </label>
            <textarea
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Employee offboarded from company"
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 text-xs sm:text-sm p-3.5 rounded-xl sm:rounded-2xl transition-all outline-none font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={deleteSubmitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {deleteSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Confirm Permanent Account Deletion"}
          </button>
        </form>
      </CommonModal>

      {/* ========================================== */}
      {/* MODAL 5: RAW AUDIT METADATA INSPECTOR */}
      {/* ========================================== */}
      <CommonModal
        isOpen={Boolean(selectedLogMetadata)}
        onClose={() => {
          setSelectedLogMetadata(null);
          setSelectedLogItem(null);
        }}
        title="Audit Event Metadata Payload"
      >
        <div className="space-y-4">
          {selectedLogItem && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-indigo-700 uppercase tracking-wider text-[10px] bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  {selectedLogItem.action}
                </span>
                <span className="text-[10px] font-extrabold text-slate-400">
                  {new Date(selectedLogItem.createdAt).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="font-semibold text-slate-800">
                Actor: <span className="font-extrabold text-slate-900">{selectedLogItem.actor?.name || selectedLogItem.actor?.email || "System"}</span> ({selectedLogItem.actorRole || "super_admin"})
                {(selectedLogItem.target || selectedLogItem.targetEmail) && (
                  <span>
                    {" "}
                    &rarr; Target: <span className="font-extrabold text-slate-900">{selectedLogItem.target?.name || selectedLogItem.target?.email || selectedLogItem.targetEmail}</span>
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">JSON Payload Details:</p>
            <button
              onClick={() => copyToClipboard(JSON.stringify(selectedLogMetadata, null, 2), "JSON Payload")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
            >
              <IconCopy className="w-3.5 h-3.5" />
              <span>Copy JSON</span>
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
