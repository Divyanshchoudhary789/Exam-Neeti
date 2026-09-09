"use client";

import React, { useState } from "react";
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
  IconClipboard,
  IconThumbsUp,
  IconRocket,
  IconBulb,
} from "../common/UIComponents";
import BrandLogo from "../common/BrandLogo";
import GoogleSignInButton from "../common/GoogleSignInButton";

// Super Admin accounts sign in through their own dedicated console, not this site.
const SUPERADMIN_CONSOLE_URL =
  process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3100";

// Waving Hand Vector Icon matching the mockup
function IconWave({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M26 6C28 8.5 29 11.5 29 15" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 3C26 6 27.5 9.5 27.5 13.5" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M11 12.5V5.5C11 4.4 11.9 3.5 13 3.5C14.1 3.5 15 4.4 15 5.5V11M15 8.5C15 7.4 15.9 6.5 17 6.5C18.1 6.5 19 7.4 19 8.5V12M19 10C19 8.9 19.9 8 21 8C22.1 8 23 8.9 23 10V15C23 19.5 19.5 23 15 23C10.5 23 7 19.5 7 15V11C7 9.9 7.9 9 9 9C10.1 9 11 9.9 11 11V12.5"
        stroke="#d97706"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#fde68a"
      />
    </svg>
  );
}

function IconAlertTriangle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

// Sparkline line chart with vertex dots for "Your Last Test" card matching image
function TestTrendLine() {
  const points = [
    { x: 4, y: 22 },
    { x: 16, y: 20 },
    { x: 28, y: 15 },
    { x: 40, y: 17 },
    { x: 52, y: 10 },
    { x: 64, y: 12 },
    { x: 76, y: 6 },
    { x: 92, y: 3 },
  ];
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 96 26" className="w-24 sm:w-28 h-6 sm:h-7 shrink-0 overflow-visible">
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#818cf8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-30"
      />
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#4338ca"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r={idx === points.length - 1 ? "2.5" : "1.8"}
          className={idx === points.length - 1 ? "fill-[#4338ca] stroke-white stroke-1" : "fill-[#6366f1]"}
        />
      ))}
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

// Flow connector curved dashed arrows linking the cards
function FlowConnectors() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 540 280"
    >
      <defs>
        <marker
          id="arrow-purple"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
        </marker>
      </defs>

      {/* Path 1: Card 1 (Your Last Test) -> Card 2 (Accuracy) */}
      <path
        d="M 310 55 C 345 55, 360 48, 385 52"
        fill="none"
        stroke="#c7d2fe"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        markerEnd="url(#arrow-purple)"
      />

      {/* Path 2: Card 2 (Accuracy) -> Card 5 (Next Move) */}
      <path
        d="M 450 85 C 490 105, 490 135, 470 155"
        fill="none"
        stroke="#c7d2fe"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        markerEnd="url(#arrow-purple)"
      />

      {/* Path 3: Card 5 (Next Move) -> Card 4 (Focus Areas) */}
      <path
        d="M 425 245 C 375 260, 310 255, 290 235"
        fill="none"
        stroke="#c7d2fe"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        markerEnd="url(#arrow-purple)"
      />

      {/* Path 4: Card 1 -> Card 3 (Top Strength) */}
      <path
        d="M 115 110 C 95 130, 85 145, 80 155"
        fill="none"
        stroke="#c7d2fe"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        markerEnd="url(#arrow-purple)"
      />
    </svg>
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

          {/* Connected Flow Visual Cards Container */}
          <div className="relative pt-1 pb-1">
            {/* Desktop Dotted Flow Connectors */}
            <div className="hidden sm:block">
              <FlowConnectors />
            </div>

            <div className="relative z-10 flex flex-col gap-3.5 max-w-[540px]">
              {/* Top Row: Card 1 (Your Last Test) + Card 2 (Accuracy) */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3.5">
                {/* Card 1: Your Last Test */}
                <div className="flex-1 sm:w-[320px] rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_6px_18px_rgba(0,0,0,0.03)] p-4 transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <IconClipboard className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Your Last Test</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-[26px] font-black tracking-tight text-[#4338ca] leading-none">
                      645
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-400">/ 720</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span>↗ 33 marks</span>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">Percentile</p>
                      <p className="text-xs sm:text-[13px] font-black text-slate-800 leading-tight">92.4%</p>
                    </div>
                    <TestTrendLine />
                  </div>
                </div>

                {/* Card 2: Accuracy */}
                <div className="w-full sm:w-[155px] rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_6px_18px_rgba(0,0,0,0.03)] p-4 flex flex-col justify-between transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="8" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-700">Accuracy</span>
                  </div>
                  <div className="my-1.5">
                    <p className="text-2xl sm:text-[26px] font-black text-slate-900 leading-none">82%</p>
                    <p className="text-xs font-bold text-emerald-600 mt-1">Good job!</p>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Card 3 (Top Strength) + Card 4 (Focus Areas) + Card 5 (Next Move) */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3.5">
                {/* Card 3: Top Strength */}
                <div className="w-full sm:w-[130px] rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_6px_18px_rgba(0,0,0,0.03)] p-3.5 flex flex-col justify-between transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.06)] shrink-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <IconThumbsUp className="w-3 h-3" />
                    </div>
                    <span className="text-[10.5px] font-bold text-slate-600 leading-tight">Top Strength</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-600 leading-tight">Biology</p>
                    <p className="text-[9.5px] text-slate-400 font-medium leading-tight mt-0.5">Your strongest subject</p>
                    <p className="text-base font-black text-slate-900 mt-1">78%</p>
                  </div>
                </div>

                {/* Card 4: Focus Areas */}
                <div className="flex-1 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_6px_18px_rgba(0,0,0,0.03)] p-3.5 space-y-2 transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">Focus Areas</span>
                  </div>
                  <div className="space-y-1.5 text-[10.5px]">
                    {/* Item 1 */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-700 truncate">Physics – Mechanics</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden inline-block">
                          <span className="block h-full w-[58%] bg-amber-400 rounded-full" />
                        </span>
                        <span className="font-bold text-amber-600 w-6 text-right">58%</span>
                      </div>
                    </div>
                    {/* Item 2 */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-700 truncate">Chemistry – Organic</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden inline-block">
                          <span className="block h-full w-[62%] bg-amber-500 rounded-full" />
                        </span>
                        <span className="font-bold text-amber-600 w-6 text-right">62%</span>
                      </div>
                    </div>
                    {/* Item 3 */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-700 truncate">Physics – Kinematics</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden inline-block">
                          <span className="block h-full w-[45%] bg-rose-500 rounded-full" />
                        </span>
                        <span className="font-bold text-rose-600 w-6 text-right">45%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 5: Next Move */}
                <div className="w-full sm:w-[155px] rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_6px_18px_rgba(0,0,0,0.03)] p-3.5 flex flex-col justify-between transition-all hover:shadow-[0_10px_24px_rgba(0,0,0,0.06)] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <IconRocket className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">Next Move</span>
                  </div>
                  <div className="my-1">
                    <p className="text-xs sm:text-[13px] font-black text-[#4338ca] leading-tight truncate">Kinematics</p>
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 font-bold text-[8.5px] uppercase tracking-wide">
                      High Priority
                    </span>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-800 leading-tight">12 Questions</p>
                    <p className="text-[9px] text-slate-400 font-medium leading-tight">Suggested Practice</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Strategy Callout Banner matching mockup */}
          <div className="max-w-[540px] rounded-2xl bg-white/90 backdrop-blur-md border border-indigo-100/90 shadow-sm p-3.5 sm:p-4 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
              <IconBulb className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-[12.5px] font-semibold text-slate-600 leading-relaxed">
              We turn your test data into a personalized strategy, so every test brings you{" "}
              <span className="text-[#4338ca] font-bold">closer to your goal.</span>
            </p>
          </div>
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
