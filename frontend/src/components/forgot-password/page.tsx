"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../store/api";
import { Navbar } from "../navbar";
import { Footer } from "../footer";
import { Login } from "../login/login";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [authModal, setAuthModal] = useState<"login" | "join" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await api.post("/auth/forgot-password", { email });
      const resData = res.data;

      const message =
        resData?.message ||
        resData?.data?.message ||
        "Password reset link has been sent to your email address.";

      setSuccessMsg(message);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      console.error("Forgot password error:", err);
      const errMsg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        "Failed to send password reset request. Please check your email and try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* Website Navigation Bar */}
      <Navbar onOpenAuth={setAuthModal} currentView="resources" />

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative Background Accents */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#5a4bfc]/10 to-indigo-400/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Card Container */}
        <div className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-[2.5rem] p-8 sm:p-10 shadow-xl shadow-slate-200/50 z-10">
          
          {/* Brand Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 p-2 shadow-sm shrink-0 transition-transform hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://iili.io/Clw9yIj.png"
                alt="Exam Neeti Logo"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 font-sans">
                Forgot <span className="text-[#5a4bfc]">Password?</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                Every Score Has a Strategy. Enter your registered email to receive reset instructions.
              </p>
            </div>
          </div>

          {/* Success Message Banner */}
          {successMsg && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center text-xs sm:text-sm text-emerald-800 space-y-1 animate-fadeIn">
              <div className="flex items-center justify-center gap-2 font-bold text-emerald-700">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Reset Link Dispatched</span>
              </div>
              <p className="opacity-90">{successMsg}</p>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-center text-xs sm:text-sm text-rose-800 space-y-1 animate-fadeIn">
              <div className="flex items-center justify-center gap-2 font-bold text-rose-700">
                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Unable to Send</span>
              </div>
              <p className="opacity-90">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block ml-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm pl-10 pr-4 py-3 focus:border-[#5a4bfc] focus:bg-white focus:ring-2 focus:ring-[#5a4bfc]/10 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#5a4bfc] hover:bg-[#6c5eff] active:scale-[0.99] disabled:opacity-50 py-3.5 text-xs sm:text-sm font-bold text-white transition-all shadow-lg shadow-[#5a4bfc]/25 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>
          </form>

          {/* Action Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3 text-center">
            <button
              onClick={() => setAuthModal("login")}
              className="text-xs font-bold text-[#5a4bfc] hover:text-[#6c5eff] transition-colors cursor-pointer"
            >
              Remember your password? Log In
            </button>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Home</span>
            </button>
          </div>

        </div>
      </main>

      {/* Website Footer */}
      <Footer />

      {/* Login Modal */}
      <Login
        isOpen={authModal === "login"}
        onClose={() => setAuthModal(null)}
        onSwitchToRegister={() => setAuthModal("join")}
      />
    </div>
  );
}