"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { api } from "../../store/api";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconGraduationCap,
  IconBuilding,
  IconRocket,
} from "../common/UIComponents";
import BrandLogo from "../common/BrandLogo";
import GoogleSignInButton from "../common/GoogleSignInButton";

// Super Admin accounts sign in through their own dedicated console, not this site.
const SUPERADMIN_CONSOLE_URL =
  process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3100";

function IconAlertTriangle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

// Four-pointed sparkle mark used by the analytics hero overlays.
function IconSpark({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c.5 4.5 3 7 7.5 7.5-4.5.5-7 3-7.5 7.5-.5-4.5-3-7-7.5-7.5C9 9 11.5 6.5 12 2z" />
    </svg>
  );
}

// Stethoscope & Medical Watermark Graphic (Vector Background)
function MedicalWatermarkBg() {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.40]">
      {/* Stethoscope silhouette line art */}
      <svg
        className="absolute right-4 top-[14%] w-64 sm:w-72 h-64 sm:h-72 text-indigo-200/70 stroke-current"
        viewBox="0 0 200 200"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 60 40 C 60 70, 75 95, 100 95 C 125 95, 140 70, 140 40" />
        <path d="M 50 35 L 70 35 M 130 35 L 150 35" />
        <path d="M 100 95 L 100 135 C 100 155, 120 165, 140 165 C 160 165, 170 155, 170 140" />
        <circle cx="170" cy="135" r="10" />
        <circle cx="170" cy="135" r="4" fill="currentColor" />
      </svg>

      {/* DNA Helix strand line art */}
      <svg
        className="absolute left-[4%] bottom-[16%] w-44 h-44 text-indigo-200/60 stroke-current"
        viewBox="0 0 100 100"
        fill="none"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M 20 15 Q 35 30, 20 45 T 20 75 T 20 95" />
        <path d="M 40 15 Q 25 30, 40 45 T 40 75 T 40 95" />
        <line x1="20" y1="20" x2="40" y2="20" />
        <line x1="22" y1="35" x2="38" y2="35" />
        <line x1="20" y1="50" x2="40" y2="50" />
        <line x1="22" y1="65" x2="38" y2="65" />
        <line x1="20" y1="80" x2="40" y2="80" />
      </svg>

      {/* Subtle plus cross marks */}
      <span className="absolute left-[10%] top-[8%] text-indigo-300/40 text-xl font-black">+</span>
      <span className="absolute left-[18%] top-[16%] text-indigo-300/30 text-base font-black">+</span>
      <span className="absolute left-[6%] top-[38%] text-indigo-300/30 text-lg font-black">+</span>
      <span className="absolute right-[6%] bottom-[24%] text-indigo-300/40 text-2xl font-black">+</span>
    </div>
  );
}

/**
 * Left-panel showcase: the aspirant-at-work illustration (served from
 * /public) with a few floating analytics chips layered on top, mirroring the
 * product's own dashboard cues.
 */
function AnalyticsHeroVisual() {
  const orbitNodes = [
    { label: "Analyze", cls: "left-1/2 top-2 -translate-x-1/2" },
    { label: "Plan", cls: "right-2 top-1/2 -translate-y-1/2" },
    { label: "Execute", cls: "left-1/2 bottom-2 -translate-x-1/2" },
  ];

  return (
    <div className="relative w-full max-w-[520px] pt-1">
      <div className="overflow-hidden rounded-[26px] ring-1 ring-slate-900/[0.06] shadow-[0_24px_60px_-18px_rgba(30,41,120,0.28)]">
        <Image
          src="/hero-laptop-student.png"
          alt="NEET aspirant reviewing a personalized analytics dashboard"
          width={1024}
          height={1024}
          priority
          sizes="(max-width: 1024px) 90vw, 520px"
          className="h-auto w-full select-none"
        />
      </div>

      {/* Score Improvement — top-left */}
      <div className="absolute -left-4 top-8 w-[196px] rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 shadow-[0_14px_36px_-8px_rgba(30,41,120,0.22)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[11px] font-semibold text-slate-500">Score Improvement</span>
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
            </svg>
            +32%
          </span>
        </div>
        <svg viewBox="0 0 170 34" className="mt-1.5 h-8 w-full overflow-visible">
          <polyline
            points="4,29 30,24 54,26 80,16 104,19 132,9 166,4"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="166" cy="4" r="3" className="fill-[#4338ca]" />
        </svg>
      </div>

      {/* Predicted Score — top-right */}
      <div className="absolute -right-4 top-6 rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 shadow-[0_14px_36px_-8px_rgba(30,41,120,0.22)] backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <IconSpark className="h-3.5 w-3.5 text-indigo-500" />
          Predicted Score
        </div>
        <p className="mt-0.5 text-[22px] font-black tracking-tight text-[#4338ca]">92%</p>
      </div>

      {/* Next focus — lower-left */}
      <div className="absolute -left-4 bottom-12 flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 shadow-[0_14px_36px_-8px_rgba(30,41,120,0.22)] backdrop-blur-md">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </span>
        <div className="leading-tight">
          <p className="text-[10.5px] font-medium text-slate-400">Next focus</p>
          <p className="text-[13px] font-black text-slate-900">Thermodynamics</p>
        </div>
      </div>

      {/* Analyze → Plan → Execute → Improve loop — lower-right */}
      <div className="absolute -right-5 bottom-2 h-[156px] w-[190px] rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_16px_40px_-8px_rgba(30,41,120,0.24)] backdrop-blur-md">
        <div className="absolute inset-x-0 inset-y-[26px] mx-auto aspect-square rounded-full border border-dashed border-indigo-300/80" />
        <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#4338ca] shadow-lg shadow-indigo-500/30" />
        <span className="absolute left-2.5 top-1/2 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#4338ca] shadow-md">
          Improve <IconSpark className="h-2.5 w-2.5 text-indigo-500" />
        </span>
        {orbitNodes.map((n) => (
          <span
            key={n.label}
            className={`absolute ${n.cls} rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-md`}
          >
            {n.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const loginFn = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [superAdminBlocked, setSuperAdminBlocked] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [accountType, setAccountType] = useState<"student" | "admin">("student");
  const [remember, setRemember] = useState(true);

  // Shared: take an auth response (from /auth/login or /auth/google), hydrate
  // the store + role cookie, and route to the right dashboard.
  const finishLogin = (resData: unknown, fallbackName: string) => {
    const d = resData as {
      data?: { user?: Record<string, unknown>; accessToken?: string };
      user?: Record<string, unknown>;
      accessToken?: string;
      role?: string;
    };
    const u = d?.data?.user || d?.user || {};

    const backendRole =
      (u.role as string) || d?.role || "student";

    // Super Admin accounts do not operate from the main site — their console is
    // the separate Super Admin app. Refuse the session here and point them to it.
    if (backendRole === "super_admin") {
      setSuperAdminBlocked(true);
      return;
    }

    let role: "student" | "admin" | "super_admin" = "student";
    if (backendRole === "super_admin") role = "super_admin";
    else if (backendRole === "admin") role = "admin";

    const accessToken = d?.data?.accessToken || d?.accessToken || undefined;
    const userName = (u.name as string) || fallbackName;
    const userEmail = (u.email as string) || identifier || fallbackName;
    const userId = (u._id as string) || (u.id as string) || undefined;

    const rawBatch =
      (u.batch as { _id?: string })?._id || (u.batch as string) || undefined;
    const batchId = rawBatch ? String(rawBatch) : undefined;

    loginFn(userName, userEmail, role, accessToken, { id: userId, batchId });

    const expires = new Date();
    expires.setDate(expires.getDate() + 14);
    document.cookie = `auth-role=${role}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;

    if (role === "super_admin") router.push("/superadmin");
    else if (role === "admin") router.push("/admin");
    else router.push("/student");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in both email/mobile and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email: identifier.trim(),
        password,
        portal: accountType,
      });
      finishLogin(res.data, identifier.split("@")[0]);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        "Invalid email/mobile number or password. Please try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/google", { credential, portal: accountType });
      finishLogin(res.data, "there");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        errorObj?.response?.data?.message ||
          errorObj?.message ||
          "Google sign-in failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-x-hidden font-sans">
      {/* ── LEFT HERO / DIAGNOSTICS BRAND PANEL ───────────────────────── */}
      <div className="hidden lg:flex w-full lg:w-[58%] xl:w-[60%] relative bg-gradient-to-br from-[#f8faff] via-[#f1f4fe] to-[#edf2fe] border-b lg:border-b-0 lg:border-r border-slate-200/80 flex-col justify-between p-6 sm:p-10 lg:py-10 lg:pl-24 lg:pr-8 xl:py-12 xl:pl-32 xl:pr-10 2xl:pl-40 2xl:pr-12 overflow-hidden">
        {/* Soft background ambient blurs */}
        <div className="absolute -left-20 -top-20 w-[420px] h-[420px] bg-indigo-400/[0.12] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-violet-400/[0.10] rounded-full blur-[100px] pointer-events-none" />

        {/* Medical & DNA Watermark Background Graphic */}
        <MedicalWatermarkBg />

        <div className="relative z-10 space-y-6 sm:space-y-7 max-w-[550px] w-full mx-auto lg:mx-0">
          {/* Brand */}
          <BrandLogo href="/" size="lg" />

          {/* Headline & Subtitle matching mockup */}
          <div className="space-y-2">
            <h1 className="font-script pt-8 text-[42px] sm:text-[50px] xl:text-[56px] font-bold text-slate-900 leading-[1.06] tracking-tight">
              Hi Doc <br />
              <span className="text-[#4338ca] text-indigo-600 inline-flex items-center gap-2">
                in the making 
              </span>
            </h1>
            <div className="pt-1.5 space-y-0.5">
              <p className="text-base sm:text-[18px] font-bold text-slate-900 leading-snug">
                Let&apos;s see where you stand.
              </p>
              <p className="text-base sm:text-[18px] font-bold text-slate-900 leading-snug">
                And figure out what comes next.
              </p>
            </div>
          </div>

          {/* Analytics dashboard hero visual */}
          <AnalyticsHeroVisual />
        </div>

        {/* Bottom subtle copyright note on left side */}
        <div className="relative z-10 pt-6 text-[11px] font-medium text-slate-400">
          © {new Date().getFullYear()} Exam Neeti. Every Score Has a Strategy.
        </div>
      </div>

      {/* ── RIGHT LOGIN FORM PANEL ────────────────────────────────────── */}
      <div className="w-full lg:w-[42%] xl:w-[40%] min-h-screen relative flex flex-col items-center justify-center bg-gradient-to-br from-[#f6f8ff] via-[#eef1fe] to-[#e8ecfe] px-4 sm:px-8 lg:px-10 xl:px-14 py-8 sm:py-12">
        {/* Back to home */}
        <div className="w-full max-w-[440px] mb-4 sm:mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <IconArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Card */}
        <div className="w-full max-w-[440px] rounded-3xl bg-white border border-slate-200/70 shadow-[0_24px_70px_-20px_rgba(30,41,120,0.22)] p-6 sm:p-8">
          {/* Brand */}
          <div className="mb-6">
            <BrandLogo href="/" size="md" />
          </div>

          {/* Heading */}
          <div className="space-y-1.5 mb-6">
            <h2 className="font-display text-[26px] sm:text-[30px] font-black tracking-tight text-slate-900 leading-tight">
              Log in to your account
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Your personalized strategy is waiting.
            </p>
          </div>

          {/* Account type toggle */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(["student", "admin"] as const).map((r) => {
              const active = accountType === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAccountType(r)}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                    active
                      ? "border-[#4338ca] bg-indigo-50/70 ring-2 ring-indigo-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      active ? "bg-[#4338ca] text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {r === "student" ? (
                      <IconGraduationCap className="w-[18px] h-[18px]" />
                    ) : (
                      <IconBuilding className="w-[18px] h-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-black leading-tight ${
                        active ? "text-[#4338ca]" : "text-slate-700"
                      }`}
                    >
                      {r === "student" ? "Student" : "Admin"}
                    </p>
                    <p className="text-[10.5px] text-slate-400 font-medium truncate mt-0.5">
                      {r === "student" ? "Track my prep" : "Institute administration"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {superAdminBlocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center space-y-3.5 animate-fadeIn">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <IconRocket className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900">Super Admin sign-in has moved</p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Root platform governance now runs from the dedicated Super Admin Console. Please sign in there instead.
                </p>
              </div>
              <a
                href={SUPERADMIN_CONSOLE_URL}
                className="inline-flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Open Super Admin Console <IconArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setSuperAdminBlocked(false)}
                className="block w-full text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 flex items-start gap-2.5 animate-fadeIn"
              >
                <IconAlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email / Mobile Number Field */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="login-identifier"
                className="text-[13px] font-bold text-slate-800 block ml-0.5"
              >
                Email
              </label>
              <div className="relative flex items-center group">
                <div className="absolute left-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <IconMail className="w-4 h-4" />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-white border border-slate-200 text-slate-900 text-sm pl-10 pr-4 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="login-password"
                className="text-[13px] font-bold text-slate-800 block ml-0.5"
              >
                Password
              </label>
              <div className="relative flex items-center group">
                <div className="absolute left-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <IconLock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl bg-white border border-slate-200 text-slate-900 text-sm pl-10 pr-11 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                aria-pressed={remember}
                className="inline-flex items-center gap-2 cursor-pointer select-none"
              >
                <span
                  className={`h-[18px] w-[18px] rounded-md border flex items-center justify-center transition-colors ${
                    remember ? "bg-[#4338ca] border-[#4338ca]" : "border-slate-300 bg-white"
                  }`}
                >
                  {remember && <IconCheck className="w-3 h-3 text-white" />}
                </span>
                <span className="text-[13px] font-semibold text-slate-500">Remember me</span>
              </button>
              <Link
                href="/forgot-password"
                className="text-[13px] font-bold text-[#4338ca] hover:text-indigo-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !identifier || !password}
              className="w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#4338ca] hover:from-[#4338ca] hover:to-[#3730a3] disabled:opacity-50 disabled:cursor-not-allowed py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <>
                  <span>Log in</span>
                  <IconArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              or continue with
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Google */}
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={setError}
            disabled={loading}
            text="continue_with"
          />
          </>
          )}

          {/* Sign up */}
          <p className="mt-6 text-center text-sm font-medium text-slate-500">
            New to Exam Neeti?{" "}
            <Link
              href="/register"
              className="font-bold text-[#4338ca] hover:text-indigo-700 transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>

        {/* Footer note */}
        <p className="w-full max-w-[440px] mt-5 text-center text-[11px] font-medium text-slate-400 leading-relaxed px-2">
          Protected by AI-grade encryption. By logging in you agree to our Terms &amp; Privacy
          Policy.
        </p>
      </div>
    </div>
  );
}
