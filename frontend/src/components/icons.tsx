import {
  Braces,
  FileCode2,
  FileJson,
  FileText,
  Gauge,
  GitCompareArrows,
  Network,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReviewType } from "@/lib/types";

/** One icon per review type, used wherever a review is named. */
export const REVIEW_TYPE_ICON: Record<ReviewType, LucideIcon> = {
  SECURITY: ShieldAlert,
  PERFORMANCE: Gauge,
  QUALITY: Sparkles,
  DIFF: GitCompareArrows,
  ARCHITECTURE: Network,
};

export function ReviewTypeIcon({ type, className = "" }: { type: ReviewType; className?: string }) {
  const Icon = REVIEW_TYPE_ICON[type];
  return <Icon aria-hidden strokeWidth={1.75} className={`size-4 shrink-0 ${className}`} />;
}

/** A small set by kind of file, not per language: the name already says the language. */
export function FileIcon({ name, className = "" }: { name: string; className?: string }) {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const Icon =
    ext === "json"
      ? FileJson
      : ["md", "txt", "rst"].includes(ext) || !name.includes(".")
        ? FileText
        : ["yml", "yaml", "toml", "env", "example"].includes(ext)
          ? Braces
          : FileCode2;
  return <Icon aria-hidden strokeWidth={1.75} className={`size-3.5 shrink-0 ${className}`} />;
}
