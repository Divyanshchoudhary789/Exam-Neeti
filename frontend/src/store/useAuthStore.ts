import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "student" | "admin" | "super_admin";

export interface UserState {
  id?: string;
  name: string;
  email: string;
  role: Role;
  batchId?: string;
  programType?: string;
}

interface AuthState {
  user: UserState | null;
  /**
   * In-memory access token — NOT persisted in localStorage.
   * The httpOnly refresh-token cookie handles session continuity.
   * On a hard refresh the token is re-obtained via /auth/refresh-token
   * automatically by the Axios interceptor on the first 401.
   */
  token: string | null;
  login: (
    name: string,
    email: string,
    role: Role,
    token?: string,
    extra?: { id?: string; batchId?: string; programType?: string }
  ) => void;
  updateUser: (fields: Partial<UserState>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: (name, email, role, token, extra) =>
        set((state) => ({
          user: {
            id:          extra?.id,
            name,
            email,
            role,
            batchId:     extra?.batchId,
            programType: extra?.programType,
          },
          // Keep token in memory only — it is set here from the login response
          // and refreshed by api.js interceptor on every 401.
          token: token !== undefined ? token : state.token,
        })),

      updateUser: (fields) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...fields } : null,
        })),

      /**
       * Clears local state AND invalidates the refresh token on the backend.
       * Uses a raw fetch so we don't import the Axios instance (avoids circular deps).
       */
      logout: () => {
        // Fire-and-forget — invalidate the server-side refresh token
        const token = get().token;
        const baseURL = (
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
        ).replace(/\/$/, "");
        fetch(`${baseURL}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }).catch(() => {
          // Ignore network errors — local state is cleared regardless
        });

        // Clear the Edge-middleware role cookie
        if (typeof document !== "undefined") {
          document.cookie =
            "auth-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        }

        set({ user: null, token: null });
      },
    }),
    {
      name: "auth-storage",
      // SECURITY: Persist ONLY non-sensitive user metadata.
      // The access token is intentionally excluded — it lives in memory only.
      // Session continuity on hard refresh is handled by the httpOnly
      // refresh-token cookie + the Axios 401 interceptor in api.js.
      partialize: (state) => ({
        user: state.user,
        // token is deliberately NOT included here
      }),
    }
  )
);
