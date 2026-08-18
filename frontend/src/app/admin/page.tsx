"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
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

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f3f5f9] flex items-center justify-center">
        <Spinner className="w-10 h-10 text-indigo-600" />
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans select-none antialiased">
        <Navbar currentView="home" />
        <div className="flex-grow flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="max-w-md p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xl">
            <h2 className="text-2xl font-black text-slate-900">Admin Access Required</h2>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Please log in as an Administrator to access this panel.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-lg"
            >
              Return to Landing Page
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
