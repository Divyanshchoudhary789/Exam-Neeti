export interface ExamStartMeta {
  totalQuestions?: number;
  totalMarks?: number;
  instructions?: string;
}

export type SectionId = "overview" | "analytics" | "tests" | "history" | "reports" | "profile";
