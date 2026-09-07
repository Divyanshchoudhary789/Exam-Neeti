"use client";

/* ============================================================================
   App-wide feedback primitives — toasts + confirm/prompt dialogs.

   Replaces every native window.alert / window.confirm / window.prompt across
   the app with on-brand UI. Callable from anywhere (components, event
   handlers, plain async helpers) via the exported `toast`, `confirmDialog`
   and `promptDialog` functions — no context wiring at the call site.

   <AppFeedback /> is mounted once in the root layout and renders the toast
   stack + the active dialog.
   ========================================================================== */

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CommonModal,
  IconCheck,
  IconCross,
  IconInfo,
  IconAlertTriangle,
} from "./UIComponents";

/* ─────────────────────────  TOASTS  ───────────────────────── */

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

type Listener = () => void;
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

let toasts: ToastItem[] = [];
const toastListeners = new Set<Listener>();
const emitToasts = () => toastListeners.forEach((l) => l());

function pushToast(type: ToastType, message: string) {
  const id = genId();
  toasts = [...toasts, { id, type, message: String(message ?? "") }];
  emitToasts();
  window.setTimeout(() => dismissToast(id), 4600);
}
function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

/** Fire a toast from anywhere. `toast.error(msg)` etc. */
export const toast = {
  success: (message: string) => pushToast("success", message),
  error: (message: string) => pushToast("error", message),
  info: (message: string) => pushToast("info", message),
};

/* ─────────────────────  CONFIRM / PROMPT  ─────────────────── */

export interface ConfirmOptions {
  title: string;
  /** Body copy — string or JSX. */
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** `danger` paints the confirm button red — use for destructive actions. */
  tone?: "default" | "danger";
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  /** When set, the confirm button stays disabled until the input matches this
      exact string (e.g. "type the batch name to delete it"). */
  matchValue?: string;
  /** Require a non-empty value before confirming. */
  requireValue?: boolean;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
}

interface ActiveDialog {
  id: string;
  kind: "confirm" | "prompt";
  opts: ConfirmOptions & Partial<PromptOptions>;
  resolve: (result: { confirmed: boolean; value: string }) => void;
}

let dialog: ActiveDialog | null = null;
const dialogListeners = new Set<Listener>();
const emitDialog = () => dialogListeners.forEach((l) => l());

function closeDialog(result: { confirmed: boolean; value: string }) {
  const current = dialog;
  dialog = null;
  emitDialog();
  current?.resolve(result);
}

/** If a dialog is already open when a new one is requested, resolve the old
    one as cancelled so its awaiter never hangs. */
function supersedeDialog() {
  const current = dialog;
  if (current) {
    dialog = null;
    current.resolve({ confirmed: false, value: "" });
  }
}

/** On-brand replacement for window.confirm. Resolves true when confirmed. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    supersedeDialog();
    dialog = {
      id: genId(),
      kind: "confirm",
      opts,
      resolve: ({ confirmed }) => resolve(confirmed),
    };
    emitDialog();
  });
}

/** On-brand replacement for window.prompt. Resolves the entered string, or
    null if the user cancelled. */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    supersedeDialog();
    dialog = {
      id: genId(),
      kind: "prompt",
      opts,
      resolve: ({ confirmed, value }) => resolve(confirmed ? value : null),
    };
    emitDialog();
  });
}

/* ─────────────────────────  RENDER  ──────────────────────── */

function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
}

function useDialog() {
  return useSyncExternalStore(
    (cb) => {
      dialogListeners.add(cb);
      return () => dialogListeners.delete(cb);
    },
    () => dialog,
    () => dialog,
  );
}

function ToastStack() {
  const items = useToasts();
  if (items.length === 0) return null;
  return (
    <div className="fixed top-4 inset-x-4 sm:top-6 sm:right-6 sm:left-auto sm:inset-x-auto z-[100000] flex flex-col gap-3 max-w-sm w-full mx-auto sm:mx-0 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 ${
            t.type === "success"
              ? "bg-white/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10"
              : t.type === "error"
                ? "bg-white/95 border-red-200 text-red-900 shadow-red-500/10"
                : "bg-white/95 border-indigo-200 text-indigo-900 shadow-indigo-500/10"
          }`}
        >
          <div className="flex items-start gap-3 text-xs font-bold leading-relaxed">
            <div
              className={`p-1.5 rounded-xl shrink-0 ${
                t.type === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : t.type === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {t.type === "success" ? (
                <IconCheck className="w-4 h-4" />
              ) : t.type === "error" ? (
                <IconAlertTriangle className="w-4 h-4" />
              ) : (
                <IconInfo className="w-4 h-4" />
              )}
            </div>
            <span className="pt-0.5">{t.message}</span>
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <IconCross className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DialogHost() {
  const active = useDialog();
  const [seenId, setSeenId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset the field when a new dialog opens — the React-blessed "adjust state
  // while rendering" pattern (no effect, no cascading render).
  if (active && active.id !== seenId) {
    setSeenId(active.id);
    setValue(active.opts.defaultValue ?? "");
  }

  // Autofocus the input once the dialog is on screen.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [active]);

  if (!active) return null;

  const { kind, opts } = active;
  const isPrompt = kind === "prompt";
  const trimmed = value.trim();
  const matchOk = opts.matchValue ? value === opts.matchValue : true;
  const valueOk = opts.requireValue ? trimmed.length > 0 : true;
  const canConfirm = !isPrompt || (matchOk && valueOk);

  const confirm = () => {
    if (!canConfirm) return;
    closeDialog({ confirmed: true, value });
  };
  const cancel = () => closeDialog({ confirmed: false, value: "" });

  return (
    <CommonModal
      isOpen
      onClose={cancel}
      title={opts.title}
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            {opts.cancelText ?? "Cancel"}
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              opts.tone === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {opts.confirmText ?? (opts.tone === "danger" ? "Delete" : "Confirm")}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {opts.message != null &&
          (typeof opts.message === "string" ? (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {opts.message}
            </p>
          ) : (
            opts.message
          ))}

        {isPrompt &&
          (opts.multiline ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder}
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 font-medium text-slate-800 transition-all resize-y"
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              placeholder={opts.placeholder}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 font-medium text-slate-800 transition-all"
            />
          ))}

        {isPrompt && opts.matchValue && !matchOk && value.length > 0 && (
          <p className="text-[11px] font-bold text-red-500">
            Text does not match yet.
          </p>
        )}
      </div>
    </CommonModal>
  );
}

export function AppFeedback() {
  return (
    <>
      <ToastStack />
      <DialogHost />
    </>
  );
}
