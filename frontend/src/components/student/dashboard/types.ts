export interface ExamStartMeta {
  totalQuestions?: number;
  totalMarks?: number;
  instructions?: string;
}

export type SectionId =
  | "overview"
  | "performance"
  | "subjects"
  | "chapters"
  | "tests"
  | "analytics"
  | "history"
  | "reports"
  | "profile";
