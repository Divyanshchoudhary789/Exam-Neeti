"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { SuperAdminDashboard } from "../../components/dashboard/SuperAdminDashboard";
import { Spinner } from "../../components/common/UIComponents";

// Where a signed-out super admin lands — the public site's landing page.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

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
    logout();
    document.cookie = "sa-auth-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    // Full navigation to the public landing page (different origin from this console).
    window.location.assign(`${SITE_URL}/`);
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
