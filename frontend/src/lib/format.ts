import type { ReviewType } from "./types";

export const REVIEW_TYPE_LABEL: Record<ReviewType, string> = {
  SECURITY: "Security review",
  PERFORMANCE: "Performance review",
  QUALITY: "Code quality review",
  DIFF: "Diff review",
  ARCHITECTURE: "Architecture analysis",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDate(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
