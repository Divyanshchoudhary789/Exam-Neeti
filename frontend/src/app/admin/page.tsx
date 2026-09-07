"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { AdminDashboard } from "../../components/sections/AdminDashboard";
import { Spinner } from "../../components/common/UIComponents";

export default function AdminPage() {
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

  // Not a signed-in admin (logged out, session expired, wrong role) → send them
  // to the public landing page rather than flashing a dead-end "access denied".
  const notAdmin = isHydrated && (!user || user.role !== "admin");
  useEffect(() => {
    if (notAdmin) router.replace("/");
  }, [notAdmin, router]);

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  // Hydration loader / redirect-in-progress — never a dead-end card.
  if (!isHydrated || notAdmin) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
