"use client";

import React, { useState, useEffect, useCallback } from "react";
import { studentService, authService } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import {
  IconCheck,
  IconAlertTriangle,
  IconMail,
  IconPhone,
  IconUsers,
  IconEdit,
  IconKey,
  IconShield,
  IconClock,
  Spinner,
} from "../common/UIComponents";

// ─────────────────────────────────────────────────────────────────────────────
export function ProfileSettingsPanel({ onBack }: { onBack: () => void }) {
  const { user: storeUser, updateUser } = useAuthStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile, setProfile]               = useState<Record<string, unknown> | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError]     = useState("");

  // Edit profile
  const [editMode, setEditMode]               = useState(false);
  const [editName, setEditName]               = useState("");
  const [editPhone, setEditPhone]             = useState("");
  const [savingProfile, setSavingProfile]     = useState(false);
  const [profileSuccess, setProfileSuccess]   = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");

  // Change password
  const [currentPassword, setCurrentPassword]           = useState("");
  const [newPassword, setNewPassword]                   = useState("");
  const [confirmNewPassword, setConfirmNewPassword]     = useState("");
  const [savingPassword, setSavingPassword]             = useState(false);
  const [passwordSuccess, setPasswordSuccess]           = useState("");
  const [passwordError, setPasswordError]               = useState("");
  const [showPasswords, setShowPasswords]               = useState(false);

  // ── Load profile ───────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setProfileError("");
    try {
      const res = await studentService.getMyProfile();
      const u   = res?.data?.user || res?.user || res?.data || res;
      if (u && typeof u === "object") {
        const p = u as Record<string, unknown>;
        setProfile(p);
        setEditName(String(p.name || ""));
        setEditPhone(String(p.phone || ""));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setProfileError(e?.response?.data?.message || e?.message || "Failed to load profile.");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setProfileSaveError("Name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    setProfileSaveError("");
    setProfileSuccess("");
    try {
      const res     = await studentService.updateMyProfile({
        name:  editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      const updated = res?.data?.user || res?.user || res?.data;
      if (updated && typeof updated === "object") {
        const p = updated as Record<string, unknown>;
        setProfile(p);
        updateUser({ name: String(p.name || editName) });
      }
      setProfileSuccess("Profile updated successfully.");
      setEditMode(false);
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setProfileSaveError(e?.response?.data?.message || e?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await authService.changePassword({ currentPassword, newPassword, confirmNewPassword });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setPasswordSuccess(""), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setPasswordError(e?.response?.data?.message || e?.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const batch     = profile?.batch as Record<string, unknown> | null | undefined;
  const batchName = batch?.name
    ? String(batch.name)
    : typeof profile?.batch === "string"
    ? (profile.batch as string)
    : "Not assigned";
  const isActive  = profile?.isActive !== false;
  const joinedDate = profile?.createdAt
    ? new Date(String(profile.createdAt)).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans text-slate-800">

      {/* Header */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <h1 className="text-lg sm:text-2xl font-black text-slate-900">Profile &amp; Settings</h1>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage your account information and security</p>
      </div>

      {loadingProfile ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Spinner className="w-6 h-6 text-indigo-600" />
          <span className="text-xs font-bold text-slate-400">Loading profile...</span>
        </div>
      ) : profileError ? (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 shrink-0" />
          {profileError}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

          {/* ── Left: Avatar + Account Info ──────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            {/* Avatar */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
                {String(profile?.name || storeUser?.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">{String(profile?.name || storeUser?.name || "—")}</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{String(profile?.email || storeUser?.email || "—")}</p>
              </div>
              <span className={`inline-flex text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                {isActive ? "Active Account" : "Inactive"}
              </span>
            </div>

            {/* Account details */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-2.5">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Account Details</h3>
              {[
                { icon: IconUsers,  label: "Batch",  value: batchName },
                { icon: IconShield, label: "Role",   value: "Student" },
                { icon: IconClock,  label: "Joined", value: joinedDate },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 leading-none">{label}</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Edit forms ─────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">

            {/* Edit Profile */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <IconEdit className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Personal Information</h3>
                </div>
                {!editMode && (
                  <button
                    onClick={() => {
                      setEditMode(true);
                      setProfileSaveError("");
                      setProfileSuccess("");
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {/* Alerts */}
              {profileSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <IconCheck className="w-4 h-4 shrink-0" />
                  {profileSuccess}
                </div>
              )}
              {profileSaveError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <IconAlertTriangle className="w-4 h-4 shrink-0" />
                  {profileSaveError}
                </div>
              )}

              {editMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm px-4 py-3 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-semibold transition-all"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Phone Number
                      <span className="ml-1 normal-case font-medium text-slate-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <IconPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm pl-10 pr-4 py-3 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-semibold transition-all"
                        placeholder="+91 XXXXXXXXXX"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false);
                        setEditName(String(profile?.name || ""));
                        setEditPhone(String(profile?.phone || ""));
                        setProfileSaveError("");
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {savingProfile ? (
                        <Spinner className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <IconCheck className="w-3.5 h-3.5" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[
                    { icon: IconUsers, label: "Full Name", value: String(profile?.name  || storeUser?.name  || "—") },
                    { icon: IconMail,  label: "Email",     value: String(profile?.email || storeUser?.email || "—") },
                    { icon: IconPhone, label: "Phone",     value: String(profile?.phone || "Not set") },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
                        <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <IconKey className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Change Password</h3>
              </div>

              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <IconCheck className="w-4 h-4 shrink-0" />
                  {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <IconAlertTriangle className="w-4 h-4 shrink-0" />
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                {(
                  [
                    { id: "cur",     label: "Current Password",     val: currentPassword,    setter: setCurrentPassword,    ph: "Enter current password" },
                    { id: "new",     label: "New Password",         val: newPassword,        setter: setNewPassword,        ph: "Min 8 characters" },
                    { id: "confirm", label: "Confirm New Password", val: confirmNewPassword, setter: setConfirmNewPassword, ph: "Re-enter new password" },
                  ] as {
                    id: string;
                    label: string;
                    val: string;
                    setter: React.Dispatch<React.SetStateAction<string>>;
                    ph: string;
                  }[]
                ).map(({ id, label, val, setter, ph }) => (
                  <div key={id}>
                    <label
                      htmlFor={`pwd-${id}`}
                      className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5"
                    >
                      {label}
                    </label>
                    <div className="relative">
                      <IconKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id={`pwd-${id}`}
                        type={showPasswords ? "text" : "password"}
                        value={val}
                        onChange={(e) => setter(e.target.value)}
                        placeholder={ph}
                        autoComplete={id === "cur" ? "current-password" : "new-password"}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm pl-10 pr-4 py-3 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-semibold transition-all"
                      />
                    </div>
                  </div>
                ))}

                {/* Show/hide toggle */}
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      showPasswords
                        ? "bg-indigo-600 border-indigo-600"
                        : "border-slate-300 bg-white"
                    }`}
                    onClick={() => setShowPasswords((p) => !p)}
                  >
                    {showPasswords && <IconCheck className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors select-none"
                    onClick={() => setShowPasswords((p) => !p)}
                  >
                    Show passwords
                  </span>
                </label>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-semibold text-slate-500 leading-relaxed">
                  Password must be at least 8 characters. After changing, active sessions
                  on other devices will be invalidated.
                </div>

                <button
                  type="submit"
                  disabled={
                    savingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmNewPassword
                  }
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {savingPassword ? (
                    <Spinner className="w-4 h-4 text-white" />
                  ) : (
                    <IconKey className="w-3.5 h-3.5" />
                  )}
                  {savingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
