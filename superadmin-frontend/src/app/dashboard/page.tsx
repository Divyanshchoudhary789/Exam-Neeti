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

  useEffect(() => {
    if (!hydrationRef.current) {
      hydrationRef.current = true;
      setIsHydrated(true);
    }
  }, []);

  const handleLogout = () => {
    logout();
    document.cookie = "auth-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    router.push("/login");
  };

  // Show spinner while Zustand rehydrates from localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  // Middleware already blocks non-super_admin cookies from reaching this route,
  // but Zustand's own state (post-refresh, pre-rehydration edge cases) gets a
  // second, client-side check before the dashboard — and a real destination to
  // recover to if it ever disagrees with the cookie.
  if (!user || user.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center py-24 px-4 text-center font-sans">
        <div className="max-w-md p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto">
            <span className="text-amber-600 font-black text-xl">!</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">Super Admin Access Required</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            This console is restricted to Root System Administrators only.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-lg"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return <SuperAdminDashboard onLogout={handleLogout} />;
}
