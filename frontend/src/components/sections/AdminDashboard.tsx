"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { adminService, UserProfile } from "../../services/apiServices";
import { useAuthStore } from "../../store/useAuthStore";
import { changepassword } from "../../store/commonapi";
import { authService } from "../../services/apiServices";
import { MathRenderer } from "../common/MathRenderer";
import {
  IconChart, IconBook, IconUsers, IconClock, IconFilter, IconPlus,
  IconTrash, IconDownload, IconUpload, IconCheck, IconCross, IconEye, IconEdit,
  IconLayers, IconFileText, IconSearch, IconShield, IconChevronDown, IconRocket,
  IconMail, IconPhone, IconCalendar, IconLock, IconEyeOff, IconUserCheck,
  IconGraduationCap, IconTarget,
  Spinner, StatusBadge, StatusDropdownBadge, MiniStatCard, CommonModal, PaginationControls, CardSkeleton,
  CustomSelectMenu,
} from "../common/UIComponents";
import { CustomSelect } from "../common/CustomSelect";
import { confirmDialog, promptDialog, toast } from "../common/feedback";
import { RadialMeter, HBarChart } from "../common/Charts";
import { SprintBuilder } from "../admin/SprintBuilder";
import { SprintHistoryModal } from "../admin/SprintHistoryModal";
import { PlanTiersPanel } from "../admin/PlanTiersPanel";
import { BulkStudentUploadModal } from "../admin/BulkStudentUploadModal";
import { ContentHubPanel } from "../admin/ContentHubPanel";
import { SprintPaperDownloadButton } from "../admin/SprintPaperDownloadButton";
import { CreateBatchModal } from "../admin/CreateBatchModal";
import { CreateExamModal } from "../admin/CreateExamModal";
import { QuestionBankPanel } from "../admin/QuestionBankPanel";
import { MyQuestionsPanel } from "../admin/MyQuestionsPanel";
import { BatchRosterModal } from "../admin/BatchRosterModal";
import { EditBatchModal } from "../admin/EditBatchModal";
import { ExamAttemptsModal } from "../admin/ExamAttemptsModal";
import { EditStudentModal } from "../admin/EditStudentModal";
import { StudentAnalyticsModal } from "../admin/StudentAnalyticsModal";
import { FormulaConfigModal } from "../admin/FormulaConfigModal";
import { ChapterTopicsModal, ChapterData, TopicItem } from "../admin/ChapterTopicsModal";
import { CreateSyllabusModal } from "../admin/CreateSyllabusModal";
import { EditSyllabusModal, EditSyllabusTopicData } from "../admin/EditSyllabusModal";

interface AdminDashboardProps { onLogout: () => void; }

const IconMenu = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const IconChevronLeft = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const IconChevronRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const IconLogOut = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: IconChart },
  { id: "sprints", label: "Sprints", icon: IconClock },
  { id: "batches", label: "Batches", icon: IconLayers },
  { id: "exams", label: "Exams", icon: IconBook },
  { id: "plans", label: "Plans & Tiers", icon: IconRocket },
  { id: "questions", label: "Question Bank", icon: IconFilter },
  { id: "myQuestions", label: "My Questions", icon: IconUpload },
  { id: "content", label: "Content Hub", icon: IconFileText },
  { id: "syllabus", label: "Syllabus Taxonomy", icon: IconFileText },
  { id: "students", label: "Students", icon: IconUsers },
  { id: "reports", label: "Reports", icon: IconDownload },
  { id: "settings", label: "Settings", icon: IconShield },
] as const;

type TabId = typeof TABS[number]["id"];

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Core Intelligence",
    items: [
      { id: "dashboard", label: "Dashboard", icon: IconChart, description: "Overview & Analytics" },
    ],
  },
  {
    groupTitle: "Academic Planning",
    items: [
      { id: "sprints", label: "Sprints", icon: IconClock, description: "Sprint Blueprint" },
      { id: "batches", label: "Batches", icon: IconLayers, description: "Cohorts & Classes" },
      { id: "exams", label: "Exams", icon: IconBook, description: "Test Management" },
      { id: "plans", label: "Plans & Tiers", icon: IconRocket, description: "Free & paid content" },
    ],
  },
  {
    groupTitle: "Content & Curriculum",
    items: [
      { id: "questions", label: "Question Bank", icon: IconFilter, description: "Question Bank" },
      { id: "myQuestions", label: "My Questions", icon: IconUpload, description: "Author Questions" },
      { id: "content", label: "Content Hub", icon: IconFileText, description: "Blogs & Resources" },
      { id: "syllabus", label: "Syllabus Taxonomy", icon: IconFileText, description: "Weightage & Topics" },
    ],
  },
  {
    groupTitle: "Administration",
    items: [
      { id: "students", label: "Students", icon: IconUsers, description: "Directory & Rosters" },
      { id: "reports", label: "Reports", icon: IconDownload, description: "Export Reports" },
      { id: "settings", label: "Settings", icon: IconShield, description: "Security & Account" },
    ],
  },
];

const ADMIN_LIST_LIMIT = 12;

const unwrapPagination = (res: unknown, fallbackTotal: number) => {
  const r = res as { data?: { pagination?: Record<string, unknown> }; pagination?: Record<string, unknown> };
  const p = r?.data?.pagination || r?.pagination || {};
  return {
    totalPages: Number(p.totalPages || 1),
    totalItems: Number(p.total ?? fallbackTotal),
  };
};

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("examneeti_admin_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("examneeti_admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen]);

  // ── Sprint & Dashboard state ──────────────────────────────────────────
  const [sprintList, setSprintList] = useState<Record<string,unknown>[]>([]);
  const [sprintOptionList, setSprintOptionList] = useState<Record<string,unknown>[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [sprintPage, setSprintPage] = useState(1);
  const [sprintTotalPages, setSprintTotalPages] = useState(1);
  const [sprintTotalItems, setSprintTotalItems] = useState(0);
  const [sprintStatusFilter, setSprintStatusFilter] = useState("");
  const [sprintClassFilter, setSprintClassFilter] = useState("");
  const [sprintSearch, setSprintSearch] = useState("");
  const [sprintHistoryId, setSprintHistoryId] = useState<string | null>(null);
  const [dashboardOverview, setDashboardOverview] = useState<Record<string,unknown>|null>(null);
  const [rankingsList, setRankingsList] = useState<Record<string,unknown>[]>([]);
  const [leaderboardScope, setLeaderboardScope] = useState<string>("all");
  const [leaderboardSearch, setLeaderboardSearch] = useState<string>("");
  const [isDashboardLoading, setIsDashboardLoading] = useState<boolean>(false);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState<boolean>(false);
  const [selectedStudentForAnalytics, setSelectedStudentForAnalytics] = useState<UserProfile & { studentId?: string; studentName?: string; studentEmail?: string; batchName?: string; rank?: number; totalScore?: number } | null>(null);
  const [showStudentAnalyticsModal, setShowStudentAnalyticsModal] = useState<boolean>(false);
  // Sprint context for the analytics modal — set to whichever scope was active
  // at the trigger site (Students tab uses selectedSprintId, Leaderboard uses
  // leaderboardScope) so a single modal instance serves both entry points.
  const [analyticsModalSprintId, setAnalyticsModalSprintId] = useState<string>("");
  const [examPerf, setExamPerf] = useState<Record<string,unknown>[]>([]);
  const [chapterBreakdown, setChapterBreakdown] = useState<Record<string,unknown>|null>(null);
  const [studentStatusList, setStudentStatusList] = useState<Record<string,unknown>[]>([]);
  const [sprintBuilder, setSprintBuilder] = useState<{ open: boolean; mode: "create" | "edit"; sprint: Record<string, unknown> | null }>({ open: false, mode: "create", sprint: null });
  const [showFormulaConfigModal, setShowFormulaConfigModal] = useState(false);

  const clearDashboardData = useCallback(() => {
    setDashboardOverview(null);
    setExamPerf([]);
    setChapterBreakdown(null);
    setStudentStatusList([]);
  }, []);

  const openCreateSprintBuilder = () => setSprintBuilder({ open: true, mode: "create", sprint: null });
  const openEditSprintBuilder = async (sprintId: string) => {
    try {
      const res = await adminService.getSprintById(sprintId);
      const full = (res?.data?.sprint || res?.sprint || res?.data || res) as Record<string, unknown>;
      if (!full || !full._id) { showToast("Could not load sprint blueprint", "error"); return; }
      setSprintBuilder({ open: true, mode: "edit", sprint: full });
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to load sprint", "error");
    }
  };

  // ── Batch state ───────────────────────────────────────────────────────
  const [batchList, setBatchList] = useState<Record<string,unknown>[]>([]);
  const [batchOptionList, setBatchOptionList] = useState<Record<string,unknown>[]>([]);
  const [batchPage, setBatchPage] = useState(1);
  const [batchTotalPages, setBatchTotalPages] = useState(1);
  const [batchTotalItems, setBatchTotalItems] = useState(0);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("");
  const [batchProgramFilter, setBatchProgramFilter] = useState("");
  const [batchSourceFilter, setBatchSourceFilter] = useState("");
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [selectedBatchToEdit, setSelectedBatchToEdit] = useState<Record<string,unknown>|null>(null);
  const [showBatchRosterModal, setShowBatchRosterModal] = useState(false);
  const [selectedRosterBatchId, setSelectedRosterBatchId] = useState("");
  const [selectedRosterBatchName, setSelectedRosterBatchName] = useState("");

  // ── Exam state ────────────────────────────────────────────────────────
  const [examsList, setExamsList] = useState<Record<string,unknown>[]>([]);
  const [examPage, setExamPage] = useState(1);
  const [examTotalPages, setExamTotalPages] = useState(1);
  const [examTotalItems, setExamTotalItems] = useState(0);
  const [examSearch, setExamSearch] = useState("");
  const [examStatusFilter, setExamStatusFilter] = useState("");
  const [examSprintFilter, setExamSprintFilter] = useState("");
  const [examBatchFilter, setExamBatchFilter] = useState("");
  const [examsLoading, setExamsLoading] = useState(false);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamBatchId, setNewExamBatchId] = useState("");
  const [newExamDuration, setNewExamDuration] = useState(180);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [showExamAttemptsModal, setShowExamAttemptsModal] = useState(false);
  const [selectedExamForAttemptsId, setSelectedExamForAttemptsId] = useState("");
  const [selectedExamForAttemptsTitle, setSelectedExamForAttemptsTitle] = useState("");

  // Question Bank state now lives entirely in QuestionBankPanel.tsx / MyQuestionsPanel.tsx

  // ── Syllabus state ────────────────────────────────────────────────────
  const [syllabusTree, setSyllabusTree] = useState<Record<string,unknown>[]>([]);
  const [syllabusStats, setSyllabusStats] = useState<Record<string,unknown>|null>(null);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [batchCoverageData, setBatchCoverageData] = useState<Record<string,unknown>|null>(null);
  const [sylSubjectFilter, setSylSubjectFilter] = useState("all");
  const [sylClassFilter, setSylClassFilter] = useState("all");
  const [sylSearchQuery, setSylSearchQuery] = useState("");
  const [showChapterTopicsModal, setShowChapterTopicsModal] = useState(false);
  const [selectedChapterForTopics, setSelectedChapterForTopics] = useState<ChapterData|null>(null);
  const [showCreateSyllabusModal, setShowCreateSyllabusModal] = useState(false);
  const [createSyllabusDefaults, setCreateSyllabusDefaults] = useState({
    subject: "physics",
    classLevel: "XI",
    chapter: "",
    unitCode: "",
  });
  const [showEditSyllabusModal, setShowEditSyllabusModal] = useState(false);
  const [selectedTopicToEdit, setSelectedTopicToEdit] = useState<EditSyllabusTopicData | null>(null);
  const [showInactiveSyllabus, setShowInactiveSyllabus] = useState(false);

  // ── Student / User state ──────────────────────────────────────────────
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState("student");
  const [userBatchFilter, setUserBatchFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotalItems, setUserTotalItems] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserBatchId, setNewUserBatchId] = useState("");
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<UserProfile|null>(null);

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // ── Reports state ─────────────────────────────────────────────────────
  const [reportsList, setReportsList] = useState<Record<string,unknown>[]>([]);
  const [reportType, setReportType] = useState("admin_sprint");
  const [reportFormat, setReportFormat] = useState<"pdf"|"excel">("pdf");
  const [reportBatchId, setReportBatchId] = useState("");
  const [reportStudentId, setReportStudentId] = useState("");
  const [reportSprintIds, setReportSprintIds] = useState<string[]>([]);
  const [reportStudents, setReportStudents] = useState<UserProfile[]>([]);
  const [reportStudentsLoading, setReportStudentsLoading] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState<string|null>(null);

  // Report types that describe ONE student (need a student picked).
  const PER_STUDENT_REPORTS = ["student_overall","student_subject","student_chapter","student_time","student_accuracy","student_recoverable","admin_student"] as const;
  const isPerStudentReport = (PER_STUDENT_REPORTS as readonly string[]).includes(reportType);

  // ── Settings state ────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [meProfile, setMeProfile] = useState<Record<string, unknown> | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  // ── Toast helper — delegates to the app-wide toast system ─────────────
  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    if (type === "error") toast.error(text);
    else toast.success(text);
  }, []);

  // ── Core data loaders ─────────────────────────────────────────────────
  const loadSprintsAndDashboard = useCallback(async (sprintId?: string) => {
    setIsDashboardLoading(true);
    try {
      const spRes = await adminService.getSprints({
        page: sprintPage,
        limit: ADMIN_LIST_LIMIT,
        status: sprintStatusFilter || undefined,
        classLevel: sprintClassFilter || undefined,
        search: sprintSearch.trim() || undefined,
      }).catch(() => null);
      const rawSp = spRes?.data?.sprints || spRes?.sprints || spRes?.data || spRes || [];
      const sprints: Record<string,unknown>[] = Array.isArray(rawSp) ? rawSp : [];
      setSprintList(sprints);
      const sprintMeta = unwrapPagination(spRes, sprints.length);
      setSprintTotalPages(sprintMeta.totalPages);
      setSprintTotalItems(sprintMeta.totalItems);

      const sid = sprintId || selectedSprintId || String(sprints[0]?._id || sprints[0]?.id || "");
      if (!sprintId && sid && !selectedSprintId) setSelectedSprintId(sid);
      const resolvedSid = sprintId || sid;

      if (resolvedSid) {
        const [ovRes, epRes, cbRes, stRes] = await Promise.allSettled([
          adminService.getDashboardOverview(resolvedSid),
          adminService.getDashboardExamPerformance(resolvedSid),
          adminService.getDashboardChapterBreakdown(resolvedSid),
          adminService.getDashboardStudentStatus(resolvedSid),
        ]);
        if (ovRes.status === "fulfilled") {
          const ov = ovRes.value?.data?.overview || ovRes.value?.data || ovRes.value;
          setDashboardOverview(ov && typeof ov === "object" ? ov : null);
        } else {
          setDashboardOverview(null);
        }
        if (epRes.status === "fulfilled") {
          const ep = epRes.value?.data?.exams || epRes.value?.exams || epRes.value?.data || epRes.value || [];
          setExamPerf(Array.isArray(ep) ? ep : []);
        } else {
          setExamPerf([]);
        }
        if (cbRes.status === "fulfilled") {
          const cb = cbRes.value?.data?.breakdown || cbRes.value?.breakdown || cbRes.value?.data || cbRes.value;
          setChapterBreakdown(cb && typeof cb === "object" ? cb : null);
        } else {
          setChapterBreakdown(null);
        }
        if (stRes.status === "fulfilled") {
          const st = stRes.value?.data?.students || stRes.value?.students || stRes.value?.data || stRes.value || [];
          setStudentStatusList(Array.isArray(st) ? st : []);
        } else {
          setStudentStatusList([]);
        }
      } else {
        clearDashboardData();
      }
    } catch (e) {
      console.error("Sprint/dashboard load error", e);
      clearDashboardData();
    } finally {
      setIsDashboardLoading(false);
    }
  }, [clearDashboardData, selectedSprintId, sprintPage, sprintSearch, sprintStatusFilter, sprintClassFilter]);

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLeaderboardLoading(true);
      try {
        const rkRes = await adminService.getDashboardRankings(leaderboardScope || "all", 50);
        const rk = rkRes?.data?.rankings || rkRes?.rankings || rkRes?.data || rkRes || [];
        setRankingsList(Array.isArray(rk) ? rk : []);
      } catch (e) {
        console.error("Leaderboard fetch error", e);
      } finally {
        setIsLeaderboardLoading(false);
      }
    };
    fetchRankings();
  }, [leaderboardScope]);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    const bRes = await adminService.getBatches({
      page: batchPage,
      limit: ADMIN_LIST_LIMIT,
      search: batchSearch.trim() || undefined,
      isActive: batchStatusFilter === "" ? undefined : batchStatusFilter === "active",
      programType: batchProgramFilter || undefined,
      source: batchSourceFilter || undefined,
    }).catch(() => null);
    const raw = bRes?.data?.batches || bRes?.batches || bRes?.data || bRes || [];
    const batches = Array.isArray(raw) ? raw : [];
    setBatchList(batches);
    const batchMeta = unwrapPagination(bRes, batches.length);
    setBatchTotalPages(batchMeta.totalPages);
    setBatchTotalItems(batchMeta.totalItems);
    setBatchesLoading(false);
  }, [batchPage, batchSearch, batchStatusFilter, batchProgramFilter, batchSourceFilter]);

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    const eRes = await adminService.getExams({
      page: examPage,
      limit: ADMIN_LIST_LIMIT,
      search: examSearch.trim() || undefined,
      status: examStatusFilter || undefined,
      sprint: examSprintFilter || undefined,
      batch: examBatchFilter || undefined,
    }).catch(() => null);
    const raw = eRes?.data?.exams || eRes?.exams || eRes?.data || eRes || [];
    const exams = Array.isArray(raw) ? raw : [];
    setExamsList(exams);
    const examMeta = unwrapPagination(eRes, exams.length);
    setExamTotalPages(examMeta.totalPages);
    setExamTotalItems(examMeta.totalItems);
    setExamsLoading(false);
  }, [examPage, examSearch, examStatusFilter, examSprintFilter, examBatchFilter]);

  const loadReferenceLists = useCallback(async () => {
    const [sprintsRes, batchesRes] = await Promise.allSettled([
      adminService.getSprints({ page: 1, limit: 100 }),
      adminService.getBatches({ page: 1, limit: 100 }),
    ]);

    if (sprintsRes.status === "fulfilled") {
      const raw = sprintsRes.value?.data?.sprints || sprintsRes.value?.sprints || sprintsRes.value?.data || sprintsRes.value || [];
      setSprintOptionList(Array.isArray(raw) ? raw : []);
    }
    if (batchesRes.status === "fulfilled") {
      const raw = batchesRes.value?.data?.batches || batchesRes.value?.batches || batchesRes.value?.data || batchesRes.value || [];
      setBatchOptionList(Array.isArray(raw) ? raw : []);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const uRes = await adminService.getUsers({
      role: userRoleFilter,
      batch: userBatchFilter || undefined,
      search: userSearch,
      page: userPage,
      limit: 15,
    }).catch(() => null);
    const rawU = uRes?.data?.users || uRes?.data?.students || uRes?.users || uRes?.data || uRes || [];
    setUsersList(Array.isArray(rawU) ? rawU : []);
    setUserTotalPages(uRes?.data?.pagination?.totalPages || uRes?.pagination?.totalPages || 1);
    setUserTotalItems(uRes?.data?.pagination?.total ?? uRes?.pagination?.total ?? (Array.isArray(rawU) ? rawU.length : 0));
    setUsersLoading(false);
  }, [userRoleFilter, userBatchFilter, userSearch, userPage]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const rRes = await adminService.getReports().catch(() => null);
    const rawR = rRes?.data?.reports || rRes?.reports || rRes?.data || rRes || [];
    setReportsList(Array.isArray(rawR) ? rawR : []);
    setReportsLoading(false);
  }, []);

  const loadSyllabus = useCallback(async () => {
    setSyllabusLoading(true);
    const [treeRes, statsRes, covRes] = await Promise.allSettled([
      adminService.getSyllabusTree(showInactiveSyllabus),
      adminService.getSyllabusStats(),
      selectedSprintId ? adminService.getBatchCoverage(selectedSprintId) : Promise.reject(),
    ]);
    if (treeRes.status === "fulfilled") {
      const rawChapters = treeRes.value?.data?.chapters || treeRes.value?.chapters || [];
      if (Array.isArray(rawChapters) && rawChapters.length > 0) {
        const subjectMap: Record<string, unknown[]> = {};
        rawChapters.forEach((ch: Record<string, unknown>) => {
          const s = String(ch.subject || "General");
          if (!subjectMap[s]) subjectMap[s] = [];
          subjectMap[s].push(ch);
        });
        const formattedTree = Object.entries(subjectMap).map(([subject, chapters]) => ({
          subject,
          chapters,
        }));
        setSyllabusTree(formattedTree);
      } else {
        const raw = treeRes.value?.data?.subjects || treeRes.value?.subjects || treeRes.value?.data || treeRes.value || [];
        setSyllabusTree(Array.isArray(raw) ? raw : []);
      }
    }
    if (statsRes.status === "fulfilled") {
      const s = statsRes.value?.data?.stats || statsRes.value?.data || statsRes.value;
      setSyllabusStats(s && typeof s === "object" ? s : null);
    }
    if (covRes.status === "fulfilled") {
      const c = covRes.value?.data?.coverage || covRes.value?.coverage || covRes.value?.data || covRes.value;
      setBatchCoverageData(c && typeof c === "object" ? c : null);
    }
    setSyllabusLoading(false);
  }, [selectedSprintId, showInactiveSyllabus]);

  // ── Initial data load ─────────────────────────────────────────────────
  useEffect(() => { loadReferenceLists(); loadSprintsAndDashboard(); loadBatches(); loadExams(); }, []); // eslint-disable-line
  useEffect(() => { setSprintPage(1); }, [sprintStatusFilter, sprintClassFilter, sprintSearch]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setBatchPage(1); }, [batchSearch, batchStatusFilter, batchProgramFilter, batchSourceFilter]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setExamPage(1); }, [examSearch, examStatusFilter, examSprintFilter, examBatchFilter]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "dashboard" && selectedSprintId) loadSprintsAndDashboard(selectedSprintId); }, [activeTab, selectedSprintId, loadSprintsAndDashboard]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "sprints") loadSprintsAndDashboard(); }, [activeTab, sprintPage, sprintStatusFilter, sprintClassFilter, sprintSearch, loadSprintsAndDashboard]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "batches") loadBatches(); }, [activeTab, loadBatches]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "exams") loadExams(); }, [activeTab, loadExams]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "students") loadUsers(); }, [activeTab, loadUsers]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "reports") loadReports(); }, [activeTab, loadReports]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "syllabus") loadSyllabus(); }, [activeTab, loadSyllabus]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeTab === "students") loadUsers(); }, [userPage, userRoleFilter, userBatchFilter, userSearch, loadUsers]); // eslint-disable-line
  // Student roster for the report student-picker — refetches when the batch
  // filter changes so the list stays scoped.
  useEffect(() => {
    if (activeTab !== "reports" || !isPerStudentReport) return;
    let cancelled = false;
    setReportStudentsLoading(true);
    adminService.getUsers({ role: "student", limit: 500, batch: reportBatchId || undefined })
      .then((res) => {
        if (cancelled) return;
        const raw = res?.data?.students || res?.data?.users || res?.students || res?.users || [];
        setReportStudents(Array.isArray(raw) ? (raw as UserProfile[]) : []);
      })
      .catch(() => { if (!cancelled) setReportStudents([]); })
      .finally(() => { if (!cancelled) setReportStudentsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, isPerStudentReport, reportBatchId]);

  useEffect(() => {
    if (activeTab !== "settings" || meProfile) return;
    let cancelled = false;
    setMeLoading(true);
    authService.getMe()
      .then((res) => { if (!cancelled) setMeProfile((res?.data?.user || res?.user || null) as Record<string, unknown> | null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMeLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, meProfile]);

  // ── Handlers ──────────────────────────────────────────────────────────

  // A regular admin can never delete a sprint directly — they raise a request
  // a super admin must approve. A super admin deletes directly.
  const handleDeleteSprint = async (id: string) => {
    if (user?.role === "super_admin") {
      if (!(await confirmDialog({
        title: "Delete sprint directly?",
        message: "This permanently deletes the sprint. This cannot be undone.",
        confirmText: "Delete sprint",
        tone: "danger",
      }))) return;
      try { await adminService.deleteSprint(id); showToast("Sprint deleted!"); refreshSprintsAfterMutation(); }
      catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Delete failed";
        showToast(msg, "error");
      }
      return;
    }
    const reason = await promptDialog({
      title: "Request sprint deletion",
      message: "A super admin must approve this before the sprint is deleted.",
      placeholder: "Reason (optional)",
      multiline: true,
      confirmText: "Submit request",
    });
    if (reason === null) return;
    try {
      const res = await adminService.requestSprintDeletion(id, reason);
      showToast(res?.message || "Deletion request submitted for super admin review.", "success");
      refreshSprintsAfterMutation();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Failed to submit request";
      showToast(msg, "error");
    }
  };

  const handleCancelSprintDeletionRequest = async (id: string) => {
    if (!(await confirmDialog({
      title: "Withdraw deletion request?",
      message: "The pending deletion request for this sprint will be cancelled.",
      confirmText: "Withdraw request",
    }))) return;
    try {
      await adminService.cancelSprintDeletionRequest(id);
      showToast("Deletion request withdrawn.", "success");
      refreshSprintsAfterMutation();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Failed to withdraw request";
      showToast(msg, "error");
    }
  };

  const handleUpdateSprintStatus = async (id: string, newStatus: string) => {
    try {
      await adminService.updateSprint(id, { status: newStatus });
      showToast(`Sprint status updated to ${newStatus.toUpperCase()}!`, "success");
      refreshSprintsAfterMutation();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Failed to update status";
      showToast(msg, "error");
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    const confirmInput = await promptDialog({
      title: "Delete batch?",
      message: `This permanently deletes "${name}" and cannot be undone. Type the batch name to confirm.`,
      placeholder: name,
      matchValue: name,
      confirmText: "Delete batch",
      tone: "danger",
    });
    if (confirmInput === null) return;
    try {
      await adminService.deleteBatch(id, confirmInput.trim());
      showToast("Batch deleted successfully!");
      refreshBatchesAfterMutation();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Delete failed";
      showToast(msg, "error");
    }
  };

  const handleDeactivateBatch = async (id: string, isActive: boolean) => {
    try {
      if (isActive) await adminService.deactivateBatch(id);
      else await adminService.reactivateBatch(id);
      showToast(`Batch ${isActive ? "deactivated" : "reactivated"}!`);
      refreshBatchesAfterMutation();
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Failed", "error"); }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault(); setExamSubmitting(true);
    try {
      if (!selectedSprintId || !newExamBatchId) { showToast("Select sprint and batch", "error"); return; }
      await adminService.createExam({ title: newExamTitle, sprint: selectedSprintId, batch: newExamBatchId, durationMinutes: newExamDuration });
      showToast("Exam created!"); setShowCreateExamModal(false);
      setNewExamTitle(""); setNewExamBatchId(""); loadExams();
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Failed to create exam", "error"); }
    finally { setExamSubmitting(false); }
  };

  const handlePublishExam = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "draft" ? "published" : "draft";
    try {
      await adminService.updateExam(id, { status: newStatus });
      showToast(`Exam ${newStatus === "published" ? "published" : "moved to draft"}!`);
      loadExams();
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Update failed", "error"); }
  };

  const handleDeleteExam = async (id: string) => {
    if (!(await confirmDialog({
      title: "Delete exam?",
      message: "This permanently deletes the exam. This cannot be undone.",
      confirmText: "Delete exam",
      tone: "danger",
    }))) return;
    try { await adminService.deleteExam(id); showToast("Exam deleted!"); loadExams(); }
    catch (err: unknown) { showToast((err as {message?:string}).message || "Delete failed", "error"); }
  };

  const handleUpdateTopicWeight = async (topicId: string, weight: number) => {
    try {
      await adminService.updateTopicWeight(topicId, weight);
      showToast("Topic weight updated!", "success");
      loadSyllabus();
    } catch (err: unknown) {
      showToast((err as {message?:string}).message || "Failed to update weight", "error");
    }
  };

  const handleDeleteSyllabusTopic = async (topicId: string, topicName: string) => {
    if (!(await confirmDialog({
      title: "Delete syllabus topic?",
      message: `"${topicName}" will be permanently deleted from the syllabus. This cannot be undone.`,
      confirmText: "Delete topic",
      tone: "danger",
    }))) return;
    try {
      await adminService.deleteSyllabusTopic(topicId);
      showToast("Syllabus topic deleted successfully!", "success");
      loadSyllabus();
      if (selectedChapterForTopics) {
        setSelectedChapterForTopics((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            topics: (prev.topics || []).filter((t) => String(t._id || t.id) !== topicId),
          };
        });
      }
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to delete topic", "error");
    }
  };

  const handleToggleSyllabusTopicActive = async (topicId: string) => {
    try {
      const res = await adminService.toggleSyllabusTopicActive(topicId);
      const updatedTopic = res?.data?.topic || res?.topic;
      showToast(`Topic ${updatedTopic?.isActive ? "activated" : "deactivated"}!`, "success");
      loadSyllabus();
      if (selectedChapterForTopics) {
        setSelectedChapterForTopics((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            topics: (prev.topics || []).map((t) => {
              if (String(t._id || t.id) === topicId) {
                return { ...t, isActive: updatedTopic?.isActive };
              }
              return t;
            }),
          };
        });
      }
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to toggle status", "error");
    }
  };

  // ── Weightage Framework (Chapter/Topic/Sub-Topic, 1=High/2=Medium/3=Low) ──
  // Taxonomy-level only — never tagged on individual questions.

  const handleUpdateChapterWeightage = async (subject: string, classLevel: string, chapter: string, weightage: 1 | 2 | 3) => {
    try {
      await adminService.updateChapterWeightage(subject, classLevel, chapter, weightage);
      showToast("Chapter Weightage updated for every topic in this chapter!", "success");
      loadSyllabus();
      setSelectedChapterForTopics((prev) => (prev ? { ...prev, chapterWeightage: weightage } : null));
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to update Chapter Weightage", "error");
    }
  };

  const handleUpdateTopicWeightage = async (topicId: string, weightage: 1 | 2 | 3 | null) => {
    try {
      await adminService.updateTopicWeightage(topicId, weightage);
      showToast("Topic Weightage updated!", "success");
      loadSyllabus();
      setSelectedChapterForTopics((prev) =>
        prev ? { ...prev, topics: (prev.topics || []).map((t) => (String(t._id || t.id) === topicId ? { ...t, topicWeightage: weightage } : t)) } : null
      );
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to update Topic Weightage", "error");
    }
  };

  const handleAddSubtopic = async (topicId: string, name: string, weightage: 1 | 2 | 3 | null) => {
    try {
      const res = await adminService.addSubtopic(topicId, name, weightage);
      const updated = res?.data?.topic || res?.topic;
      showToast("Subtopic added!", "success");
      loadSyllabus();
      setSelectedChapterForTopics((prev) =>
        prev ? { ...prev, topics: (prev.topics || []).map((t) => (String(t._id || t.id) === topicId ? { ...t, subtopics: updated?.subtopics || t.subtopics } : t)) } : null
      );
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to add subtopic", "error");
    }
  };

  const handleUpdateSubtopic = async (topicId: string, subtopicId: string, data: { name?: string; weightage?: 1 | 2 | 3 | null }) => {
    try {
      const res = await adminService.updateSubtopic(topicId, subtopicId, data);
      const updated = res?.data?.topic || res?.topic;
      loadSyllabus();
      setSelectedChapterForTopics((prev) =>
        prev ? { ...prev, topics: (prev.topics || []).map((t) => (String(t._id || t.id) === topicId ? { ...t, subtopics: updated?.subtopics || t.subtopics } : t)) } : null
      );
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to update subtopic", "error");
    }
  };

  const handleDeleteSubtopic = async (topicId: string, subtopicId: string) => {
    try {
      await adminService.deleteSubtopic(topicId, subtopicId);
      showToast("Subtopic deleted!", "success");
      loadSyllabus();
      setSelectedChapterForTopics((prev) =>
        prev
          ? {
              ...prev,
              topics: (prev.topics || []).map((t) =>
                String(t._id || t.id) === topicId ? { ...t, subtopics: (t.subtopics || []).filter((s) => s._id !== subtopicId) } : t
              ),
            }
          : null
      );
    } catch (err: unknown) {
      showToast((err as { message?: string }).message || "Failed to delete subtopic", "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserBatchId) {
      showToast("Please select a batch for the student.", "error");
      return;
    }
    setUserSubmitting(true);
    try {
      await adminService.createUser({
        name: newUserName,
        email: newUserEmail,
        role: "student",
        batchId: newUserBatchId,
        batch: newUserBatchId,
      });
      showToast("Student created!"); setShowCreateUserModal(false);
      setNewUserName(""); setNewUserEmail(""); setNewUserBatchId("");
      loadUsers();
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Failed to create student", "error"); }
    finally { setUserSubmitting(false); }
  };

  const handleToggleUserStatus = async (id: string, isActive: boolean) => {
    try {
      if (isActive) await adminService.deactivateUser(id); else await adminService.reactivateUser(id);
      showToast(`User ${isActive ? "deactivated" : "reactivated"}!`); loadUsers();
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Failed", "error"); }
  };


  const handleGenerateReport = async () => {
    // Per-student reports need a student; a specific sprint (single or set) is
    // optional — no selection means "across every sprint".
    if (isPerStudentReport && !reportStudentId) {
      showToast("Pick a student for this report.", "error");
      return;
    }
    if (reportType === "admin_batch" && !reportBatchId) {
      showToast("Pick a batch for the Batch Performance report.", "error");
      return;
    }
    if (reportType === "admin_sprint" && reportSprintIds.length !== 1) {
      showToast("The Sprint Summary report covers exactly one sprint — pick one.", "error");
      return;
    }

    setReportGenerating(true);
    try {
      const sprintIds = reportSprintIds;
      const sprintId = sprintIds.length === 1 ? sprintIds[0] : undefined;

      let scope: string;
      let scopeRefId: string | undefined;
      if (isPerStudentReport) {
        scope = "student";
        scopeRefId = reportStudentId;
      } else if (reportType === "admin_batch") {
        scope = "batch";
        scopeRefId = reportBatchId;
      } else if (reportType === "admin_comparative" && reportBatchId) {
        scope = "batch";
        scopeRefId = reportBatchId;
      } else {
        scope = "full_sprint";
      }

      await adminService.generateReport({
        type: reportType,
        format: reportFormat,
        scope,
        scopeRefId,
        sprintId,
        sprintIds: sprintIds.length > 1 ? sprintIds : undefined,
      });
      showToast("Report generated. Ready to download.");
      await loadReports();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Report generation failed";
      showToast(msg, "error");
    } finally {
      setReportGenerating(false);
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    setDownloadingReportId(reportId);
    try {
      const { objectUrl, filename } = await adminService.downloadReport(reportId);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      loadReports();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as { message?: string }).message || "Download failed";
      showToast(msg, "error");
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showToast("Passwords do not match", "error"); return; }
    if (newPassword.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
    setPwLoading(true);
    try {
      await changepassword({ currentPassword, newPassword, confirmNewPassword: confirmPassword });
      showToast("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) { showToast((err as {message?:string}).message || "Failed to change password", "error"); }
    finally { setPwLoading(false); }
  };

  const sprintOptions = sprintOptionList.length > 0 ? sprintOptionList : sprintList;
  const batchOptions = batchOptionList.length > 0 ? batchOptionList : batchList;
  const selectedSprintMeta = sprintOptions.find((s) => String(s._id || s.id) === selectedSprintId);
  const refreshBatchesAfterMutation = () => {
    loadBatches();
    loadReferenceLists();
  };
  const refreshSprintsAfterMutation = () => {
    loadSprintsAndDashboard();
    loadReferenceLists();
  };
  const handleDashboardSprintChange = (sprintId: string) => {
    setSelectedSprintId(sprintId);
    setLeaderboardScope(sprintId || "all");
  };
  const isSidebarVisuallyCollapsed = isSidebarCollapsed && !isMobileDrawerOpen;

  // ── Render ────────────────────────────────────────────────────────────
  if (sprintBuilder.open) {
    return (
      <SprintBuilder
        mode={sprintBuilder.mode}
        existingSprint={sprintBuilder.sprint}
        showToast={showToast}
        onClose={() => setSprintBuilder({ open: false, mode: "create", sprint: null })}
        onSaved={() => {
          setSprintBuilder({ open: false, mode: "create", sprint: null });
          setActiveTab("sprints");
          refreshSprintsAfterMutation();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 flex font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Mobile Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left Sidebar (Sticky on Desktop, Drawer on Mobile) ──────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#f8fafc] text-slate-800 border-r border-slate-200 shadow-2xl shadow-slate-900/10 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:z-30 shrink-0 ${
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${
          isSidebarVisuallyCollapsed ? "lg:w-[76px]" : "lg:w-64"
        } w-[86vw] max-w-72`}
      >
        {/* Sidebar Brand Header */}
        <div className={`relative h-16 px-3 flex items-center border-b border-slate-200 bg-white/85 backdrop-blur-xl shrink-0 ${
          isSidebarVisuallyCollapsed ? "justify-center" : "justify-between gap-3"
        }`}>
          <div className={`flex items-center min-w-0 ${isSidebarVisuallyCollapsed ? "justify-center" : "gap-3 overflow-hidden"}`}>
            {!isSidebarVisuallyCollapsed && (
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                <Image src="/logo.png" alt="Exam Neeti" width={32} height={32} className="h-8 w-8 object-contain" priority />
              </div>
            )}
            {!isSidebarVisuallyCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-950 tracking-tight truncate">Exam Neeti</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-extrabold uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold truncate">Institutional Portal</p>
              </div>
            )}
          </div>

          <button
            onClick={toggleSidebarCollapse}
            className={`hidden lg:flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-200 shadow-sm hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all cursor-pointer shrink-0 ${
              isSidebarVisuallyCollapsed
                ? "absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
                : "h-8 w-8"
            }`}
            title={isSidebarVisuallyCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isSidebarVisuallyCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarVisuallyCollapsed ? <IconChevronRight className="w-4 h-4" /> : <IconChevronLeft className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
            aria-label="Close navigation"
          >
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-300">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              {!isSidebarVisuallyCollapsed ? (
                <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {group.groupTitle}
                </div>
              ) : (
                <div className="h-px bg-slate-200 my-2 mx-1" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileDrawerOpen(false);
                    }}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    title={isSidebarVisuallyCollapsed ? `${item.label} (${item.description})` : undefined}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                      isActive
                        ? "bg-indigo-100 text-indigo-950 shadow-sm ring-1 ring-indigo-200 border border-indigo-200 font-extrabold"
                        : "text-slate-600 hover:text-slate-950 hover:bg-white hover:shadow-sm"
                    } ${isSidebarVisuallyCollapsed ? "justify-center px-2" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-indigo-700" : "text-slate-500 group-hover:text-indigo-600"}`} />
                      {isActive && isSidebarVisuallyCollapsed && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/30" />
                      )}
                    </div>
                    {!isSidebarVisuallyCollapsed && (
                      <span className="truncate text-left flex-1">{item.label}</span>
                    )}
                    {!isSidebarVisuallyCollapsed && isActive && (
                      <div className="h-5 w-1 rounded-full bg-indigo-500 shadow-xs" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-white/80 backdrop-blur-xl shrink-0">
          {/* User mini badge */}
          <div className={`flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 shadow-sm ${isSidebarVisuallyCollapsed ? "justify-center p-1.5" : "p-2"}`}>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              {(user?.name || "Admin").charAt(0).toUpperCase()}
            </div>
            {!isSidebarVisuallyCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">{user?.name || "Admin User"}</div>
                <div className="text-[10px] text-slate-500 font-medium truncate">{user?.email || "admin@examneeti.com"}</div>
              </div>
            )}
            {!isSidebarVisuallyCollapsed && (
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <IconLogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Wrapper ──────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* ── Sticky Top Header Bar ──────────────── */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 shadow-xs">
          {/* Left: Hamburger & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Open navigation menu"
            >
              <IconMenu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold text-slate-400 hidden sm:inline">Admin Console</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              {(() => {
                const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];
                const TabIcon = currentTab.icon;
                return (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                      <TabIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                      {currentTab.label}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right: Quick actions & User Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Quick action: Create Sprint shortcut */}
            {/* Quick action: Create Batch shortcut */}
            <button
              onClick={() => setShowCreateBatchModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <IconLayers className="w-3.5 h-3.5 text-slate-500" />
              <span>New Batch</span>
            </button>

            {/* Logout on Header */}
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <IconLogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ── Main Viewport Content Area ──────────────── */}
        <main className="flex-1 max-w-7xl 2xl:max-w-screen-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ══════════════════════════ DASHBOARD TAB ════════════════════════════ */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Sprint selector & Formula Tuning action */}
            <div className="relative bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 z-20">
              {isDashboardLoading && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 animate-pulse rounded-t-2xl" />
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-black text-slate-900">Sprint Context & Intelligence</h3>
                    {isDashboardLoading && (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black animate-pulse">
                        <Spinner className="w-3 h-3 text-indigo-600" />
                        <span>Updating data...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Select a sprint to view cohort metrics & analytics</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  <CustomSelect
                    value={selectedSprintId}
                    onChange={handleDashboardSprintChange}
                    options={sprintOptions.map(s => ({
                      value: String(s._id || s.id),
                      label: `${String(s.name || "Sprint")} · ${String(s.status || "Active")}`
                    }))}
                    icon={IconClock}
                    className="w-full sm:w-auto min-w-[240px]"
                  />
                  <button
                    onClick={() => setShowFormulaConfigModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <IconShield className="w-4 h-4 text-indigo-600" />
                    <span>Tune Scoring Formula</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Content Widgets with Loading Transition */}
            <div className={`space-y-6 transition-all duration-300 ${isDashboardLoading ? "opacity-50 pointer-events-none filter blur-[0.5px]" : "opacity-100"}`}>
              {!selectedSprintId && !isDashboardLoading && (
                <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm text-center">
                  <h3 className="text-sm font-black text-slate-900">Select a sprint to view dashboard data</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Create or activate a sprint first if this list is empty.</p>
                </div>
              )}

              {selectedSprintId && !isDashboardLoading && !dashboardOverview && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900">No dashboard data available</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {selectedSprintMeta ? String(selectedSprintMeta.name || "Selected sprint") : "Selected sprint"} is selected, but analytics have not been computed yet.
                  </p>
                </div>
              )}

              {/* Stat cards — only once metrics exist for the selected sprint.
                  Before that the banners above already tell the admin what to do,
                  and a grid of zeros just reads as a broken screen. */}
              {(isDashboardLoading || dashboardOverview) && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MiniStatCard title="Total Students" value={Number(dashboardOverview?.totalStudents ?? 0)} subtitle="Enrolled in selected sprint" icon={IconUsers} />
                  <MiniStatCard title="Active Exams" value={Number(dashboardOverview?.totalExams ?? 0)} subtitle="Scheduled / live" icon={IconBook} />
                  <MiniStatCard title="Avg Sprint Score" value={Number(dashboardOverview?.averageScore ?? 0) > 0 ? `${Number(dashboardOverview?.averageScore).toFixed(0)}` : "N/A"} subtitle="Mean marks" icon={IconChart} />
                  <MiniStatCard title="Active Batches" value={Number(dashboardOverview?.totalBatches ?? 0)} subtitle="Assigned to selected sprint" icon={IconLayers} />
                </div>
              )}

              {/* Chapter Weakness & Topic Breakdown Widget */}
              {chapterBreakdown && (() => {
                // Backend returns one `chapters` array sorted weakest-first. Each
                // widget must show only chapters that actually clear its own
                // threshold — otherwise, with a handful of chapters, "weakest"
                // and "strongest" show the same rows (a 100%-accuracy chapter
                // under "Weakest", a 0% one under "Strongest").
                const allChapters = Array.isArray(chapterBreakdown.chapters)
                  ? (chapterBreakdown.chapters as Array<{ chapter?: string; accuracy?: number }>)
                  : [];
                const weakest = allChapters
                  .filter((c) => Number(c.accuracy || 0) < 50)
                  .slice(0, 5)
                  .map((c) => ({ label: String(c.chapter || "Chapter"), value: Number(c.accuracy || 0) }));
                const strongest = allChapters
                  .filter((c) => Number(c.accuracy || 0) > 70)
                  .sort((a, b) => Number(b.accuracy || 0) - Number(a.accuracy || 0))
                  .slice(0, 5)
                  .map((c) => ({ label: String(c.chapter || "Chapter"), value: Number(c.accuracy || 0) }));
                return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                        <IconCross className="w-3.5 h-3.5 text-red-600" />
                        <span>Weakest Chapters (Need Attention)</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Cohort accuracy &lt; 50%</span>
                    </div>
                    {weakest.length > 0 ? (
                      <HBarChart color="#dc2626" data={weakest} />
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No chapter is below 50% cohort accuracy.</p>
                    )}
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                        <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Strongest Chapters</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Cohort accuracy &gt; 70%</span>
                    </div>
                    {strongest.length > 0 ? (
                      <HBarChart color="#059669" data={strongest} />
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center">No chapter is above 70% cohort accuracy yet.</p>
                    )}
                  </div>
                </div>
                );
              })()}

              {/* Student Attempt Submission Matrix */}
              {studentStatusList.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Student Submission Status Matrix</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Tracks exam submissions & progress for active sprint</p>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black">{studentStatusList.length} Students</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {studentStatusList.map((st, i) => {
                      const totalAtt = Number(st.totalAttempted || 0);
                      const inProg = Number(st.inProgress || 0);
                      const status = totalAtt > 0 ? "submitted" : (inProg > 0 ? "in_progress" : "pending");
                      const batchName = typeof st.batch === "object" && st.batch !== null ? (st.batch as {name?:string}).name : undefined;
                      return (
                        <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-900">{String(st.name || st.studentName || "Student")}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{String(st.email || "")} {batchName ? `• ${batchName}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {totalAtt > 0 && (
                              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                {totalAtt} Submitted
                              </span>
                            )}
                            <StatusBadge status={status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedSprintId && !isDashboardLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900">Student Submission Status Matrix</h3>
                  <p className="text-xs text-slate-500 font-medium mt-2">No student submission data found for this sprint yet.</p>
                </div>
              ) : null}

              {/* Exam Performance */}
              {examPerf.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900">Exam Performance Overview</h3>
                  <div className="space-y-3">
                    {examPerf.slice(0,5).map((ep,i) => {
                      const avg = Number(ep.averageScore ?? ep.avgScore ?? 0).toFixed(0);
                      const att = Number(ep.totalAttempts ?? ep.attempts ?? 0);
                      const maxS = Number(ep.maxScore ?? ep.totalMarks ?? (ep.exam as Record<string, unknown>)?.totalMarks ?? 720);
                      const pct = maxS > 0 ? Math.round((Number(avg)/maxS)*100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-4">
                          <p className="text-xs font-bold text-slate-800 w-48 truncate shrink-0">{String(ep.examTitle||ep.title||"Exam")}</p>
                          <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{width:`${pct}%`}} /></div>
                          <span className="text-xs font-black text-slate-700 w-16 text-right">{avg} pts</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{att} attempts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedSprintId && !isDashboardLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900">Exam Performance Overview</h3>
                  <p className="text-xs text-slate-500 font-medium mt-2">No exams or attempts are available for this sprint yet.</p>
                </div>
              ) : null}

              {/* Enhanced Leaderboard */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900">Leaderboard Rankings</h3>
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-black uppercase">
                        {leaderboardScope === "all" ? "Overall (All Sprints)" : "Selected Sprint"}
                      </span>
                      {isLeaderboardLoading && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                          <Spinner className="w-3 h-3 text-indigo-600" /> Updating...
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">Click any student to view detailed performance profile & history</p>
                  </div>

                {/* Scope Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    value={leaderboardScope}
                    onChange={(e) => setLeaderboardScope(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Sprints (Overall)</option>
                    {sprintOptions.map((sp) => (
                      <option key={String(sp._id || sp.id)} value={String(sp._id || sp.id)}>
                        Sprint: {String(sp.name || sp.title || "Sprint")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search input if multiple students */}
              {rankingsList.length > 3 && (
                <div className="relative">
                  <input
                    type="text"
                    value={leaderboardSearch}
                    onChange={(e) => setLeaderboardSearch(e.target.value)}
                    placeholder="Search student by name or email..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3.5 py-2 rounded-xl focus:outline-none font-medium placeholder:text-slate-400"
                  />
                </div>
              )}

              {/* Leaderboard Table / Cards */}
              {(() => {
                const filtered = rankingsList.filter((r) => {
                  if (!leaderboardSearch.trim()) return true;
                  const s = leaderboardSearch.toLowerCase();
                  const name = String(r.studentName || r.name || "").toLowerCase();
                  const email = String(r.studentEmail || r.email || "").toLowerCase();
                  return name.includes(s) || email.includes(s);
                });

                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 font-semibold text-center py-8">
                      {rankingsList.length === 0 ? "No attempts recorded for this selection yet." : "No student matches search."}
                    </p>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {filtered.map((r, idx) => {
                      const actualRank = Number(r.rank || idx + 1);
                      const name = String(r.studentName || r.name || (r.user as { name?: string })?.name || "Student");
                      const email = String(r.studentEmail || r.email || "");
                      const batchName = String(r.batchName || (r.batch as { name?: string })?.name || "");
                      const score = Number(r.totalScore ?? r.score ?? r.marks ?? 0);
                      const attemptsCount = Number(r.totalAttempts ?? 1);
                      const avgAcc = r.avgAccuracy !== undefined ? Number(r.avgAccuracy) : null;

                      // Badge styling for top 3 vs rest
                      let rankBadge = (
                        <span className="w-8 text-center text-xs font-black text-slate-500 shrink-0">#{actualRank}</span>
                      );
                      if (actualRank === 1) {
                        rankBadge = (
                          <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            🥇 1
                          </span>
                        );
                      } else if (actualRank === 2) {
                        rankBadge = (
                          <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            🥈 2
                          </span>
                        );
                      } else if (actualRank === 3) {
                        rankBadge = (
                          <span className="w-8 h-8 rounded-full bg-amber-900/10 text-amber-900 border border-amber-800/20 flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            🥉 3
                          </span>
                        );
                      }

                      const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

                      const isNegative = score < 0;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedStudentForAnalytics({
                              _id: String(r.studentId || r._id || r.id),
                              name,
                              email,
                              batchName,
                              rank: actualRank,
                              totalScore: score,
                              role: "student",
                            });
                            setAnalyticsModalSprintId(leaderboardScope);
                            setShowStudentAnalyticsModal(true);
                          }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group gap-2.5 sm:gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {rankBadge}
                            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <p className="text-xs font-black text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                                  {name}
                                </p>
                                {Boolean(batchName) && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[9px] font-extrabold text-slate-600 truncate max-w-[120px]">
                                    {batchName}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {Boolean(email) && (
                                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]" title={email}>
                                    {email}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-semibold">• {attemptsCount} test{attemptsCount !== 1 ? "s" : ""}</span>
                                {avgAcc !== null && <span className="text-[10px] text-indigo-600 font-bold">• {avgAcc}% acc</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                            <div className="text-left sm:text-right">
                              <span className={`text-sm font-black ${isNegative ? "text-rose-600" : "text-emerald-600"}`}>
                                {score > 0 ? `+${score}` : score}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-semibold">marks</span>
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-white group-hover:bg-indigo-600 text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-indigo-600 rounded-lg text-[10px] font-bold shadow-xs transition-all flex items-center gap-1"
                            >
                              <IconEye className="w-3 h-3" />
                              <span>Details</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        )}

        {/* ══════════════════════════ SPRINTS TAB ══════════════════════════════ */}
        {activeTab === "sprints" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Sprint Cycles & Blueprints</h2>
                <p className="text-xs text-slate-500 font-semibold">Manage question pattern blueprints, exam schedules, and status</p>
              </div>
              <button onClick={openCreateSprintBuilder} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all">
                <IconPlus className="w-4 h-4" /><span>Create Sprint</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1 min-w-[220px]">
                <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={sprintSearch}
                  onChange={(e) => setSprintSearch(e.target.value)}
                  placeholder="Search sprint name or description..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <CustomSelect
                value={sprintStatusFilter}
                onChange={setSprintStatusFilter}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "archived", label: "Archived" },
                ]}
                className="lg:w-44"
              />
              <CustomSelect
                value={sprintClassFilter}
                onChange={setSprintClassFilter}
                options={[
                  { value: "", label: "All Classes" },
                  { value: "XI", label: "Class XI" },
                  { value: "XII", label: "Class XII" },
                  { value: "dropper", label: "Dropper" },
                ]}
                className="lg:w-40"
              />
              <button
                onClick={() => { setSprintSearch(""); setSprintStatusFilter(""); setSprintClassFilter(""); }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Clear
              </button>
            </div>
            {isDashboardLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : sprintList.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No sprints created yet. Click &quot;Create Sprint&quot; to define a blueprint.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sprintList.map(s => {
                  const sId = String(s._id||s.id);
                  const totalQ = Number(s.totalQuestions || 180);
                  const desc = String(s.description || "");
                  const currentStatus = String(s.status || "draft").toLowerCase();
                  const sClassLevel = s.classLevel ? String(s.classLevel) : "";
                  const subjectProgress = Array.isArray(s.subjectProgress)
                    ? (s.subjectProgress as { subject: string; status: string }[])
                    : [];
                  const delReq = (s.deletionRequest as { status?: string; reason?: string; decisionNote?: string } | undefined) || {};
                  const delPending = delReq.status === "pending";
                  const delRejected = delReq.status === "rejected";
                  const subjTone: Record<string, string> = {
                    physics: "bg-cyan-50 text-cyan-700 border-cyan-200",
                    chemistry: "bg-amber-50 text-amber-700 border-amber-200",
                    biology: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  };

                  return (
                    <div key={sId} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-3.5 hover:shadow-md transition-all flex flex-col justify-between ${delPending ? "border-amber-300" : "border-slate-200/90"}`}>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-slate-900 leading-snug">{String(s.name||"Sprint")}</h4>
                          <StatusDropdownBadge
                            status={currentStatus}
                            onChange={(newStatus) => handleUpdateSprintStatus(sId, newStatus)}
                          />
                        </div>

                        {Boolean(desc) && <p className="text-xs text-slate-500 font-medium line-clamp-2">{desc}</p>}

                        {(subjectProgress.length > 0 || sClassLevel) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {sClassLevel && (
                              <span className="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
                                {sClassLevel === "dropper" ? "Dropper" : `Class ${sClassLevel}`}
                              </span>
                            )}
                            {subjectProgress.map((sp) => (
                              <span
                                key={sp.subject}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold capitalize ${subjTone[sp.subject] || "bg-slate-50 text-slate-600 border-slate-200"} ${sp.status !== "done" ? "opacity-60" : ""}`}
                                title={`${sp.subject}: ${sp.status}`}
                              >
                                {sp.status === "done" ? <IconCheck className="w-2.5 h-2.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                                {sp.subject.slice(0, 4)}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg">
                            {totalQ} Questions
                          </span>
                          {Boolean(s.startDate) && (
                            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <IconClock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(String(s.startDate)).toLocaleDateString("en-IN")}</span>
                              {Boolean(s.endDate) && <span>- {new Date(String(s.endDate)).toLocaleDateString("en-IN")}</span>}
                            </span>
                          )}
                        </div>

                        {delPending && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                            <span className="text-[10px] font-black uppercase text-amber-800">Deletion awaiting super admin</span>
                            <button onClick={() => handleCancelSprintDeletionRequest(sId)} className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer">
                              Withdraw
                            </button>
                          </div>
                        )}
                        {delRejected && (
                          <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">
                            Deletion request was rejected{delReq.decisionNote ? `: “${delReq.decisionNote}”` : "."}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2">
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Created: {s.createdAt ? new Date(String(s.createdAt)).toLocaleDateString("en-IN") : "N/A"}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <SprintPaperDownloadButton sprintId={sId} sprintName={String(s.name || "")} showToast={showToast} />
                          <button onClick={() => setSprintHistoryId(sId)} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors" title="Sprint history">
                            <IconClock className="w-4 h-4" />
                          </button>
                          {currentStatus === "draft" && (
                            <button onClick={() => openEditSprintBuilder(sId)} className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer transition-colors" title="Edit blueprint">
                              <IconEdit className="w-4 h-4" />
                            </button>
                          )}
                          {!delPending && (
                            <button
                              onClick={() => handleDeleteSprint(sId)}
                              className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors"
                              title={user?.role === "super_admin" ? "Delete sprint" : "Request deletion"}
                            >
                              <IconTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
                <PaginationControls currentPage={sprintPage} totalPages={sprintTotalPages} totalItems={sprintTotalItems} onPageChange={setSprintPage} />
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════ BATCHES TAB ══════════════════════════════ */}
        {activeTab === "batches" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Batches & Academic Programs</h2>
                <p className="text-xs text-slate-500 font-semibold">Organize students by program type, track batch rosters, and manage status</p>
              </div>
              <button onClick={() => setShowCreateBatchModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all">
                <IconPlus className="w-4 h-4" /><span>Create Batch</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    placeholder="Search batch name..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <CustomSelect
                  value={batchStatusFilter}
                  onChange={setBatchStatusFilter}
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  className="lg:w-44"
                />
                <CustomSelect
                  value={batchProgramFilter}
                  onChange={setBatchProgramFilter}
                  options={[
                    { value: "", label: "All Programs" },
                    { value: "class_xi", label: "Class XI" },
                    { value: "class_xii", label: "Class XII" },
                    { value: "dropper", label: "Dropper" },
                  ]}
                  className="lg:w-48"
                />
                <CustomSelect
                  value={batchSourceFilter}
                  onChange={setBatchSourceFilter}
                  options={[
                    { value: "", label: "All Sources" },
                    { value: "coaching", label: "Coaching" },
                    { value: "public", label: "Public Plans" },
                  ]}
                  className="lg:w-48"
                />
                <button
                  onClick={() => { setBatchSearch(""); setBatchStatusFilter(""); setBatchProgramFilter(""); setBatchSourceFilter(""); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
            {batchesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : batchList.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No student batches created yet. Click &quot;Create Batch&quot; to define your first program batch.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {batchList.map(b => {
                  const bId = String(b._id||b.id);
                  const bName = String(b.name||"Batch");
                  const isActive = b.isActive !== false;
                  const prog = String(b.programType||"class_xi");
                  const studentCount = Number(b.studentCount || 0);

                  const progInfo: Record<string, { label: string; style: string }> = {
                    class_xi:  { label: "Class XI", style: "bg-blue-50 text-blue-700 border-blue-200" },
                    class_xii: { label: "Class XII", style: "bg-purple-50 text-purple-700 border-purple-200" },
                    dropper:   { label: "Dropper / Repeater", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  };

                  const currentProg = progInfo[prog] || { label: prog, style: "bg-slate-100 text-slate-700 border-slate-200" };

                  return (
                    <div key={bId} className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3.5 hover:shadow-md transition-all flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-slate-900 leading-snug">{bName}</h4>
                          <StatusBadge status={isActive ? "Active" : "Inactive"} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${currentProg.style}`}>
                            {currentProg.label}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedRosterBatchId(bId);
                              setSelectedRosterBatchName(bName);
                              setShowBatchRosterModal(true);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-200 cursor-pointer transition-colors"
                          >
                            <IconUsers className="w-3 h-3 text-indigo-600" />
                            <span>{studentCount} Students (View Roster)</span>
                          </button>
                        </div>

                        {Boolean(b.description) && (
                          <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 pt-1">
                            {String(b.description)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedBatchToEdit(b);
                              setShowEditBatchModal(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer transition-colors"
                          >
                            <IconEdit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeactivateBatch(bId, isActive)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors border ${
                              isActive
                                ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>

                        {/* Hard delete is super_admin-only on the backend (DELETE /batches/:id) —
                            hide it for regular admins instead of showing a control that always 403s. */}
                        {user?.role === "super_admin" && (
                          <button
                            onClick={() => handleDeleteBatch(bId, bName)}
                            className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer transition-colors"
                            title="Delete Batch"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
                <PaginationControls currentPage={batchPage} totalPages={batchTotalPages} totalItems={batchTotalItems} onPageChange={setBatchPage} />
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════ EXAMS TAB ════════════════════════════════ */}
        {activeTab === "exams" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-900">Test Series & Exams</h2>
              <button onClick={() => setShowCreateExamModal(true)} className="self-start flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all">
                <IconPlus className="w-4 h-4" /><span>Create Exam</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    placeholder="Search exam title..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <CustomSelect
                  value={examStatusFilter}
                  onChange={setExamStatusFilter}
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: "draft", label: "Draft" },
                    { value: "published", label: "Published" },
                    { value: "completed", label: "Completed" },
                  ]}
                  className="lg:w-48"
                />
                <CustomSelect
                  value={examSprintFilter}
                  onChange={setExamSprintFilter}
                  options={[
                    { value: "", label: "All Sprints" },
                    ...sprintOptions.map((s) => ({ value: String(s._id || s.id), label: String(s.name || "Sprint") })),
                  ]}
                  className="lg:w-56"
                />
                <CustomSelect
                  value={examBatchFilter}
                  onChange={setExamBatchFilter}
                  options={[
                    { value: "", label: "All Batches" },
                    ...batchOptions.map((b) => ({ value: String(b._id || b.id), label: String(b.name || "Batch") })),
                  ]}
                  className="lg:w-56"
                />
                <button
                  onClick={() => { setExamSearch(""); setExamStatusFilter(""); setExamSprintFilter(""); setExamBatchFilter(""); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
            {examsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : examsList.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No exams yet. Create your first exam above.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {examsList.map(ex => {
                  const exId = String(ex._id||ex.id);
                  const status = String(ex.status||"draft");
                  const title = String(ex.title||"NEET Exam");
                  const exBatch = ex.batch as Record<string, unknown> | undefined;
                  const TIER: Record<string, string> = {
                    "public-trial": "Free tier", "public-signature-entry": "Signature Entry",
                    "public-core": "Core plan", "public-prime": "Prime plan", "public-elite": "Elite plan",
                  };
                  const tierLabel = exBatch?.source === "public" ? (TIER[String(exBatch.slug)] || "Plan") : null;
                  return (
                    <div key={exId} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-black text-slate-900 leading-snug">{title}</h4>
                        <StatusBadge status={status} />
                      </div>
                      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-semibold items-center">
                        <span>Duration: <b className="text-slate-700">{String(ex.durationMinutes||180)} min</b></span>
                        <span>Total marks: <b className="text-slate-700">{Number(ex.totalMarks) > 0 ? String(ex.totalMarks) : "—"}</b></span>
                        {ex.examNumber ? <span>Paper #<b className="text-slate-700">{String(ex.examNumber)}</b></span> : null}
                        {tierLabel ? (
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${tierLabel === "Free tier" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>{tierLabel}</span>
                        ) : Boolean(exBatch) && (
                          <span>Batch: <b className="text-slate-700">{String(exBatch?.name || ex.batch)}</b></span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handlePublishExam(exId, status)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-colors ${
                              status === "draft" ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                            }`}>
                            {status === "draft" ? "Publish" : "Move to Draft"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExamForAttemptsId(exId);
                              setSelectedExamForAttemptsTitle(title);
                              setShowExamAttemptsModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-indigo-200"
                          >
                            <IconChart className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Submissions</span>
                          </button>
                        </div>
                        <button onClick={() => handleDeleteExam(exId)} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer">
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
                <PaginationControls currentPage={examPage} totalPages={examTotalPages} totalItems={examTotalItems} onPageChange={setExamPage} />
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════ PLANS & TIERS TAB ═══════════════════════ */}
        {activeTab === "plans" && (
          <PlanTiersPanel
            showToast={showToast}
            onViewExams={(batchId) => { setExamBatchFilter(batchId); setActiveTab("exams"); }}
          />
        )}

        {/* ══════════════════════════ CONTENT HUB TAB ═════════════════════════ */}
        {activeTab === "content" && <ContentHubPanel showToast={showToast} />}

        {/* ══════════════════════════ QUESTIONS TAB ════════════════════════════ */}
        {activeTab === "questions" && <QuestionBankPanel showToast={showToast} />}

        {/* ══════════════════════════ MY QUESTIONS TAB ═════════════════════════ */}
        {activeTab === "myQuestions" && <MyQuestionsPanel showToast={showToast} />}

        {/* ══════════════════════════ SYLLABUS TAB ═════════════════════════════ */}
        {activeTab === "syllabus" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">NEET Syllabus Taxonomy & Topic Weighting</h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore chapter taxonomies, inspect topic weights, and manage full subject specifications</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateSyllabusDefaults({
                      subject: sylSubjectFilter === "all" ? "physics" : sylSubjectFilter,
                      classLevel: sylClassFilter === "all" ? "XI" : sylClassFilter,
                      chapter: "",
                      unitCode: "",
                    });
                    setShowCreateSyllabusModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all shrink-0"
                >
                  <IconPlus className="w-4 h-4" />
                  <span>Add Topic / Chapter</span>
                </button>
              </div>
            </div>

            {syllabusLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(6)].map((_,i)=><CardSkeleton key={i}/>)}</div>
            ) : (
              <>
                {/* Metric Summary Cards */}
                {syllabusStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MiniStatCard title="Total Subjects" value={Number(syllabusStats.totalSubjects ?? 0)} icon={IconBook} />
                    <MiniStatCard title="Total Chapters" value={Number(syllabusStats.totalChapters ?? 0)} icon={IconLayers} />
                    <MiniStatCard title="Total Topics" value={Number(syllabusStats.totalTopics ?? 0)} icon={IconFileText} />
                    <MiniStatCard title="Questions Tagged" value={Number(syllabusStats.totalTaggedQuestions ?? 0)} icon={IconFilter} />
                  </div>
                )}

                {batchCoverageData && (
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">Cohort Blueprint Coverage</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Overall blueprint syllabus completion rate across active cohorts</p>
                    </div>
                    <RadialMeter value={Number(batchCoverageData.avgSyllabusCoverage || 0)} size={64} strokeWidth={6.5} />
                  </div>
                )}

                {/* Subject Tabs & Filter Toolbar */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  {/* Subject Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {[
                      { id: "all", label: "All Subjects", color: "bg-indigo-600 text-white" },
                      { id: "physics", label: "Physics", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                      { id: "chemistry", label: "Chemistry", color: "bg-violet-50 text-violet-700 border-violet-200" },
                      { id: "biology", label: "Biology", color: "bg-teal-50 text-teal-700 border-teal-200" },
                    ].map((st) => {
                      const isActive = sylSubjectFilter === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => setSylSubjectFilter(st.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                            isActive
                              ? "bg-slate-900 text-white border-slate-900 shadow-md"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search and Class Filter Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    <div className="relative flex-1 min-w-[220px]">
                      <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search chapter or topic..."
                        value={sylSearchQuery}
                        onChange={(e) => setSylSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <CustomSelect
                        value={sylClassFilter}
                        onChange={(val) => setSylClassFilter(val)}
                        options={[
                          { value: "all", label: "All Classes (XI & XII)" },
                          { value: "XI", label: "Class XI" },
                          { value: "XII", label: "Class XII" },
                        ]}
                        className="w-full sm:w-auto min-w-[170px]"
                      />
                      <label className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                        <input
                          type="checkbox"
                          checked={showInactiveSyllabus}
                          onChange={(e) => setShowInactiveSyllabus(e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Show Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Subject-Wise Chapters Sections */}
                {syllabusTree.length > 0 ? (
                  <div className="space-y-6">
                    {syllabusTree
                      .filter((subj) => {
                        const sName = String(subj.subject || "").toLowerCase();
                        if (sylSubjectFilter !== "all" && sName !== sylSubjectFilter.toLowerCase()) return false;
                        return true;
                      })
                      .map((subj, si) => {
                        const allChapters = (subj.chapters as Record<string, unknown>[]) || [];
                        const subjName = String(subj.subject || subj.name || `Subject ${si + 1}`);

                        const filteredChapters = allChapters.filter((ch) => {
                          if (sylClassFilter !== "all" && String(ch.classLevel || "").toUpperCase() !== sylClassFilter.toUpperCase()) return false;
                          if (sylSearchQuery.trim()) {
                            const q = sylSearchQuery.toLowerCase();
                            const chMatch = String(ch.chapter || "").toLowerCase().includes(q);
                            const topics = (ch.topics as Array<{ topic?: string; name?: string }>) || [];
                            const topMatch = topics.some((t) => String(t.topic || t.name || "").toLowerCase().includes(q));
                            return chMatch || topMatch;
                          }
                          return true;
                        });

                        const subjColors: Record<string, { bg: string; badge: string }> = {
                          physics: { bg: "bg-indigo-600", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                          chemistry: { bg: "bg-violet-600", badge: "bg-violet-50 text-violet-700 border-violet-200" },
                          biology: { bg: "bg-teal-600", badge: "bg-teal-50 text-teal-700 border-teal-200" },
                        };

                        const currentTheme = subjColors[subjName.toLowerCase()] || { bg: "bg-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200" };

                        return (
                          <div key={si} className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4">
                            {/* Subject Section Header Banner */}
                            <div className={`px-6 py-4 ${currentTheme.bg} text-white flex items-center justify-between shadow-sm`}>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-sm">
                                  {subjName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="text-base font-black tracking-wide capitalize">{subjName} Taxonomy</h3>
                                  <p className="text-[11px] opacity-80 font-medium">{filteredChapters.length} Chapters Available</p>
                                </div>
                              </div>
                              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold">
                                {allChapters.reduce((acc, c) => acc + ((c.topics as unknown[])?.length || 0), 0)} Total Topics
                              </span>
                            </div>

                            {/* Chapter Cards Grid */}
                            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredChapters.map((ch, ci) => {
                                const topics = (ch.topics as Record<string, unknown>[]) || [];
                                const classLvl = String(ch.classLevel || "");
                                const unitCode = String(ch.unitCode || "");
                                const chapterName = String(ch.chapter || ch.name || `Chapter ${ci + 1}`);

                                const previewTopics = topics.slice(0, 3);
                                const extraTopicsCount = Math.max(0, topics.length - 3);

                                return (
                                  <div
                                    key={ci}
                                    className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between"
                                  >
                                    <div className="space-y-3">
                                      {/* Chapter Header */}
                                      <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-3">
                                        <div>
                                          <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                                            {chapterName}
                                          </h4>
                                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-bold mt-1">
                                            {unitCode && (
                                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 font-extrabold">
                                                Unit {unitCode}
                                              </span>
                                            )}
                                            {classLvl && (
                                              <span className="bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md">
                                                Class {classLvl}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <span className="px-2.5 py-1 bg-white text-slate-700 text-[10px] font-black rounded-full border border-slate-200 shrink-0 shadow-2xs">
                                          {topics.length} topic{topics.length !== 1 ? "s" : ""}
                                        </span>
                                      </div>

                                      {/* Topics Preview Badges */}
                                      <div className="space-y-1.5 pt-1">
                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Topics Preview</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {previewTopics.map((top, ti) => {
                                            const tName = String(top.topic || top.name || `Topic ${ti + 1}`);
                                            return (
                                              <span
                                                key={ti}
                                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-medium truncate max-w-full"
                                              >
                                                {tName}
                                              </span>
                                            );
                                          })}
                                          {extraTopicsCount > 0 && (
                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                                              +{extraTopicsCount} more topic{extraTopicsCount !== 1 ? "s" : ""}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action Footer Button */}
                                    <div className="pt-3 border-t border-slate-200/60">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedChapterForTopics({
                                            chapter: chapterName,
                                            subject: subjName,
                                            classLevel: classLvl,
                                            unitCode: unitCode,
                                            topics: topics as ChapterData["topics"],
                                          });
                                          setShowChapterTopicsModal(true);
                                        }}
                                        className="w-full py-2.5 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                                      >
                                        <IconEye className="w-4 h-4" />
                                        <span>View Topics & Data</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                    <p className="text-sm font-black text-slate-800">Syllabus taxonomy not seeded yet.</p>
                    <p className="text-xs text-slate-500 font-medium">Run the seed script: <code className="bg-slate-100 px-2 py-0.5 rounded font-mono">node scripts/seedSyllabus.js</code></p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════ STUDENTS TAB ═════════════════════════════ */}
        {activeTab === "students" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-900">Student Roster</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowCreateUserModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all">
                  <IconPlus className="w-4 h-4" /><span>Add Student</span>
                </button>
                <button onClick={() => setShowBulkImportModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all">
                  <IconDownload className="w-4 h-4" /><span>Bulk Import</span>
                </button>
              </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="relative flex-1 min-w-[160px]">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Search by name / email..." value={userSearch} onChange={e=>{setUserSearch(e.target.value);setUserPage(1);}}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" />
              </div>
              <CustomSelect
                value={userRoleFilter}
                onChange={(val) => { setUserRoleFilter(val); setUserPage(1); }}
                options={[
                  { value: "student", label: "Students" },
                  { value: "admin", label: "Admins" },
                ]}
                className="w-full sm:w-auto min-w-[120px]"
              />
              <CustomSelect
                value={userBatchFilter}
                onChange={(val) => { setUserBatchFilter(val); setUserPage(1); }}
                options={[
                  { value: "", label: "All Batches" },
                  ...batchOptions.map(b => ({ value: String(b._id || b.id), label: String(b.name || "Batch") }))
                ]}
                className="w-full sm:w-auto min-w-[140px]"
              />
            </div>

            {usersLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_,i)=><CardSkeleton key={i}/>)}</div>
            ) : usersList.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 font-semibold">No users found matching your criteria.</div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="hidden sm:grid grid-cols-5 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span className="col-span-2">Name / Email</span>
                    <span>Batch</span>
                    <span>Status</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {usersList.map(u => {
                      const isActive = u.isActive !== false;
                      const batchName = typeof u.batch === "object" && u.batch !== null ? (u.batch as {name?:string}).name : undefined;
                      return (
                        <div key={u._id} className="grid grid-cols-1 sm:grid-cols-5 px-5 py-3.5 items-center gap-2 sm:gap-0 hover:bg-slate-50/80 transition-colors">
                          <div className="sm:col-span-2">
                            <p className="text-xs font-black text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-slate-400 font-semibold">{u.email}</p>
                          </div>
                          <p className="text-xs font-semibold text-slate-600">{batchName || "—"}</p>
                          <StatusBadge status={isActive ? "Active" : "Inactive"} />
                          <div className="flex items-center gap-2 sm:justify-end">
                            <button
                              onClick={() => {
                                setSelectedStudentForAnalytics(u);
                                setAnalyticsModalSprintId(selectedSprintId);
                                setShowStudentAnalyticsModal(true);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold cursor-pointer transition-colors border border-indigo-200"
                            >
                              <IconChart className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Analytics</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUserToEdit(u);
                                setShowEditUserModal(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer transition-colors"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleToggleUserStatus(u._id, isActive)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-colors ${isActive ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100":"bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"}`}>
                              {isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <PaginationControls currentPage={userPage} totalPages={userTotalPages} totalItems={userTotalItems} onPageChange={p=>setUserPage(p)} />
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════ REPORTS TAB ══════════════════════════════ */}
        {activeTab === "reports" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <h2 className="text-xl font-black text-slate-900">Report Generation</h2>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-900">Generate New Report</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  Individual reports pull one student&apos;s performance. Cohort reports summarise a sprint or batch.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomSelectMenu
                  label="Report Type"
                  value={reportType}
                  onChange={(val) => { setReportType(val); }}
                  options={[
                    { value: "student_overall", label: "Overall Performance", sublabel: "Individual · one student, every metric" },
                    { value: "student_subject", label: "Subject Performance", sublabel: "Individual · Physics / Chemistry / Biology" },
                    { value: "student_chapter", label: "Chapter Performance", sublabel: "Individual · chapter & topic accuracy" },
                    { value: "student_accuracy", label: "Accuracy & Attempt Rate", sublabel: "Individual · per-test accuracy, guesses, negatives" },
                    { value: "student_time", label: "Time Utilization", sublabel: "Individual · fastest / slowest questions" },
                    { value: "student_recoverable", label: "Recoverable Marks", sublabel: "Individual · marks left on the table" },
                    { value: "admin_student", label: "Full Student Dossier", sublabel: "Individual · everything in one document" },
                    { value: "admin_sprint", label: "Sprint Executive Summary", sublabel: "Cohort · one sprint, exam-wise stats" },
                    { value: "admin_batch", label: "Batch Performance", sublabel: "Cohort · one batch, subject rollup" },
                    { value: "admin_comparative", label: "Comparative Ranking", sublabel: "Cohort · students ranked side by side" },
                  ]}
                />
                <CustomSelectMenu
                  label="Format"
                  value={reportFormat}
                  onChange={(val) => setReportFormat(val as "pdf" | "excel")}
                  options={[
                    { value: "pdf", label: "PDF Document", sublabel: "Print-ready, branded" },
                    { value: "excel", label: "Excel Spreadsheet", sublabel: "One sheet per section" },
                  ]}
                />
              </div>

              {/* Student picker — individual reports */}
              {isPerStudentReport && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CustomSelectMenu
                    label="Batch (filters the student list)"
                    value={reportBatchId}
                    onChange={(val) => { setReportBatchId(val); setReportStudentId(""); }}
                    icon={IconLayers}
                    options={[
                      { value: "", label: "All batches" },
                      ...batchOptions.map(b => ({ value: String(b._id || b.id), label: String(b.name || "Batch") })),
                    ]}
                  />
                  <CustomSelectMenu
                    label={reportStudentsLoading ? "Student (loading…)" : `Student (${reportStudents.length})`}
                    value={reportStudentId}
                    onChange={(val) => setReportStudentId(val)}
                    icon={IconGraduationCap}
                    searchable
                    placeholder="-- Pick a student --"
                    options={reportStudents.map(s => ({
                      value: s._id,
                      label: s.name,
                      sublabel: s.email,
                      badge: typeof s.batch === "object" && s.batch ? (s.batch as { name?: string }).name : undefined,
                    }))}
                  />
                </div>
              )}

              {/* Batch picker — cohort reports that need one */}
              {(reportType === "admin_batch" || reportType === "admin_comparative") && (
                <CustomSelectMenu
                  label={reportType === "admin_batch" ? "Batch (required)" : "Batch (optional — leave blank for all)"}
                  value={reportBatchId}
                  onChange={(val) => setReportBatchId(val)}
                  icon={IconLayers}
                  options={[
                    { value: "", label: reportType === "admin_batch" ? "-- Select a batch --" : "All batches" },
                    ...batchOptions.map(b => ({ value: String(b._id || b.id), label: String(b.name || "Batch") })),
                  ]}
                />
              )}

              {/* Sprint scope — multi-select + all */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Sprint scope
                    {reportType === "admin_sprint"
                      ? " · pick exactly one"
                      : reportSprintIds.length === 0
                        ? " · all sprints"
                        : ` · ${reportSprintIds.length} selected`}
                  </label>
                  {reportSprintIds.length > 0 && (
                    <button onClick={() => setReportSprintIds([])} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                      Clear (use all)
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {reportType !== "admin_sprint" && (
                    <button
                      onClick={() => setReportSprintIds([])}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        reportSprintIds.length === 0
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      All sprints
                    </button>
                  )}
                  {sprintOptions.map((s) => {
                    const id = String(s._id || s.id);
                    const on = reportSprintIds.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          if (reportType === "admin_sprint") { setReportSprintIds([id]); return; }
                          setReportSprintIds((prev) => on ? prev.filter(x => x !== id) : [...prev, id]);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                          on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {on && <IconCheck className="w-3 h-3" />}
                        {String(s.name || "Sprint")}
                      </button>
                    );
                  })}
                  {sprintOptions.length === 0 && (
                    <span className="text-xs text-slate-400 font-semibold">No sprints available.</span>
                  )}
                </div>
              </div>

              <button onClick={handleGenerateReport} disabled={reportGenerating} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all">
                {reportGenerating ? <Spinner className="w-4 h-4 text-white" /> : <IconDownload className="w-4 h-4" />}
                {reportGenerating ? "Generating..." : "Generate Report"}
              </button>
            </div>

            {/* Reports list */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Generated Reports</h3>
                <button onClick={loadReports} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">Refresh</button>
              </div>
              {reportsLoading ? (
                <div className="p-6 space-y-3">{[...Array(3)].map((_,i)=><CardSkeleton key={i}/>)}</div>
              ) : reportsList.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500 font-semibold">No reports generated yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reportsList.map((r,i) => {
                    const rId = String(r._id||r.id||i);
                    const status = String(r.status||"pending");
                    const rawType = String(r.type||r.reportType||"Report");
                    const REPORT_LABELS: Record<string,string> = {
                      student_overall: "Overall Performance", student_subject: "Subject Performance",
                      student_chapter: "Chapter Performance", student_time: "Time Utilization",
                      student_accuracy: "Accuracy & Attempt Rate", student_recoverable: "Recoverable Marks",
                      admin_student: "Full Student Dossier", admin_sprint: "Sprint Executive Summary",
                      admin_batch: "Batch Performance", admin_comparative: "Comparative Ranking",
                    };
                    const label = REPORT_LABELS[rawType] || rawType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    const isIndividual = rawType.startsWith("student_") || rawType === "admin_student";
                    const isDownloading = downloadingReportId === rId;
                    const failed = status === "failed";
                    return (
                      <div key={rId} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate">
                            {label}
                            <span className="text-slate-300 font-bold"> · </span>
                            <span className="text-slate-500">{String(r.format||"pdf").toUpperCase()}</span>
                            <span className={`ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isIndividual ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600"}`}>
                              {isIndividual ? "Individual" : "Cohort"}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-semibold truncate">
                            {r.fileName ? String(r.fileName) : (r.createdAt ? new Date(String(r.createdAt)).toLocaleString("en-IN") : "Recent")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={status} />
                          <button
                            onClick={() => handleDownloadReport(rId)}
                            disabled={isDownloading || failed}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isDownloading ? <Spinner className="w-3.5 h-3.5 text-indigo-600" /> : <IconDownload className="w-3.5 h-3.5" />}
                            <span>{failed ? "Unavailable" : "Download"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════ SETTINGS TAB ═════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-5 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl font-black text-slate-900">Account &amp; Security</h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Your administrator profile and sign-in security.</p>
            </div>

            {/* ── Profile card ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 sm:px-6 py-5 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                  {(String(meProfile?.name || user?.name || "A")).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-900 truncate">{String(meProfile?.name || user?.name || "Administrator")}</p>
                  <p className="text-xs font-semibold text-slate-500 truncate">{String(meProfile?.email || user?.email || "")}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    <IconShield className="w-2.5 h-2.5" />
                    {String(meProfile?.role || user?.role || "admin").replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {[
                  { icon: IconMail, label: "Email", value: String(meProfile?.email || user?.email || "—") },
                  { icon: IconPhone, label: "Phone", value: meProfile?.phone ? String(meProfile.phone) : "Not added" },
                  { icon: IconUserCheck, label: "Role", value: String(meProfile?.role || user?.role || "admin").replace(/_/g, " ") },
                  {
                    icon: IconCalendar,
                    label: "Member since",
                    value: meProfile?.createdAt
                      ? new Date(String(meProfile.createdAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
                      : (meLoading ? "Loading…" : "—"),
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 px-5 sm:px-6 py-4">
                    <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 capitalize break-words">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="px-5 sm:px-6 py-3 border-t border-slate-100 text-[10px] font-semibold text-slate-400">
                Name, email and phone are managed by a super admin from the Admin Team console.
              </p>
            </div>

            {/* ── Change password ─────────────────────────────────── */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <IconLock className="w-3.5 h-3.5" />
                </span>
                <h3 className="text-sm font-black text-slate-900">Change Password</h3>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mb-4">
                Use at least 8 characters. Changing it signs you out of other devices.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {[
                  { label: "Current Password", value: currentPassword, set: setCurrentPassword },
                  { label: "New Password", value: newPassword, set: setNewPassword },
                  { label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">{label}</label>
                    <input type={showPasswords ? "text" : "password"} required value={value} onChange={e => set(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all" />
                  </div>
                ))}
                <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                  <button type="button" onClick={() => setShowPasswords(v => !v)}
                    className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
                    {showPasswords ? <IconEyeOff className="w-3 h-3" /> : <IconEye className="w-3 h-3" />}
                  </button>
                  <span className="text-[11px] font-bold text-slate-500">Show passwords</span>
                </label>
                <button type="submit" disabled={pwLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all mt-1">
                  {pwLoading ? <Spinner className="w-4 h-4 text-white" /> : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
      </div>

      {/* ══════════════════════════════════════ MODALS ══════════════════════════════════════ */}
      {/* Sprint creation / blueprint editing is a full-screen flow — see the
          early return above (<SprintBuilder />), not a modal. */}

      {/* Create Batch */}
      <CreateBatchModal
        isOpen={showCreateBatchModal}
        onClose={() => setShowCreateBatchModal(false)}
        onSuccess={refreshBatchesAfterMutation}
        showToast={showToast}
      />

      {/* Edit Batch */}
      <EditBatchModal
        isOpen={showEditBatchModal}
        batchData={selectedBatchToEdit}
        onClose={() => setShowEditBatchModal(false)}
        onSuccess={refreshBatchesAfterMutation}
        showToast={showToast}
      />

      {/* Batch Roster */}
      <BatchRosterModal
        isOpen={showBatchRosterModal}
        batchId={selectedRosterBatchId}
        batchName={selectedRosterBatchName}
        onClose={() => setShowBatchRosterModal(false)}
        showToast={showToast}
      />

      {/* Create Exam */}
      <CreateExamModal
        isOpen={showCreateExamModal}
        sprintList={sprintOptions}
        batchList={batchOptions}
        defaultSprintId={selectedSprintId}
        onClose={() => setShowCreateExamModal(false)}
        onSuccess={loadExams}
        showToast={showToast}
      />

      {/* Exam Attempts Inspector */}
      <ExamAttemptsModal
        isOpen={showExamAttemptsModal}
        examId={selectedExamForAttemptsId}
        examTitle={selectedExamForAttemptsTitle}
        onClose={() => setShowExamAttemptsModal(false)}
        showToast={showToast}
      />

      {/* Edit Student */}
      <EditStudentModal
        isOpen={showEditUserModal}
        userData={selectedUserToEdit}
        batchList={batchOptions}
        onClose={() => setShowEditUserModal(false)}
        onSuccess={loadUsers}
        showToast={showToast}
      />

      {/* Student Analytics Inspector — single instance, serves both the Students
          tab and Leaderboard entry points via analyticsModalSprintId */}
      <StudentAnalyticsModal
        isOpen={showStudentAnalyticsModal}
        student={selectedStudentForAnalytics}
        sprintId={analyticsModalSprintId}
        onClose={() => setShowStudentAnalyticsModal(false)}
        showToast={showToast}
      />

      {/* Formula Config Tuning */}
      <FormulaConfigModal
        isOpen={showFormulaConfigModal}
        sprintId={selectedSprintId}
        onClose={() => setShowFormulaConfigModal(false)}
        showToast={showToast}
      />

      {/* Create User (Password field removed) */}
      <CommonModal isOpen={showCreateUserModal} onClose={()=>setShowCreateUserModal(false)} title="Add Student">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">Full Name</label>
            <input type="text" required value={newUserName} onChange={e=>setNewUserName(e.target.value)} placeholder="Student full name" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none font-medium" /></div>
          <div><label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">Email</label>
            <input type="email" required value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} placeholder="student@examneeti.com" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-4 py-2.5 rounded-xl focus:outline-none font-medium" /></div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block mb-1.5">
              Assigned Batch *
            </label>
            <CustomSelect
              options={batchOptions.map((b) => ({
                value: String(b._id || b.id),
                label: String(b.name || "Batch"),
              }))}
              value={newUserBatchId}
              onChange={setNewUserBatchId}
              placeholder="-- Select Batch --"
              buttonClassName="w-full py-2.5 sm:py-3 bg-slate-50 border border-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 rounded-xl text-xs sm:text-sm font-semibold transition-all"
            />
          </div>
          <button type="submit" disabled={userSubmitting} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer">
            {userSubmitting ? <Spinner className="w-4 h-4 text-white" /> : "Create Student"}
          </button>
        </form>
      </CommonModal>

      {/* Bulk Import — .xlsx / .docx roster */}
      <BulkStudentUploadModal
        isOpen={showBulkImportModal}
        batchList={batchOptions}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={loadUsers}
        showToast={showToast}
      />

      {/* Chapter Topics Specification Modal */}
      <ChapterTopicsModal
        isOpen={showChapterTopicsModal}
        onClose={() => setShowChapterTopicsModal(false)}
        chapterData={selectedChapterForTopics}
        onUpdateTopicWeight={handleUpdateTopicWeight}
        onAddTopicClick={(chap, sub, lvl, unit) => {
          setCreateSyllabusDefaults({
            subject: sub.toLowerCase(),
            classLevel: lvl || "XI",
            chapter: chap,
            unitCode: unit || "",
          });
          setShowCreateSyllabusModal(true);
        }}
        onEditTopicClick={(top: TopicItem) => {
          setSelectedTopicToEdit({
            _id: String(top._id || top.id),
            topic: top.topic || top.name,
            chapter: top.chapter || selectedChapterForTopics?.chapter,
            subject: top.subject || selectedChapterForTopics?.subject,
            classLevel: top.classLevel || selectedChapterForTopics?.classLevel,
            unitCode: top.unitCode || selectedChapterForTopics?.unitCode,
            weight: top.weight,
            isActive: top.isActive,
            topicOrder: top.topicOrder,
            chapterOrder: top.chapterOrder,
          });
          setShowEditSyllabusModal(true);
        }}
        onDeleteTopicClick={(id, name) => handleDeleteSyllabusTopic(id, name)}
        onToggleTopicActive={(id) => handleToggleSyllabusTopicActive(id)}
        onUpdateChapterWeightage={(subject, classLevel, chapter, weightage) => handleUpdateChapterWeightage(subject, classLevel, chapter, weightage)}
        onUpdateTopicWeightage={(id, weightage) => handleUpdateTopicWeightage(id, weightage)}
        onAddSubtopic={(topicId, name, weightage) => handleAddSubtopic(topicId, name, weightage)}
        onUpdateSubtopic={(topicId, subtopicId, data) => handleUpdateSubtopic(topicId, subtopicId, data)}
        onDeleteSubtopic={(topicId, subtopicId) => handleDeleteSubtopic(topicId, subtopicId)}
      />

      {/* Create Syllabus Modal */}
      <CreateSyllabusModal
        isOpen={showCreateSyllabusModal}
        onClose={() => setShowCreateSyllabusModal(false)}
        onSuccess={() => {
          showToast("New syllabus topic added!", "success");
          loadSyllabus();
        }}
        initialSubject={createSyllabusDefaults.subject}
        initialClassLevel={createSyllabusDefaults.classLevel}
        initialChapter={createSyllabusDefaults.chapter}
        initialUnitCode={createSyllabusDefaults.unitCode}
      />

      {/* Edit Syllabus Modal */}
      <EditSyllabusModal
        isOpen={showEditSyllabusModal}
        onClose={() => setShowEditSyllabusModal(false)}
        onSuccess={() => {
          showToast("Syllabus topic updated successfully!", "success");
          loadSyllabus();
        }}
        topicData={selectedTopicToEdit}
      />

      <SprintHistoryModal
        isOpen={sprintHistoryId !== null}
        sprintId={sprintHistoryId}
        onClose={() => setSprintHistoryId(null)}
        showToast={showToast}
      />

    </div>
  );
}
