// Mirrors the backend's API responses (see API.md).

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export type ReviewType = "SECURITY" | "PERFORMANCE" | "QUALITY" | "DIFF" | "ARCHITECTURE";
export type ReviewScope = "FILE" | "FILES" | "PROJECT";
export type ProviderType = "OPENAI" | "LM_STUDIO" | "OLLAMA" | "OPENROUTER" | "CUSTOM";

export interface User {
  id: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { files: number; reviews: number };
}

export interface FileMeta {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
}

export interface FileDetail extends FileMeta {
  mimeType: string;
  content: string;
  createdAt: string;
}

export interface UploadResult {
  storedFiles: number;
  totalBytes: number;
  skippedCount: number;
  skipped: { path: string; reason: string }[];
}

export interface ReviewSummary {
  id: string;
  type: ReviewType;
  scope: ReviewScope;
  summary: string;
  filePaths: string[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  providerName: string;
  model: string;
  createdAt: string;
  project: { id: string; name: string };
}

export interface ReviewIssue {
  title: string;
  description: string;
  severity: Severity;
  file: string;
  line: number | null;
  recommendation: string;
}

export interface CodeReviewResult {
  summary: string;
  issues: ReviewIssue[];
  recommendations: string[];
  meta: {
    promptVersion: string;
    reviewedFiles: string[];
    omittedFiles: string[];
    truncatedFiles: string[];
    discardedIssues: number;
  };
}

export interface DiffReviewResult {
  summary: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  issues: (Omit<ReviewIssue, "file"> & { category: string })[];
  recommendations: string[];
  meta: { linesAdded: number; linesRemoved: number; diffTruncated: boolean };
}

export interface ArchitectureResult {
  overview: string;
  components: { name: string; path: string | null; responsibility: string }[];
  dataFlow: string;
  dependencies: { name: string; purpose: string }[];
  concerns: { title: string; description: string; severity: Severity }[];
  recommendations: string[];
  meta: { keyFiles: string[] };
}

export interface ReviewDetail extends ReviewSummary {
  result: CodeReviewResult | DiffReviewResult | ArchitectureResult;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  hasApiKey: boolean;
  createdAt: string;
}

export interface ProvidersResponse {
  providers: Provider[];
  environmentFallback: { model: string } | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  contextFiles: string[];
  createdAt: string;
}
