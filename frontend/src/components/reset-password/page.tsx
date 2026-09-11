"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authService } from "../../services/apiServices";
import { Navbar } from "../navbar";
import { Footer } from "../footer";
import BrandLogo from "../common/BrandLogo";

export default function ResetPassword() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleOpenAuth = (type: "login" | "join") => {
    router.push(type === "login" ? "/login" : "/register");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new link and try again.");
      return;
    }
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        errorObj?.response?.data?.message ||
          errorObj?.message ||
          "This reset link is invalid or has expired. Please request a new one."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none antialiased">
      <Navbar onOpenAuth={handleOpenAuth} currentView="resources" />

      <main className="flex-grow flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#5a4bfc]/10 to-indigo-400/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-[2.5rem] p-8 sm:p-10 shadow-xl shadow-slate-200/50 z-10">
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="transition-transform hover:scale-105">
              <BrandLogo iconOnly size="lg" href={null} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 font-sans">
                Set a <span className="text-[#5a4bfc]">new password</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                Choose a strong password you don&apos;t use anywhere else. You&apos;ll be signed out of all devices.
              </p>
            </div>
          </div>

          {done ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center text-xs sm:text-sm text-emerald-800 space-y-1">
                <div className="flex items-center justify-center gap-2 font-bold text-emerald-700">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Password updated</span>
                </div>
                <p className="opacity-90">Your password has been reset. Please sign in with your new password.</p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full rounded-xl bg-[#5a4bfc] hover:bg-[#6c5eff] active:scale-[0.99] py-3.5 text-xs sm:text-sm font-bold text-white transition-all shadow-lg shadow-[#5a4bfc]/25 cursor-pointer"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-center text-xs sm:text-sm text-rose-800 space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 font-bold text-rose-700">
                    <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Unable to reset</span>
                  </div>
                  <p className="opacity-90">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block ml-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm pl-4 pr-11 py-3 focus:border-[#5a4bfc] focus:bg-white focus:ring-2 focus:ring-[#5a4bfc]/10 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block ml-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm px-4 py-3 focus:border-[#5a4bfc] focus:bg-white focus:ring-2 focus:ring-[#5a4bfc]/10 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
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
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3 text-center">
                <button
                  onClick={() => router.push("/forgot-password")}
                  className="text-xs font-bold text-[#5a4bfc] hover:text-[#6c5eff] transition-colors cursor-pointer"
                >
                  Need a new link? Request another
                </button>
                <button
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Login</span>
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
