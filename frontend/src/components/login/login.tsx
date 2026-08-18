"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../store/api";
import { IconCross, Spinner } from "../common/UIComponents";

interface LoginProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export function Login({ isOpen, onClose }: LoginProps) {
  const router    = useRouter();
  const loginFn   = useAuthStore((state) => state.login);
  const emailRef  = useRef<HTMLInputElement>(null);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  // Lock body scroll while open; focus first field
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => emailRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "unset";
      setError("");
      setEmail("");
      setPassword("");
      setShowPass(false);
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res     = await api.post("/auth/login", { email, password });
      const resData = res.data;

      // Use ONLY the backend role — never infer from email address
      const backendRole: string =
        resData?.data?.user?.role ||
        resData?.user?.role        ||
        resData?.role              ||
        "student";

      let role: "student" | "admin" | "super_admin" = "student";
      if (backendRole === "super_admin") role = "super_admin";
      else if (backendRole === "admin")  role = "admin";
      else                               role = "student";

      const accessToken: string | null =
        resData?.data?.accessToken ||
        resData?.accessToken       ||
        null;

      const userName: string =
        resData?.data?.user?.name ||
        resData?.user?.name       ||
        email.split("@")[0];

      const userId: string | undefined =
        resData?.data?.user?._id ||
        resData?.data?.user?.id  ||
        resData?.user?._id       ||
        resData?.user?.id;

      const rawBatch =
        resData?.data?.user?.batch?._id ||
        resData?.data?.user?.batch      ||
        resData?.user?.batch?._id       ||
        resData?.user?.batch;
      const batchId: string | undefined = rawBatch ? String(rawBatch) : undefined;

      loginFn(userName, email, role, accessToken ?? undefined, { id: userId, batchId });

      // Write a client-readable cookie so Next.js Edge middleware can enforce
      // route protection without Zustand/localStorage access.
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      document.cookie = `auth-role=${role}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;

      onClose();

      if (role === "super_admin") router.push("/superadmin");
      else if (role === "admin")  router.push("/admin");
      else                        router.push("/student");

    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        errorObj?.response?.data?.message ||
        errorObj?.message                 ||
        "Login failed. Please check your credentials.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white text-slate-900 shadow-2xl z-10 p-6 sm:p-8">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
          <div>
            <h3
              id="login-title"
              className="font-sans text-xl sm:text-2xl font-black tracking-tight text-slate-900"
            >
              Welcome Back
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Log in to access your Exam Neeti workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Close login dialog"
          >
            <IconCross className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div className="space-y-4 text-left">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block"
              >
                Email Address
              </label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm px-4 py-3 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { onClose(); router.push("/forgot-password"); }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm px-4 py-3 pr-10 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? <Spinner className="w-4 h-4 text-white" /> : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
