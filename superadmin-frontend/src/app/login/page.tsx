"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../store/api";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconShield,
  IconUsers,
  IconChart,
  IconAlertTriangle,
  IconClock,
  IconArrowRight,
  IconBuilding,
} from "../../components/common/UIComponents";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const loginFn = useAuthStore((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      const resData = res.data;

      const backendRole: string =
        resData?.data?.user?.role || resData?.user?.role || resData?.role || "student";

      // This console is exclusively for the root system administrator account.
      // Any other role — even a regular Admin — is refused here, on purpose.
      if (backendRole !== "super_admin") {
        setError(
          "This console is restricted to Super Admin accounts. Use the main Exam Neeti site to log in as a Student or Admin."
        );
        setLoading(false);
        return;
      }

      const accessToken: string | null = resData?.data?.accessToken || resData?.accessToken || null;
      const userName: string = resData?.data?.user?.name || resData?.user?.name || email.split("@")[0];
      const userId: string | undefined =
        resData?.data?.user?._id || resData?.data?.user?.id || resData?.user?._id || resData?.user?.id;

      loginFn(userName, email, "super_admin", accessToken ?? undefined, { id: userId });

      if (rememberMe) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        document.cookie = `sa-auth-role=super_admin; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
      } else {
        document.cookie = `sa-auth-role=super_admin; path=/; SameSite=Lax`;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        "Login failed. Please check your credentials.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full flex flex-col lg:flex-row bg-white overflow-x-hidden">
      {/* ── Left brand panel (desktop only) ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black flex-col justify-between px-12 xl:px-16 py-12 text-white">
        <div className="absolute -left-24 -top-24 w-[420px] h-[420px] bg-indigo-500/[0.12] rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute right-[-10%] bottom-[-10%] w-[380px] h-[380px] bg-violet-500/[0.10] rounded-full blur-[110px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3.5 w-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-white/10 p-1.5 shadow-sm shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://iili.io/Clw9yIj.png" alt="Exam Neeti Logo" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans text-[20px] font-black tracking-tight leading-none">
              Exam <span className="text-indigo-400">Neeti</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-slate-400 mt-1">
              Super Admin Console
            </span>
          </div>
        </div>

        {/* Heading + governance cards */}
        <div className="relative z-10 max-w-md space-y-6">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
              <IconShield className="w-3.5 h-3.5" />
              Root System Access
            </span>
            <h1 className="font-display text-3xl xl:text-4xl font-black tracking-tight leading-[1.15]">
              Full control. <br /> Full <span className="text-indigo-400">accountability.</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              Manage institutes, admins, question banks, and platform-wide governance from one console.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: IconBuilding, label: "Institutes Live", value: "24" },
              { icon: IconUsers, label: "Admin Accounts", value: "86" },
              { icon: IconChart, label: "System Uptime", value: "99.9%" },
              { icon: IconClock, label: "Audit Events / day", value: "1.2K" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/[0.04] backdrop-blur border border-white/10 p-4">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center mb-2.5">
                  <item.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-black tracking-tight">{item.value}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <IconAlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-semibold text-slate-300 leading-relaxed">
              This console can create/suspend admin accounts and purge platform data. Every action is written to the audit trail.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-[11px] font-semibold text-slate-500">
          © {new Date().getFullYear()} Exam Neeti. Restricted access — authorized personnel only.
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative bg-white">
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-10">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 p-1 shadow-sm shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://iili.io/Clw9yIj.png" alt="Exam Neeti Logo" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-sans text-sm font-black tracking-tight text-slate-900 leading-none">
                  Exam <span className="text-indigo-600">Neeti</span>
                </span>
                <span className="text-[9px] font-semibold tracking-wide text-slate-500 mt-0.5">
                  Super Admin Console
                </span>
              </div>
            </div>

            <div className="mb-6 text-center lg:text-left space-y-1.5">
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Root Sign-In
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Restricted to Super Admin accounts only.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label htmlFor="sa-email" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block ml-1">
                  Email Address
                </label>
                <div className="relative flex items-center group">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <IconMail className="w-4 h-4" />
                  </div>
                  <input
                    id="sa-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="root@examneeti.com"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm pl-10 pr-4 py-3 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="sa-password" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block ml-1">
                  Password
                </label>
                <div className="relative flex items-center group">
                  <div className="absolute left-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <IconLock className="w-4 h-4" />
                  </div>
                  <input
                    id="sa-password"
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm pl-10 pr-10 py-3 focus:bg-white focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 ml-1 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-500">Keep me signed in on this device</span>
              </label>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <IconArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-slate-100 flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <IconShield className="w-3.5 h-3.5 text-slate-400" />
                <span>Every sign-in attempt is logged to the audit trail</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
