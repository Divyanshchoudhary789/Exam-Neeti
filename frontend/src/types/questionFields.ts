export type QuestionFieldType = "text" | "textarea" | "number" | "select" | "boolean";

/**
 * Admin-defined extra field for the Question Bank (e.g. "Sub Topic").
 * Mirrors backend/models/QuestionFieldDefinition.model.js.
 */
export interface QuestionFieldDefinition {
  _id: string;
  key: string;
  label: string;
  type: QuestionFieldType;
  options?: string[];
  required: boolean;
  isActive: boolean;
  order: number;
  helpText?: string;
  min?: number | null;
  max?: number | null;
}

export type CustomFieldValue = string | number | boolean;
export type CustomFieldValues = Record<string, CustomFieldValue>;
