"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconGoogle } from "./UIComponents";

const GSI_SRC = "https://accounts.google.com/gsi/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

let gsiScriptPromise: Promise<void> | null = null;

/** Load the Google Identity Services script exactly once per page. */
function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services."))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error("Failed to load Google Identity Services."));
    };
    document.head.appendChild(s);
  });

  return gsiScriptPromise;
}

interface GoogleSignInButtonProps {
  /** Called with the Google ID token ("credential") once the user picks an account. */
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
  /** Disable interaction (e.g. while a sign-in request is in flight). */
  disabled?: boolean;
  /** Button label variant. */
  text?: "signin_with" | "signup_with" | "continue_with";
}

/**
 * Renders Google's official "Continue with Google" button (Identity Services,
 * popup flow). On success it hands the parent the verifiable ID token; the
 * parent posts it to `POST /auth/google`.
 *
 * If NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set, a disabled placeholder is shown
 * so the layout is unaffected in environments where Google sign-in is off.
 */
export default function GoogleSignInButton({
  onCredential,
  onError,
  disabled = false,
  text = "continue_with",
}: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCredential = useCallback(
    (response: { credential?: string }) => {
      if (response?.credential) {
        onCredential(response.credential);
      } else {
        onError?.("Google did not return a sign-in token. Please try again.");
      }
    },
    [onCredential, onError]
  );

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const width = Math.min(
          Math.max(Math.floor(containerRef.current.offsetWidth) || 320, 200),
          400
        );

        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });
        setReady(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setFailed(true);
        onError?.(err.message || "Could not load Google sign-in.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, handleCredential, onError, text]);

  // Google sign-in disabled for this environment — keep the layout stable.
  if (!clientId || failed) {
    return (
      <button
        type="button"
        disabled
        title={
          failed
            ? "Google sign-in is temporarily unavailable."
            : "Google sign-in is not configured."
        }
        className="w-full rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-400 flex items-center justify-center gap-2.5 cursor-not-allowed"
      >
        <IconGoogle className="w-5 h-5 opacity-40" />
        <span>Continue with Google</span>
      </button>
    );
  }

  return (
    <div className="relative w-full [color-scheme:light]">
      {/* Google renders its own <iframe> button here */}
      <div
        ref={containerRef}
        className="flex justify-center min-h-[44px] w-full overflow-hidden"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-400 pointer-events-none">
          <IconGoogle className="w-5 h-5 opacity-40" />
          <span>Continue with Google</span>
        </div>
      )}
      {disabled && <div className="absolute inset-0 cursor-not-allowed bg-white/50" />}
    </div>
  );
}
