"use client";

// The student dashboard uses a top-nav shell (reference-design reskin) under
// ./dashboard/TopNavShell. This file is the stable import path used by
// app/student/page.tsx.
export { StudentDashboard } from "./dashboard/TopNavShell";
export type { ExamStartMeta } from "./dashboard/types";
