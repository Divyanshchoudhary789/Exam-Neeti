// Shared types + formatters for the super-admin governance panels
// (Admin Team, Audit Trail). Extracted from the original single-file
// SuperAdminDashboard so the panels can live on their own.

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "super_admin";
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuditLogItem {
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

export function formatRelativeTime(dateString: string): string {
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

export function getActionBadgeStyle(action: string) {
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
