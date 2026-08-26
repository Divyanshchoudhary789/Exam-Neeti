import { api } from "../store/api";

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "super_admin";
  batch?: { _id: string; name: string; programType?: string } | string;
  phoneNumber?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface ExamResponsePayload {
  slotPosition: number;
  questionId?: string;
  selectedAnswer: string | null;
  sequencePosition: number | null;
  timeSpentSeconds: number;
  confidence?: number;
  wasReattempted?: boolean;
  answerChanges?: number;
  initialAnswer?: string | null;
  firstAnswerTimeSeconds?: number | null;
  lastAnswerTimeSeconds?: number | null;
  reattemptDelaySeconds?: number | null;
}

// ----------------------------------------------------
// AUTH SERVICES
// ----------------------------------------------------
export const authService = {
  login: async (email: string, pass: string) => {
    const res = await api.post("/auth/login", { email, password: pass });
    return res.data;
  },
  logout: async () => {
    const res = await api.post("/auth/logout", {});
    return res.data;
  },
  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => {
    const res = await api.patch("/auth/change-password", data);
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  },
  resetPassword: async (token: string, newPassword: string) => {
    const res = await api.patch(`/auth/reset-password/${token}`, { newPassword });
    return res.data;
  },
};

// ----------------------------------------------------
// STUDENT & EXAM SERVICES
// ----------------------------------------------------

export interface ProbabilityChapterPayload {
  subject: "biology" | "chemistry" | "physics";
  chapter: string;
  level: "never_studied" | "started" | "can_solve_basic" | "comfortable" | "can_explain";
}

export interface ProbabilityQuestionnairePayload {
  sprintId: string;
  chapters: ProbabilityChapterPayload[];
}

export interface GenerateReportPayload {
  type: string;
  format: "pdf" | "excel";
  scope?: string;
  scopeRefId?: string;
  sprintId?: string;
}

export const studentService = {
  /** Get exams available to this student's batch for the active sprint */
  getMyExams: async () => {
    const res = await api.get("/exams/my-exams");
    return res.data;
  },
  getMyAttempts: async () => {
    const res = await api.get("/exams/my-attempts");
    return res.data;
  },
  startExamAttempt: async (examId: string) => {
    const res = await api.post(`/exams/${examId}/start`);
    return res.data;
  },
  submitExamAttempt: async (attemptId: string, responses: ExamResponsePayload[], totalTimeSeconds: number) => {
    const res = await api.post(`/exams/attempts/${attemptId}/submit`, { responses, totalTimeSeconds });
    return res.data;
  },
  getAttemptDetails: async (attemptId: string) => {
    const res = await api.get(`/exams/attempts/${attemptId}`);
    return res.data;
  },
  /** Fetches attempt + full question content (text, options, solution) from Question Bank */
  getAttemptWithQuestions: async (attemptId: string) => {
    const res = await api.get(`/exams/attempts/${attemptId}/with-questions`);
    return res.data;
  },
  getAttemptAnalytics: async (attemptId: string) => {
    const res = await api.get(`/analytics/attempts/${attemptId}`);
    return res.data;
  },
  getAdvancedAnalytics: async (attemptId: string) => {
    const res = await api.get(`/analytics/attempts/${attemptId}/advanced`);
    return res.data;
  },
  getOrderQualityAnalytics: async (attemptId: string) => {
    const res = await api.get(`/analytics/attempts/${attemptId}/order-quality`);
    return res.data;
  },
  /** Get full sprint-level analytics summary — scores, subjects, chapters, topics, timeline */
  getSprintAnalyticsMe: async (sprintId: string) => {
    const res = await api.get(`/analytics/sprint/${sprintId}/me`);
    return res.data;
  },
  /** Get all sprints attempted by student (plus active sprint) */
  getStudentAttemptedSprints: async () => {
    const res = await api.get("/analytics/sprints/me");
    return res.data;
  },
  /** Submit/update chapter-level self-assessment questionnaire for a sprint */
  submitProbabilityQuestionnaire: async (payload: ProbabilityQuestionnairePayload) => {
    const res = await api.post("/probability/questionnaire", payload);
    return res.data;
  },
  getProbabilitySprint: async (sprintId: string) => {
    const res = await api.get(`/probability/sprint/${sprintId}`);
    return res.data;
  },
  getSyllabusCoverageMe: async (sprintId: string) => {
    const res = await api.get(`/syllabus/coverage/me/${sprintId}`);
    return res.data;
  },
  /** Get own profile with batch details */
  getMyProfile: async () => {
    const res = await api.get("/users/me");
    return res.data;
  },
  /** Update own name/phone */
  updateMyProfile: async (data: { name?: string; phone?: string }) => {
    const res = await api.patch("/users/me", data);
    return res.data;
  },
  /** Get full syllabus tree for browsing */
  getSyllabusTree: async () => {
    const res = await api.get("/syllabus");
    return res.data;
  },
  getSyllabusStats: async () => {
    const res = await api.get("/syllabus/stats");
    return res.data;
  },
  // ── Reports ──────────────────────────────────────────────────────────────
  /** List own generated reports */
  getMyReports: async () => {
    const res = await api.get("/reports");
    return res.data;
  },
  /** Generate a student-type report (student_overall, student_subject, etc.) */
  generateReport: async (payload: GenerateReportPayload) => {
    // Backend expects `type` field (not `reportType`)
    const res = await api.post("/reports", payload);
    return res.data;
  },
  /** Check generation status of a report */
  getReportStatus: async (reportId: string) => {
    const res = await api.get(`/reports/${reportId}/status`);
    return res.data;
  },
  /**
   * Download a report as a blob — uses the authenticated Axios instance so
   * the Bearer token / cookie is sent correctly. Returns an object URL that
   * the caller should revoke after use.
   */
  downloadReport: async (reportId: string): Promise<{ objectUrl: string; filename: string }> => {
    const res = await api.get(`/reports/${reportId}/download`, {
      responseType: "blob",
    });
    const contentDisposition = res.headers["content-disposition"] || "";
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] || `report_${reportId}`;
    const objectUrl = URL.createObjectURL(res.data as Blob);
    return { objectUrl, filename };
  },
  /** @deprecated use downloadReport() instead */
  getReportDownloadUrl: (reportId: string): string => {
    const baseURL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
    return `${baseURL}/api/v1/reports/${reportId}/download`;
  },
};

// ----------------------------------------------------
// ADMIN SERVICES
// ----------------------------------------------------
export const adminService = {
  // Sprints
  getSprints: async (status?: string) => {
    const query = status ? `?status=${status}` : "";
    const res = await api.get(`/sprints${query}`);
    return res.data;
  },
  getActiveSprint: async () => {
    const res = await api.get("/sprints/active");
    return res.data;
  },
  getSprintById: async (id: string) => {
    const res = await api.get(`/sprints/${id}`);
    return res.data;
  },
  createSprint: async (data: Record<string, unknown>) => {
    const res = await api.post("/sprints", data);
    return res.data;
  },
  updateSprint: async (id: string, data: Record<string, unknown>) => {
    const res = await api.patch(`/sprints/${id}`, data);
    return res.data;
  },
  deleteSprint: async (id: string) => {
    const res = await api.delete(`/sprints/${id}`);
    return res.data;
  },
  getSprintSlotStats: async (id: string) => {
    const res = await api.get(`/sprints/${id}/slot-stats`);
    return res.data;
  },

  // Batches
  getBatches: async () => {
    const res = await api.get("/batches");
    return res.data;
  },
  getBatchById: async (id: string) => {
    const res = await api.get(`/batches/${id}`);
    return res.data;
  },
  createBatch: async (data: { name: string; programType: string; description?: string }) => {
    const res = await api.post("/batches", data);
    return res.data;
  },
  updateBatch: async (id: string, data: Record<string, unknown>) => {
    const res = await api.patch(`/batches/${id}`, data);
    return res.data;
  },
  deactivateBatch: async (id: string) => {
    const res = await api.patch(`/batches/${id}/deactivate`);
    return res.data;
  },
  reactivateBatch: async (id: string) => {
    const res = await api.patch(`/batches/${id}/reactivate`);
    return res.data;
  },
  deleteBatch: async (id: string, confirmName?: string, force?: boolean) => {
    const res = await api.delete(`/batches/${id}`, { data: { confirmName, force } });
    return res.data;
  },
  getBatchStudents: async (id: string) => {
    const res = await api.get(`/batches/${id}/students`);
    return res.data;
  },

  // Exams
  getExams: async (params?: { sprint?: string; batch?: string; status?: string }) => {
    const queryObj: Record<string, string> = {};
    if (params?.sprint) queryObj.sprint = params.sprint;
    if (params?.batch) queryObj.batch = params.batch;
    if (params?.status) queryObj.status = params.status;
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/exams${q ? `?${q}` : ""}`);
    return res.data;
  },
  getExamById: async (id: string) => {
    const res = await api.get(`/exams/${id}`);
    return res.data;
  },
  createExam: async (data: Record<string, unknown>) => {
    const res = await api.post("/exams", data);
    return res.data;
  },
  updateExam: async (id: string, data: Record<string, unknown>) => {
    const res = await api.patch(`/exams/${id}`, data);
    return res.data;
  },
  deleteExam: async (id: string) => {
    const res = await api.delete(`/exams/${id}`);
    return res.data;
  },
  getExamAttempts: async (id: string) => {
    const res = await api.get(`/exams/${id}/attempts`);
    return res.data;
  },

  // Questions
  getQuestions: async (params?: { subject?: string; difficulty?: string; classLevel?: string; chapter?: string; page?: number; limit?: number; search?: string; mine?: boolean; status?: "draft" | "active" }) => {
    const queryObj: Record<string, string> = {};
    if (params?.subject) queryObj.subject = params.subject;
    if (params?.difficulty) queryObj.difficulty = params.difficulty;
    if (params?.classLevel) queryObj.classLevel = params.classLevel;
    if (params?.chapter) queryObj.chapter = params.chapter;
    if (params?.page) queryObj.page = String(params.page);
    if (params?.limit) queryObj.limit = String(params.limit);
    if (params?.search) queryObj.search = params.search;
    if (params?.mine) queryObj.mine = "true";
    if (params?.status) queryObj.status = params.status;
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/questions${q ? `?${q}` : ""}`);
    return res.data;
  },
  getQuestionById: async (id: string) => {
    const res = await api.get(`/questions/${id}`);
    return res.data;
  },
  getQuestionStats: async () => {
    const res = await api.get("/questions/stats");
    return res.data;
  },
  getDistinctValues: async (field: string, filters?: Record<string, string>) => {
    const q = new URLSearchParams({ field, ...filters }).toString();
    const res = await api.get(`/questions/distinct?${q}`);
    return res.data;
  },
  createQuestion: async (formData: FormData) => {
    const res = await api.post("/questions", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  updateQuestion: async (id: string, formData: FormData) => {
    const res = await api.patch(`/questions/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  deleteQuestion: async (id: string) => {
    const res = await api.delete(`/questions/${id}`);
    return res.data;
  },
  previewQuestionMath: async (data: Record<string, unknown>) => {
    const res = await api.post("/questions/preview", data);
    return res.data;
  },
  bulkDeactivateQuestions: async (ids: string[]) => {
    // FIX: backend's bulkDeactivate controller reads req.body.ids, not
    // questionIds — this call was silently a no-op until corrected.
    const res = await api.patch("/questions/bulk-deactivate", { ids });
    return res.data;
  },
  /** Bulk-upload a .docx or .xlsx of questions — creates them as drafts. */
  bulkUploadQuestions: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/questions/bulk-upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  /** Download the sample bulk-upload template (Word or Excel). */
  downloadQuestionTemplate: async (format: "docx" | "xlsx"): Promise<{ objectUrl: string; filename: string }> => {
    const res = await api.get(`/questions/template?format=${format}`, {
      responseType: "blob",
    });
    const contentDisposition = res.headers["content-disposition"] || "";
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] || `exam-neeti-question-upload-template.${format}`;
    const objectUrl = URL.createObjectURL(res.data as Blob);
    return { objectUrl, filename };
  },

  // Question Field Definitions — admin-defined custom fields for the Question Bank
  getQuestionFieldDefinitions: async (activeOnly?: boolean) => {
    const res = await api.get(`/question-field-definitions${activeOnly ? "?activeOnly=true" : ""}`);
    return res.data;
  },
  createQuestionFieldDefinition: async (data: Record<string, unknown>) => {
    const res = await api.post("/question-field-definitions", data);
    return res.data;
  },
  updateQuestionFieldDefinition: async (id: string, data: Record<string, unknown>) => {
    const res = await api.put(`/question-field-definitions/${id}`, data);
    return res.data;
  },
  toggleQuestionFieldDefinition: async (id: string) => {
    const res = await api.patch(`/question-field-definitions/${id}/toggle`);
    return res.data;
  },
  deleteQuestionFieldDefinition: async (id: string) => {
    const res = await api.delete(`/question-field-definitions/${id}`);
    return res.data;
  },

  // Dashboard Analytics
  getDashboardOverview: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/overview`);
    return res.data;
  },
  getDashboardBatches: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/batches`);
    return res.data;
  },
  getDashboardRankings: async (sprintId: string, limit = 20) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/rankings?limit=${limit}`);
    return res.data;
  },
  getDashboardExamPerformance: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/exam-performance`);
    return res.data;
  },
  getDashboardSubjectPerformance: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/subject-performance`);
    return res.data;
  },
  getDashboardSummary: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/summary`);
    return res.data;
  },
  getDashboardChapterBreakdown: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/chapter-topic-breakdown`);
    return res.data;
  },
  getDashboardStudentStatus: async (sprintId: string) => {
    const res = await api.get(`/dashboard/sprint/${sprintId}/student-status`);
    return res.data;
  },
  getStudentAttemptHistory: async (sprintId: string, studentId: string) => {
    const sid = sprintId || "all";
    const res = await api.get(`/dashboard/sprint/${sid}/student/${studentId}/history`);
    return res.data;
  },
  getStudentAttemptById: async (attemptId: string) => {
    const res = await api.get(`/analytics/attempt/${attemptId}`);
    return res.data;
  },

  // Formula Config Tuning
  updateFormulaConfig: async (data: Record<string, unknown>) => {
    const res = await api.post("/analytics/formula-config", data);
    return res.data;
  },
  getFormulaConfigBySprint: async (sprintId: string) => {
    const res = await api.get(`/analytics/formula-config/sprint/${sprintId}`);
    return res.data;
  },
  recomputeAttemptAnalytics: async (attemptId: string) => {
    const res = await api.post(`/analytics/attempts/${attemptId}/recompute`);
    return res.data;
  },

  // Syllabus & Blueprint & Coverage
  getSyllabusTree: async (includeInactive = false) => {
    const res = await api.get(`/syllabus${includeInactive ? "?includeInactive=true" : ""}`);
    return res.data;
  },
  getSyllabus: async (params?: { subject?: string; classLevel?: string; includeInactive?: boolean }) => {
    const queryObj: Record<string, string> = {};
    if (params?.subject) queryObj.subject = params.subject;
    if (params?.classLevel) queryObj.classLevel = params.classLevel;
    if (params?.includeInactive) queryObj.includeInactive = "true";
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/syllabus${q ? `?${q}` : ""}`);
    return res.data;
  },
  getSyllabusStats: async () => {
    const res = await api.get("/syllabus/stats");
    return res.data;
  },
  getBlueprint: async () => {
    const res = await api.get("/syllabus/blueprint");
    return res.data;
  },
  getBlueprintEntry: async (progType: string, testCode: string) => {
    const res = await api.get(`/syllabus/blueprint/${progType}/${testCode}`);
    return res.data;
  },
  createSyllabusTopic: async (data: Record<string, unknown>) => {
    const res = await api.post("/syllabus/topics", data);
    return res.data;
  },
  updateSyllabusTopic: async (id: string, data: Record<string, unknown>) => {
    const res = await api.put(`/syllabus/topics/${id}`, data);
    return res.data;
  },
  deleteSyllabusTopic: async (id: string) => {
    const res = await api.delete(`/syllabus/topics/${id}`);
    return res.data;
  },
  toggleSyllabusTopicActive: async (id: string) => {
    const res = await api.patch(`/syllabus/topics/${id}/toggle`);
    return res.data;
  },
  bulkCreateSyllabusTopics: async (topics: Array<Record<string, unknown>>) => {
    const res = await api.post("/syllabus/topics/bulk", { topics });
    return res.data;
  },
  updateTopicWeight: async (id: string, weight: number) => {
    const res = await api.patch(`/syllabus/topics/${id}`, { weight });
    return res.data;
  },
  getStudentCoverage: async (studentId: string, sprintId: string) => {
    const res = await api.get(`/syllabus/coverage/student/${studentId}/${sprintId}`);
    return res.data;
  },
  getBatchCoverage: async (sprintId: string, batchId?: string) => {
    const query = batchId ? `?batchId=${batchId}` : "";
    const res = await api.get(`/syllabus/coverage/batch/${sprintId}${query}`);
    return res.data;
  },

  // User Management
  getUsers: async (params?: { page?: number; limit?: number; role?: string; search?: string; batch?: string }) => {
    const queryObj: Record<string, string> = {};
    if (params?.page) queryObj.page = String(params.page);
    if (params?.limit) queryObj.limit = String(params.limit);
    if (params?.role) queryObj.role = params.role;
    if (params?.search) queryObj.search = params.search;
    if (params?.batch) queryObj.batch = params.batch;
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/users${q ? `?${q}` : ""}`);
    return res.data;
  },
  createUser: async (data: Record<string, unknown>) => {
    const res = await api.post("/users", data);
    return res.data;
  },
  bulkImportStudents: async (students: Record<string, unknown>[]) => {
    const res = await api.post("/users/bulk-import", { students });
    return res.data;
  },
  updateUser: async (id: string, data: Record<string, unknown>) => {
    const res = await api.patch(`/users/${id}`, data);
    return res.data;
  },
  deactivateUser: async (id: string) => {
    const res = await api.patch(`/users/${id}/deactivate`);
    return res.data;
  },
  reactivateUser: async (id: string) => {
    const res = await api.patch(`/users/${id}/reactivate`);
    return res.data;
  },
  deleteUser: async (id: string) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },

  // Reports
  getReports: async () => {
    const res = await api.get("/reports");
    return res.data;
  },
  generateReport: async (data: {
    type: string;         // Backend expects "type", not "reportType"
    sprintId?: string;
    batchId?: string;
    studentId?: string;
    format?: "pdf" | "excel";
    scope?: string;
    scopeRefId?: string;
  }) => {
    let scope = data.scope;
    let scopeRefId = data.scopeRefId;

    if (!scope) {
      if (data.type === "admin_batch" || data.batchId) {
        scope = "batch";
        scopeRefId = scopeRefId || data.batchId;
      } else {
        scope = "full_sprint";
      }
    }

    const payload = {
      type: data.type,
      format: data.format || "pdf",
      scope,
      scopeRefId: scopeRefId || null,
      sprintId: data.sprintId || null,
    };
    const res = await api.post("/reports", payload);
    return res.data;
  },
  getReportStatus: async (reportId: string) => {
    const res = await api.get(`/reports/${reportId}/status`);
    return res.data;
  },
  /**
   * Download a report as a blob using the authenticated Axios instance so the
   * Bearer token / httpOnly cookie is sent correctly.
   */
  downloadReport: async (reportId: string): Promise<{ objectUrl: string; filename: string }> => {
    const res = await api.get(`/reports/${reportId}/download`, {
      responseType: "blob",
    });
    const contentDisposition = res.headers["content-disposition"] || "";
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] || `report_${reportId}`;
    const objectUrl = URL.createObjectURL(res.data as Blob);
    return { objectUrl, filename };
  },
  /**
   * @deprecated Use downloadReport() instead — this returns a plain URL without
   * auth headers so authenticated endpoints will return 401 when navigated to directly.
   */
  downloadReportUrl: (reportId: string): string => {
    const baseURL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
    return `${baseURL}/api/v1/reports/${reportId}/download`;
  },
};

// ----------------------------------------------------
// SUPER ADMIN SERVICES
// ----------------------------------------------------
export const superAdminService = {
  getPlatformStats: async () => {
    const res = await api.get("/admin-team/platform-stats");
    return res.data;
  },
  getAdminTeam: async (params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: boolean }) => {
    const queryObj: Record<string, string> = {};
    if (params?.page) queryObj.page = String(params.page);
    if (params?.limit) queryObj.limit = String(params.limit);
    if (params?.search) queryObj.search = params.search;
    if (params?.role) queryObj.role = params.role;
    if (params?.isActive !== undefined) queryObj.isActive = String(params.isActive);
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/admin-team${q ? `?${q}` : ""}`);
    return res.data;
  },
  getAdminById: async (id: string) => {
    const res = await api.get(`/admin-team/${id}`);
    return res.data;
  },
  getAuditLogs: async (params?: { page?: number; limit?: number; action?: string; adminId?: string; startDate?: string; endDate?: string }) => {
    const queryObj: Record<string, string> = {};
    if (params?.page) queryObj.page = String(params.page);
    if (params?.limit) queryObj.limit = String(params.limit);
    if (params?.action) queryObj.action = params.action;
    if (params?.adminId) queryObj.adminId = params.adminId;
    if (params?.startDate) queryObj.startDate = params.startDate;
    if (params?.endDate) queryObj.endDate = params.endDate;
    const q = new URLSearchParams(queryObj).toString();
    const res = await api.get(`/admin-team/audit-logs${q ? `?${q}` : ""}`);
    return res.data;
  },
  createAdmin: async (data: { name: string; email: string; phone?: string; password?: string }) => {
    const res = await api.post("/admin-team", data);
    return res.data;
  },
  updateAdmin: async (id: string, data: { name?: string; phone?: string }) => {
    const res = await api.patch(`/admin-team/${id}`, data);
    return res.data;
  },
  deactivateAdmin: async (id: string) => {
    const res = await api.patch(`/admin-team/${id}/deactivate`);
    return res.data;
  },
  reactivateAdmin: async (id: string) => {
    const res = await api.patch(`/admin-team/${id}/reactivate`);
    return res.data;
  },
  deleteAdmin: async (id: string, reason?: string) => {
    const res = await api.delete(`/admin-team/${id}`, { data: { reason } });
    return res.data;
  },
  hardDeleteStudent: async (id: string, confirmEmail: string) => {
    const res = await api.delete(`/users/${id}`, { data: { confirmEmail } });
    return res.data;
  },
  hardDeleteBatch: async (id: string, confirmName: string, force = false) => {
    const res = await api.delete(`/batches/${id}`, { data: { confirmName, force } });
    return res.data;
  },
};
