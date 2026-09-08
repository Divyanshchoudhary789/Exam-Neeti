"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { SuperAdminDashboard } from "../../components/dashboard/SuperAdminDashboard";
import { Spinner } from "../../components/common/UIComponents";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrationRef = useRef(false);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!hydrationRef.current) {
      hydrationRef.current = true;
      setIsHydrated(true);
    }
  }, []);

  const handleLogout = () => {
    loggingOutRef.current = true;
    // Clears local auth state, the sa-auth-role cookie, and invalidates the
    // server-side refresh token (see useAuthStore.logout).
    logout();
    // A super admin signs out to THIS console's own login page — not the
    // public student/admin site. Full navigation so React state, the in-memory
    // token and any cached RSC payloads are all torn down.
    window.location.assign("/login");
  };

  // Wrong role / expired session (not a deliberate logout) → back to the
  // console's own sign-in. Never flash a dead-end "access denied" card.
  const notSuperAdmin = isHydrated && (!user || user.role !== "super_admin");
  useEffect(() => {
    if (notSuperAdmin && !loggingOutRef.current) router.replace("/login");
  }, [notSuperAdmin, router]);

  if (!isHydrated || notSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  return <SuperAdminDashboard onLogout={handleLogout} />;
}
