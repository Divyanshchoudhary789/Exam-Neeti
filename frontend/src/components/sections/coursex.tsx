"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "../../store/api";

interface Batch {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  studentCount?: number;
  createdAt?: string;
}

interface Student {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  batchId?: string;
  batch?: {
    _id?: string;
    name?: string;
    description?: string;
  } | string | null;
  isActive?: boolean;
  profilePicture?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}


export function CourseXBatches() {
  // Navigation view: "batches" | "students"
  const [view, setView] = useState<"batches" | "students">("batches");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // ---------------- BATCHES STATE ----------------
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState<string>("all");
  const [batchPage, setBatchPage] = useState(1);
  const [batchTotalPages, setBatchTotalPages] = useState(1);

  // Create / Edit Batch Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchDesc, setBatchDesc] = useState("");
  const [batchIsActive, setBatchIsActive] = useState(true);
  const [batchFormError, setBatchFormError] = useState("");
  const [batchFormSubmitting, setBatchFormSubmitting] = useState(false);

  // ---------------- STUDENTS STATE ----------------
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>("all");
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);

  // Single Student Create/Edit Modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [studentFormError, setStudentFormError] = useState("");
  const [studentSubmitting, setStudentSubmitting] = useState(false);

  // Bulk Import Students Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStudents, setBulkStudents] = useState<Array<{ name: string; email: string; phone: string }>>([
    { name: "", email: "", phone: "" },
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState("");


  // Student Detail Popup Modal
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);

  // ================= API FETCHERS =================

  // 1. Fetch Batches: GET /batches/?page&limit&skip&isActive&search
  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError("");
    try {
      const activeParam =
        batchStatusFilter === "true"
          ? true
          : batchStatusFilter === "false"
          ? false
          : "";

      const queryParts = [`page=${batchPage}`, `limit=10`];
      if (batchSearch) queryParts.push(`search=${encodeURIComponent(batchSearch)}`);
      if (activeParam !== "") queryParts.push(`isActive=${activeParam}`);

      const res = await api.get(`/batches/?${queryParts.join("&")}`);
      const data = res.data;

      const list =
        data?.batches ??
        data?.data?.batches ??
        (Array.isArray(data?.data) ? data?.data : Array.isArray(data) ? data : []);

      const total =
        data?.pagination?.totalPages ??
        data?.totalPages ??
        data?.data?.totalPages ??
        Math.ceil((data?.pagination?.total ?? data?.total ?? data?.data?.total ?? list.length) / 10) ??
        1;

      setBatches(list);
      setBatchTotalPages(total || 1);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to load batches:", errorObj);
      setBatchesError(
        errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to fetch batches."
      );
    } finally {
      setBatchesLoading(false);
    }
  }, [batchPage, batchSearch, batchStatusFilter]);

  // 2. Fetch Students: GET /users/?page&limit&skip&batchId=&search&isActive
  const loadStudents = useCallback(async (batchId = selectedBatch?._id || selectedBatch?.id || "") => {
    setStudentsLoading(true);
    setStudentsError("");
    try {
      const activeParam =
        studentStatusFilter === "true"
          ? true
          : studentStatusFilter === "false"
          ? false
          : "";

      const queryParts = [`page=${studentPage}`, `limit=10`];
      if (batchId) queryParts.push(`batchId=${batchId}`);
      if (studentSearch) queryParts.push(`search=${encodeURIComponent(studentSearch)}`);
      if (activeParam !== "") queryParts.push(`isActive=${activeParam}`);

      const res = await api.get(`/users/?${queryParts.join("&")}`);
      const data = res.data;

      const list =
        data?.users ??
        data?.students ??
        data?.data?.users ??
        data?.data?.students ??
        (Array.isArray(data?.data) ? data?.data : Array.isArray(data) ? data : []);

      const total =
        data?.pagination?.totalPages ??
        data?.totalPages ??
        data?.data?.totalPages ??
        Math.ceil((data?.pagination?.total ?? data?.total ?? data?.data?.total ?? list.length) / 10) ??
        1;

      setStudents(list);
      setStudentTotalPages(total || 1);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to load students:", errorObj);
      setStudentsError(
        errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to fetch students list."
      );
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedBatch, studentPage, studentSearch, studentStatusFilter]);

  useEffect(() => {
    let ignore = false;
    const execute = async () => {
      await Promise.resolve();
      if (ignore) return;
      if (view === "batches") {
        loadBatches();
      } else {
        loadStudents();
      }
    };
    execute();
    return () => {
      ignore = true;
    };
  }, [view, loadBatches, loadStudents]);

  // ================= BATCH HANDLERS =================

  const openCreateBatchModal = () => {
    setEditingBatch(null);
    setBatchName("");
    setBatchDesc("");
    setBatchIsActive(true);
    setBatchFormError("");
    setShowBatchModal(true);
  };

  const openEditBatchModal = (batch: Batch) => {
    setEditingBatch(batch);
    setBatchName(batch.name || "");
    setBatchDesc(batch.description || "");
    setBatchIsActive(batch.isActive !== false);
    setBatchFormError("");
    setShowBatchModal(true);
  };

  // POST /batches/ OR PUT /batches/:id
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setBatchFormError("Please provide a batch name.");
      return;
    }
    setBatchFormSubmitting(true);
    setBatchFormError("");
    try {
      if (editingBatch) {
        const id = editingBatch._id || editingBatch.id;
        await api.patch(`/batches/${id}`, {
          name: batchName,
          description: batchDesc,
          isActive: batchIsActive,
        });
      } else {
        await api.post("/batches/", {
          name: batchName,
          description: batchDesc,
        });
      }
      setShowBatchModal(false);
      loadBatches();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setBatchFormError(errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to save batch");
    } finally {
      setBatchFormSubmitting(false);
    }
  };

  // DELETE /batches/:id
  const handleDeleteBatch = async (id: string) => {
    if (!confirm("Are you sure you want to delete this batch? This action cannot be undone.")) return;
    try {
      await api.delete(`/batches/${id}`);
      loadBatches();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to delete batch");
    }
  };

  // PATCH /batches/:id/deactivate OR /batches/:id/reactivate
  const handleToggleBatchStatus = async (batch: Batch) => {
    const id = batch._id || batch.id;
    const isCurrentlyActive = batch.isActive !== false;
    const action = isCurrentlyActive ? "deactivate" : "reactivate";
    try {
      await api.patch(`/batches/${id}/${action}`);
      setBatches((prev) =>
        prev.map((b) => ((b._id || b.id) === id ? { ...b, isActive: !isCurrentlyActive } : b))
      );
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj?.response?.data?.message ?? errorObj?.message ?? `Failed to ${action} batch`);
    }
  };

  // Open Full Page Students View for a Batch
  const handleOpenBatchStudents = (batch: Batch) => {
    setSelectedBatch(batch);
    setStudentPage(1);
    setStudentSearch("");
    setView("students");
  };

  // ================= STUDENT HANDLERS =================

  const openCreateStudentModal = () => {
    setEditingStudent(null);
    setStudentName("");
    setStudentEmail("");
    setStudentPhone("");
    setStudentFormError("");
    setShowStudentModal(true);
  };

  const openEditStudentModal = (st: Student) => {
    setEditingStudent(st);
    setStudentName(st.name || "");
    setStudentEmail(st.email || "");
    setStudentPhone(st.phone || st.phoneNumber || "");
    setStudentFormError("");
    setShowStudentModal(true);
  };

  // POST /users/ OR PUT /users/:id
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEmail) {
      setStudentFormError("Name and Email are required fields.");
      return;
    }
    setStudentSubmitting(true);
    setStudentFormError("");
    try {
      const payload = {
        name: studentName,
        email: studentEmail,
        phone: studentPhone,
        batchId: selectedBatch?._id || selectedBatch?.id,
      };

      if (editingStudent) {
        const id = editingStudent._id || editingStudent.id;
        await api.patch(`/users/${id}`, payload);
      } else {
        await api.post("/users/", payload);
      }
      setShowStudentModal(false);
      loadStudents();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Error saving student:", errorObj);
      setStudentFormError(errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to save student.");
    } finally {
      setStudentSubmitting(false);
    }
  };

  // DELETE /users/:id
  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to remove this student?")) return;
    try {
      await api.delete(`/users/${id}`);
      loadStudents();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed to delete student");
    }
  };

  // PATCH /users/:id/deactivate OR /users/:id/reactivate
  const handleToggleStudentStatus = async (st: Student) => {
    const id = st._id || st.id;
    const isCurrentlyActive = st.isActive !== false;
    const action = isCurrentlyActive ? "deactivate" : "reactivate";
    try {
      await api.patch(`/users/${id}/${action}`);
      setStudents((prev) =>
        prev.map((s) => ((s._id || s.id) === id ? { ...s, isActive: !isCurrentlyActive } : s))
      );
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorObj?.response?.data?.message ?? errorObj?.message ?? `Failed to ${action} student`);
    }
  };

  // Helper functions for Bulk Import dynamic form
  const handleAddBulkRow = () => {
    setBulkStudents((prev) => [...prev, { name: "", email: "", phone: "" }]);
  };

  const handleRemoveBulkRow = (index: number) => {
    setBulkStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkRowChange = (index: number, field: "name" | "email" | "phone", value: string) => {
    setBulkStudents((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // POST /users/bulk-import
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError("");
    setBulkSuccessMsg("");

    // Filter out completely blank rows
    const validStudents = bulkStudents.filter((s) => s.name.trim() || s.email.trim() || s.phone.trim());

    if (validStudents.length === 0) {
      setBulkError("Please fill in at least one student's information.");
      return;
    }

    // Validate required fields (Name & Email)
    for (let i = 0; i < validStudents.length; i++) {
      const st = validStudents[i];
      if (!st.name.trim() || !st.email.trim()) {
        setBulkError(`Student #${i + 1} is missing a required Name or Email.`);
        return;
      }
    }

    setBulkSubmitting(true);
    try {
      const payload = {
        batchId: selectedBatch?._id || selectedBatch?.id,
        students: validStudents.map((s) => ({
          name: s.name.trim(),
          email: s.email.trim(),
          phone: s.phone.trim(),
        })),
      };

      const res = await api.post("/users/bulk-import", payload);
      setBulkSuccessMsg(res?.data?.message || `${validStudents.length} students imported successfully!`);
      setTimeout(() => {
        setShowBulkModal(false);
        setBulkStudents([{ name: "", email: "", phone: "" }]);
        setBulkSuccessMsg("");
        loadStudents();
      }, 1500);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      console.error("Bulk import error:", errorObj);
      setBulkError(errorObj?.response?.data?.message ?? errorObj?.message ?? "Failed bulk import.");
    } finally {
      setBulkSubmitting(false);
    }
  };


  // GET details for a particular student GET /users/:id
  const handleViewStudentDetails = async (st: Student) => {
    const id = st._id || st.id;
    if (!id) return;
    try {
      const res = await api.get(`/users/${id}`);
      const data =
        res?.data?.data?.student ??
        res?.data?.student ??
        res?.data?.user ??
        res?.data?.data ??
        res?.data ??
        st;
      setSelectedStudentDetail(data);
    } catch {
      setSelectedStudentDetail(st);
    }
  };


  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">

      {/* Header Banner & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            {view === "students" && (
              <button
                onClick={() => { setView("batches"); setSelectedBatch(null); }}
                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                title="Back to Batches"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h3 className="text-xl font-extrabold text-slate-900">
              {view === "batches"
                ? "Student Cohorts & Batches"
                : `Batch Roster: ${selectedBatch?.name || "All Enrolled Students"}`}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {view === "batches"
              ? "Create, monitor, and manage student batches and academy enrollments."
              : `Full page student manager for ${selectedBatch?.name ? selectedBatch.name : "all active batches"}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === "batches" ? (
            <button
              onClick={openCreateBatchModal}
              className="px-4 py-2.5 bg-[#1e69ff] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Create Batch</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowBulkModal(true); setBulkError(""); setBulkSuccessMsg(""); }}
                className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Bulk Import</span>
              </button>
              <button
                onClick={openCreateStudentModal}
                className="px-4 py-2.5 bg-[#1e69ff] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <span>+ Add Student</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= VIEW 1: BATCHES LIST ================= */}
      {view === "batches" && (
        <div className="space-y-5">

          {/* Search and Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search batches by name or description…"
                value={batchSearch}
                onChange={(e) => { setBatchSearch(e.target.value); setBatchPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#1e69ff]"
              />
            </div>

            <div>
              <select
                value={batchStatusFilter}
                onChange={(e) => { setBatchStatusFilter(e.target.value); setBatchPage(1); }}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2.5 focus:outline-none focus:border-[#1e69ff] cursor-pointer"
              >
                <option value="all">All Batches (Active & Inactive)</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Error Banner */}
          {batchesError && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <span className="font-semibold">{batchesError}</span>
              <button onClick={loadBatches} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer">Retry</button>
            </div>
          )}

          {/* Loading Skeletons */}
          {batchesLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Batches Cards Grid */}
          {!batchesLoading && !batchesError && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 font-semibold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No student batches found matching your search.
                </div>
              ) : (
                batches.map((b) => {
                  const id = b._id || b.id || "";
                  const isActive = b.isActive !== false;

                  return (
                    <div
                      key={id}
                      className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2 text-left">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-extrabold text-slate-900 text-base">{b.name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{b.description || "No description provided."}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <button
                          onClick={() => handleOpenBatchStudents(b)}
                          className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e69ff] rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span>View Roster</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditBatchModal(b)}
                            title="Edit Batch"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleToggleBatchStatus(b)}
                            title={isActive ? "Deactivate Batch" : "Reactivate Batch"}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isActive ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDeleteBatch(id)}
                            title="Delete Batch"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Batches Pagination */}
          {!batchesLoading && batchTotalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium">Page {batchPage} of {batchTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={batchPage <= 1}
                  onClick={() => setBatchPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={batchPage >= batchTotalPages}
                  onClick={() => setBatchPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= VIEW 2: FULL PAGE STUDENTS ROSTER ================= */}
      {view === "students" && (
        <div className="space-y-5">

          {/* Search & Status Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search students by name or email…"
                value={studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); setStudentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#1e69ff]"
              />
            </div>

            <div>
              <select
                value={studentStatusFilter}
                onChange={(e) => { setStudentStatusFilter(e.target.value); setStudentPage(1); }}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2.5 focus:outline-none focus:border-[#1e69ff] cursor-pointer"
              >
                <option value="all">All Students (Active & Inactive)</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Students Error Banner */}
          {studentsError && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <span className="font-semibold">{studentsError}</span>
              <button onClick={() => loadStudents()} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer">Retry</button>
            </div>
          )}

          {/* Students Loading State */}
          {studentsLoading && (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl" />
              ))}
            </div>
          )}

          {/* Students Roster Table */}
          {!studentsLoading && !studentsError && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold text-[11px] border-b border-slate-100 pb-2">
                    <th className="pb-3 px-3 font-semibold">Student Name</th>
                    <th className="pb-3 px-3 font-semibold">Email</th>
                    <th className="pb-3 px-3 font-semibold">Phone</th>
                    <th className="pb-3 px-3 font-semibold">Status</th>
                    <th className="pb-3 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold">
                        No students enrolled in this batch yet.
                      </td>
                    </tr>
                  ) : (
                    students.map((st, idx) => {
                      const id = st._id || st.id || "";
                      const isActive = st.isActive !== false;
                      const phone = st.phone || st.phoneNumber || "N/A";

                      return (
                        <tr key={id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-3">
                            <div
                              onClick={() => handleViewStudentDetails(st)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                                {(st.name || "S").charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 group-hover:text-[#1e69ff] transition-colors">{st.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-600">{st.email}</td>
                          <td className="py-3.5 px-3 font-mono text-slate-500">{phone}</td>
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewStudentDetails(st)}
                                title="View Info"
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEditStudentModal(st)}
                                title="Edit Student"
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleToggleStudentStatus(st)}
                                title={isActive ? "Deactivate" : "Reactivate"}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isActive ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(id)}
                                title="Delete Student"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Students Pagination */}
          {!studentsLoading && studentTotalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium">Page {studentPage} of {studentTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={studentPage <= 1}
                  onClick={() => setStudentPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={studentPage >= studentTotalPages}
                  onClick={() => setStudentPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT BATCH ================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {editingBatch ? "Update Batch Information" : "Create New Student Batch"}
            </h3>

            {batchFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {batchFormError}
              </div>
            )}

            <form onSubmit={handleSaveBatch} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Batch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch 2026-27"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Description</label>
                <textarea
                  rows={3}
                  placeholder="Batch created for NEET/JEE students..."
                  value={batchDesc}
                  onChange={(e) => setBatchDesc(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                />
              </div>

              {editingBatch && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="batchActive"
                    checked={batchIsActive}
                    onChange={(e) => setBatchIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1e69ff] focus:ring-[#1e69ff] cursor-pointer"
                  />
                  <label htmlFor="batchActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Batch Active Status
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchFormSubmitting}
                  className="px-5 py-2 bg-[#1e69ff] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {batchFormSubmitting ? "Saving..." : "Save Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE / EDIT SINGLE STUDENT ================= */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {editingStudent ? "Edit Student Account" : "Add Student to Batch"}
            </h3>

            {studentFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {studentFormError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ram Choudhary"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="ram@gmail.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Phone Number</label>
                <input
                  type="tel"
                  placeholder="9002270066"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentSubmitting}
                  className="px-5 py-2 bg-[#1e69ff] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {studentSubmitting ? "Saving..." : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: BULK IMPORT STUDENTS ================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-100 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Bulk Import Students</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add multiple student records for batch <strong className="text-slate-900">{selectedBatch?.name || "Selected Batch"}</strong>.
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {bulkError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium shrink-0">
                {bulkError}
              </div>
            )}

            {bulkSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold shrink-0">
                {bulkSuccessMsg}
              </div>
            )}

            <form onSubmit={handleBulkImport} className="flex-1 flex flex-col justify-between overflow-hidden space-y-4 text-left">
              
              {/* Scrollable list of student rows */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
                {bulkStudents.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        Student #{idx + 1}
                      </span>

                      {bulkStudents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkRow(idx)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete Student</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ram Choudhary"
                          value={st.name}
                          onChange={(e) => handleBulkRowChange(idx, "name", e.target.value)}
                          className="w-full rounded-xl bg-white border border-slate-200 text-xs px-3 py-2 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="ram@gmail.com"
                          value={st.email}
                          onChange={(e) => handleBulkRowChange(idx, "email", e.target.value)}
                          className="w-full rounded-xl bg-white border border-slate-200 text-xs px-3 py-2 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Phone</label>
                        <input
                          type="tel"
                          placeholder="9002270066"
                          value={st.phone}
                          onChange={(e) => handleBulkRowChange(idx, "phone", e.target.value)}
                          className="w-full rounded-xl bg-white border border-slate-200 text-xs px-3 py-2 text-slate-900 focus:outline-none focus:border-[#1e69ff]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Add Another Student</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {bulkSubmitting ? "Importing..." : `Import ${bulkStudents.length} Student${bulkStudents.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* ================= MODAL: STUDENT DETAILS POPUP ================= */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                  {(selectedStudentDetail.name || "S").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedStudentDetail.name}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Role: {selectedStudentDetail.role || "Student"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400 font-semibold">Email:</span>
                  <span className="font-mono font-bold text-slate-800 break-all">{selectedStudentDetail.email}</span>
                </div>

                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-400 font-semibold">Phone:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedStudentDetail.phone || selectedStudentDetail.phoneNumber || "N/A"}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Account Status:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${selectedStudentDetail.isActive !== false ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"}`}>
                    {selectedStudentDetail.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Batch Info Card */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-1">
                <span className="block text-[10px] font-extrabold uppercase text-indigo-500 tracking-wider">Assigned Batch</span>
                {typeof selectedStudentDetail.batch === "object" && selectedStudentDetail.batch !== null && "name" in selectedStudentDetail.batch && (selectedStudentDetail.batch as { name?: string; description?: string }).name ? (
                  <>
                    <span className="font-extrabold text-slate-900 text-sm block">{(selectedStudentDetail.batch as { name?: string; description?: string }).name}</span>
                    {(selectedStudentDetail.batch as { name?: string; description?: string }).description && (
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-0.5">{(selectedStudentDetail.batch as { name?: string; description?: string }).description}</p>
                    )}
                  </>
                ) : (
                  <span className="font-bold text-slate-700 block">{selectedBatch?.name || "Standard Batch"}</span>
                )}
              </div>

              {selectedStudentDetail.createdAt && (
                <div className="flex justify-between items-center px-1 text-[10px] text-slate-400 pt-1">
                  <span>Joined Date:</span>
                  <span className="font-mono">{new Date(selectedStudentDetail.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}