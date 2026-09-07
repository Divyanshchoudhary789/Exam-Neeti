"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { authService, RegisterPayload } from "../../services/apiServices";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconGraduationCap,
  IconRocket,
  IconPhone,
  IconAlertTriangle,
} from "../common/UIComponents";
import BrandLogo from "../common/BrandLogo";
import GoogleSignInButton from "../common/GoogleSignInButton";

function IconBrain({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4a3.5 3.5 0 0 0-3.5 3.5v.5A3 3 0 0 0 4 11a3 3 0 0 0 1.2 2.4A3.5 3.5 0 0 0 8.5 20h1a.5.5 0 0 0 .5-.5V4.5A.5.5 0 0 0 9.5 4Z" />
      <path d="M14.5 4a3.5 3.5 0 0 1 3.5 3.5v.5A3 3 0 0 1 20 11a3 3 0 0 1-1.2 2.4A3.5 3.5 0 0 1 15.5 20h-1a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5Z" />
      <path d="M10 8.5c-.8 0-1.5.7-1.5 1.5" />
      <path d="M14 8.5c.8 0 1.5.7 1.5 1.5" />
      <path d="M10 14.5c-.8 0-1.5-.7-1.5-1.5" />
      <path d="M14 14.5c.8 0 1.5-.7 1.5-1.5" />
    </svg>
  );
}

const GOALS: { label: string; value: RegisterPayload["programType"] }[] = [
  { label: "NEET 2026", value: "class_xii" },
  { label: "NEET 2027", value: "class_xi" },
  { label: "Repeater / Dropper", value: "dropper" },
];

const PAID_PLAN_KEYS = new Set(["signature_entry", "core", "prime", "elite"]);

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);

  const selectedPlan = searchParams.get("plan") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState(GOALS[0].value);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Please enter your name, a valid email, and an 8+ character password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await authService.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        programType: goal,
      });

      const user = res?.data?.user || res?.user;
      const accessToken = res?.data?.accessToken || res?.accessToken || undefined;
      const rawBatch = user?.batch?._id || user?.batch;
      login(user?.name || name.trim(), user?.email || email.trim(), "student", accessToken, {
        id: user?._id || user?.id,
        batchId: rawBatch ? String(rawBatch) : undefined,
        programType: user?.programType || goal || undefined,
      });

      const expires = new Date();
      expires.setDate(expires.getDate() + 14);
      document.cookie = `auth-role=student; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;

      const nextUrl = PAID_PLAN_KEYS.has(selectedPlan)
        ? `/student?plan=${encodeURIComponent(selectedPlan)}`
        : "/student";
      router.push(nextUrl);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(errorObj?.response?.data?.message || errorObj?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await authService.googleLogin(credential, goal || undefined);

      const user = res?.data?.user || res?.user;
      const accessToken = res?.data?.accessToken || res?.accessToken || undefined;
      const rawBatch = user?.batch?._id || user?.batch;
      login(user?.name || "", user?.email || "", "student", accessToken, {
        id: user?._id || user?.id,
        batchId: rawBatch ? String(rawBatch) : undefined,
        programType: user?.programType || goal || undefined,
      });

      const expires = new Date();
      expires.setDate(expires.getDate() + 14);
      document.cookie = `auth-role=student; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;

      const nextUrl = PAID_PLAN_KEYS.has(selectedPlan)
        ? `/student?plan=${encodeURIComponent(selectedPlan)}`
        : "/student";
      router.push(nextUrl);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        errorObj?.response?.data?.message || errorObj?.message || "Google sign-up failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] overflow-x-hidden">
      <div className="hidden lg:flex w-full lg:w-[55%] xl:w-[57%] relative bg-gradient-to-br from-[#fbfcfe] via-[#f4f7fe] to-[#edf2fe] border-b lg:border-b-0 lg:border-r border-slate-200/80 flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 overflow-hidden">
        <div className="absolute -left-20 -top-20 w-[420px] h-[420px] bg-indigo-400/[0.12] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute right-[-5%] bottom-[-5%] w-[400px] h-[400px] bg-violet-400/[0.10] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 space-y-6 sm:space-y-7">
          <BrandLogo href="/" size="lg" />

          <div className="space-y-1.5">
            <h1 className="font-script text-[40px] sm:text-[48px] xl:text-[54px] font-bold text-slate-900 leading-[1.08] tracking-tight">
              Ready to find <br />
              <span className="text-[#4338ca] text-indigo-600">your starting point?</span>
            </h1>
            <div className="pt-1.5 space-y-0.5">
              <p className="text-base sm:text-[18px] font-bold text-slate-900 leading-snug">No judgement. No guesswork.</p>
              <p className="text-base sm:text-[18px] font-bold text-slate-900 leading-snug">
                Just your preparation, <span className="text-[#4338ca] font-black">decoded.</span>
              </p>
            </div>
          </div>

          <div className="relative w-full max-w-xl mx-auto my-2 py-4">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[340px] sm:w-[420px] h-[340px] sm:h-[420px] rounded-full border border-dashed border-indigo-200/90 -top-8 absolute" />
              <div className="w-[240px] sm:w-[300px] h-[240px] sm:h-[300px] rounded-full border border-indigo-200/50 -top-2 absolute" />
            </div>
            <div className="relative z-20 flex justify-center mb-[-12px]">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#4338ca] text-white flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.55)] border-2 border-white/80">
                <IconBrain className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="relative z-10 w-full h-[220px] sm:h-[260px] flex items-center justify-center">
              <div className="relative w-[320px] sm:w-[400px] h-full overflow-hidden rounded-2xl shadow-sm border border-slate-100/60 bg-white/60">
                <Image src="/register_student.jpg" alt="Student strategizing with laptop and notes" fill sizes="450px" className="object-cover object-center" priority />
              </div>
            </div>
          </div>

          <div className="max-w-xl rounded-2xl bg-white/90 backdrop-blur-md border border-indigo-100/90 shadow-sm p-3.5 sm:p-4 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 mt-0.5">
              <IconRocket className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">Start with one free diagnostic test.</p>
              <p className="text-xs sm:text-[12.5px] font-medium text-slate-600 leading-relaxed">Then unlock your full SIGNATURE plan when you are ready.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 text-[11px] font-medium text-slate-400">
          © {new Date().getFullYear()} Exam Neeti. Every Score Has a Strategy.
        </div>
      </div>

      <div className="w-full lg:w-[45%] xl:w-[43%] min-h-screen flex flex-col justify-between bg-white px-5 sm:px-10 lg:px-14 xl:px-16 py-8 sm:py-10">
        <div className="w-full flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <IconArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-6">
          
          <div className="space-y-1 mb-6">
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Create your student account</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Your free diagnostic test is unlocked immediately after signup.</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl p-3.5 text-left border bg-[#eef2ff] border-[#4338ca] shadow-sm ring-2 ring-indigo-500/10 mb-6">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-[#4338ca] text-white">
              <IconGraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black leading-tight text-[#4338ca]">Student</p>
              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">Self-registration for aspirants</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700 flex items-start gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-5">
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              onError={setError}
              disabled={loading}
              text="signup_with"
            />
            <div className="flex items-center gap-3 mt-5">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">or sign up with email</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5 text-left">
              <label htmlFor="reg-name" className="text-xs sm:text-sm font-bold text-slate-800 block ml-0.5">Full Name</label>
              <input id="reg-name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" className="w-full rounded-xl bg-white border border-slate-200/90 text-slate-900 text-sm px-4 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400" />
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="reg-email" className="text-xs sm:text-sm font-bold text-slate-800 block ml-0.5">Email</label>
              <div className="relative flex items-center group">
                <IconMail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-indigo-600 transition-colors" />
                <input id="reg-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl bg-white border border-slate-200/90 text-slate-900 text-sm pl-10 pr-4 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="reg-phone" className="text-xs sm:text-sm font-bold text-slate-800 block ml-0.5">Phone</label>
              <div className="relative flex items-center group">
                <IconPhone className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-indigo-600 transition-colors" />
                <input id="reg-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional mobile number" className="w-full rounded-xl bg-white border border-slate-200/90 text-slate-900 text-sm pl-10 pr-4 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="reg-goal" className="text-xs sm:text-sm font-bold text-slate-800 block ml-0.5">Target Exam</label>
              <select id="reg-goal" value={goal || ""} onChange={(e) => setGoal(e.target.value as RegisterPayload["programType"])} className="w-full rounded-xl bg-white border border-slate-200/90 text-slate-900 text-sm px-4 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium">
                {GOALS.map((g) => <option key={g.label} value={g.value || ""}>{g.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="reg-password" className="text-xs sm:text-sm font-bold text-slate-800 block ml-0.5">Password</label>
              <div className="relative flex items-center group">
                <IconLock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-indigo-600 transition-colors" />
                <input id="reg-password" type={showPass ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create an 8+ character password" className="w-full rounded-xl bg-white border border-slate-200/90 text-slate-900 text-sm pl-10 pr-11 py-3 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium placeholder:text-slate-400" />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#4338ca] hover:bg-[#3730a3] disabled:opacity-60 disabled:cursor-not-allowed py-3.5 text-xs sm:text-sm font-bold text-white transition-all shadow-md cursor-pointer inline-flex items-center justify-center gap-2">
              {loading ? "Creating account..." : "Create Account"}
              {!loading && <IconArrowRight className="w-4 h-4" />}
            </button>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 flex items-start gap-2.5">
              <IconCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 font-semibold leading-relaxed">Admin accounts are invitation-only. Self-registration always creates a student account.</p>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          Already have an account? <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-800">Log in</Link>
        </p>
      </div>
    </div>
  );
}
