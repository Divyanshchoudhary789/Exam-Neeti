import { api } from "./api";

/**
 * Fetch admin team members with optional filters.
 * @param {Object} params - Query parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=20] - Items per page
 * @param {string} [params.search=""] - Search term
 * @param {string} [params.role=""] - Filter by role
 * @param {boolean} [params.isActive=true] - Filter by active status
 */
export const fetchadmin = async ({
  page = 1,
  limit = 20,
  search = "",
  role = "",
  isActive = true,
} = {}) => {
  try {
    // Use URLSearchParams to correctly encode all values (prevents param injection)
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search)   params.set("search", search);
    if (role)     params.set("role", role);
    if (isActive !== undefined && isActive !== null && isActive !== "") {
      params.set("isActive", String(isActive));
    }
    const res = await api.get(`/admin-team?${params.toString()}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const getadmindetails = async (id) => {
  try {
    const res = await api.get(`/admin-team/${id}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};

export const changepassword = async (data) => {
  try {
    // Leading slash is required for consistent baseURL resolution
    const res = await api.patch("/auth/change-password", data);
    return res.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch audit logs for admin and super admin view.
 * GET admin-team/audit-logs?page=1&limit=20&adminId=&action=&startDate=&endDate=
 */
export const fetchAuditLogs = async ({
  page = 1,
  limit = 20,
  adminId = "",
  action = "",
  startDate = "",
  endDate = "",
} = {}) => {
  try {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (adminId)   params.set("adminId", adminId);
    if (action)    params.set("action", action);
    if (startDate) params.set("startDate", startDate);
    if (endDate)   params.set("endDate", endDate);

    const res = await api.get(`/admin-team/audit-logs?${params.toString()}`);
    return res.data;
  } catch (error) {
    throw error;
  }
};
