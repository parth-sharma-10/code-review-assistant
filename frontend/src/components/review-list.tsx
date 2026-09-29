import Link from "next/link";
import { formatDate, plural, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewSummary } from "@/lib/types";
import { SeverityCounts } from "./severity";

export function ReviewList({
  reviews,
  showProject,
}: {
  reviews: ReviewSummary[];
  showProject?: boolean;
}) {
  return (
    <ul className="divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
      {reviews.map((r) => {
        const total = r.criticalCount + r.highCount + r.mediumCount + r.lowCount;
        return (
          <li key={r.id}>
            <Link
              href={`/projects/${r.project.id}/reviews/${r.id}`}
              className="flex flex-col gap-3 px-4 py-3 hover:bg-wash sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-ink">{REVIEW_TYPE_LABEL[r.type]}</span>
                  <span className="text-ink-3">
                    {r.type === "ARCHITECTURE"
                      ? `${plural(total, "concern")}`
                      : plural(total, "issue")}
                    {" · "}
                    {scopeLabel(r)}
                    {showProject && ` · ${r.project.name}`}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{r.summary}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {formatDate(r.createdAt)} · {r.model}
                </p>
              </div>
              <SeverityCounts counts={r} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function scopeLabel(r: ReviewSummary): string {
  if (r.type === "DIFF") return r.filePaths[0] ?? "diff";
  if (r.scope === "PROJECT") return "whole project";
  if (r.scope === "FILE") return r.filePaths[0];
  return plural(r.filePaths.length, "file");
}
