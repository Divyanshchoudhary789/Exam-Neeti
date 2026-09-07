import axios from "axios";
import { useAuthStore } from "./useAuthStore";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Trailing slash removed — all API calls in apiServices.ts use leading "/" which is correct
// e.g. api.get("/auth/me") → baseURL/api/v1/auth/me  ✓
export const api = axios.create({
  baseURL: `${baseURL.replace(/\/$/, "")}/api/v1`,
  headers: {
    "Content-Type": "application/json",
    // Namespaces this app's auth cookies (`sa_access_token` / `sa_refresh_token`)
    // on the backend so the Super Admin session is never clobbered by — or
    // clobbers — a session on the main student/admin site that shares the API.
    "X-Auth-Client": "superadmin",
  },
  withCredentials: true,
});

// ── Request interceptor — attach Bearer token ────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Token refresh queue ──────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    // Resolve even when token is null — in production the refreshed access
    // token lives only in the httpOnly cookie, so there's nothing to attach
    // to the header, but the queued request must still be released to retry.
    else prom.resolve(token);
  });
  failedQueue = [];
};

// ── Response interceptor — auto-refresh on 401 ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("auth/refresh-token") &&
      !originalRequest.url?.includes("auth/login") &&
      !originalRequest.url?.includes("auth/google")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers["Authorization"] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // A non-2xx response throws and is handled in the catch block below,
        // so reaching here means the backend rotated the refresh token and
        // set fresh cookies successfully — regardless of what the body contains.
        //
        // One transparent retry: a data-heavy page fires many requests at once,
        // and a rotation race / transient hiccup can make the very first refresh
        // fail even though the session is perfectly valid. A single retry after a
        // short beat clears that without ever surfacing to the user.
        let res;
        try {
          res = await api.post("/auth/refresh-token");
        } catch (firstErr) {
          const status = firstErr?.response?.status;
          // A definitive "your session is gone" answer — don't bother retrying.
          if (status === 401 || status === 403) throw firstErr;
          await new Promise((r) => setTimeout(r, 600));
          res = await api.post("/auth/refresh-token");
        }
        const newToken =
          res?.data?.data?.accessToken ||
          res?.data?.accessToken ||
          res?.data?.data?.access_token ||
          res?.data?.access_token;

        if (newToken) {
          // Dev/non-production: body carries the new access token — keep it
          // in memory and attach it explicitly for clients that rely on the
          // Authorization header instead of the cookie.
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            useAuthStore.getState().login(
              currentUser.name,
              currentUser.email,
              currentUser.role,
              newToken,
              {
                id:          currentUser.id,
                batchId:     currentUser.batchId,
                programType: currentUser.programType,
              }
            );
          } else {
            // No user in store yet — store only the token so the retry can proceed
            useAuthStore.setState({ token: newToken });
          }

          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        } else {
          // Production: no token in body by design — the httpOnly cookie was
          // already refreshed by the server, so drop any stale bearer header
          // and let the browser authenticate the retry via the cookie.
          delete originalRequest.headers["Authorization"];
        }

        processQueue(null, newToken || null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Only force a logout when the backend explicitly says the session is
        // over (401/403). A network error / 5xx (backend restarting, offline,
        // proxy blip) must NOT nuke the session — the queued requests just fail
        // and the app can retry later with the still-valid cookie.
        const status = refreshError?.response?.status;
        if (status === 401 || status === 403) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
