"use client";

import { AdminDashboard } from "./AdminDashboard";
import { SuperAdminDashboard } from "./SuperAdminDashboard";

interface RoleDashboardProps {
  role: "student" | "admin" | "superadmin" | "super_admin";
  onLogout: () => void;
}

export function RoleDashboard({ role, onLogout }: RoleDashboardProps) {
  if (role === "admin") {
    return <AdminDashboard onLogout={onLogout} />;
  }

  if (role === "superadmin" || role === "super_admin") {
    return <SuperAdminDashboard onLogout={onLogout} />;
  }

  // Fallback or student render if needed
  return null;
}
