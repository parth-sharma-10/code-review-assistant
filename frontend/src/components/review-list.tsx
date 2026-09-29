import Link from "next/link";
import { formatDate, formatShortDate, plural, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewSummary } from "@/lib/types";
import { ReviewTypeIcon } from "./icons";
import { TallyCells, TallyHeaders } from "./severity";

/**
 * Reviews as a table: severity counts line up in columns so a column of criticals can be read
 * down the page. The whole row is clickable through the link in its first cell.
 */
export function ReviewList({
  reviews,
  showProject,
}: {
  reviews: ReviewSummary[];
  showProject?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-panel border border-rule bg-sheet shadow-panel">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="border-b border-rule bg-paper text-left text-xs text-ink-3">
          <tr className="[&>th]:py-2 [&>th]:font-medium">
            <th scope="col" className="pl-4">
              Review
            </th>
            {showProject && (
              <th scope="col" className="hidden w-40 pl-4 md:table-cell">
                Project
              </th>
            )}
            <th scope="col" className="hidden w-52 pl-4 lg:table-cell">
              Scope
            </th>
            <TallyHeaders />
            <th aria-hidden className="w-4 sm:hidden" />
            <th scope="col" className="hidden w-32 pr-4 text-right sm:table-cell">
              When
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {reviews.map((r) => (
            <Row key={r.id} review={r} showProject={showProject} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ review: r, showProject }: { review: ReviewSummary; showProject?: boolean }) {
  return (
    <tr className="relative align-baseline transition-colors hover:bg-paper focus-within:bg-paper">
      <td className="min-w-0 py-3 pl-4">
        <Link
          href={`/projects/${r.project.id}/reviews/${r.id}`}
          className="inline-flex items-center gap-2 font-medium text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
        >
          <ReviewTypeIcon type={r.type} className="self-center text-ink-2" />
          {REVIEW_TYPE_LABEL[r.type]}
        </Link>
        <p className="mt-0.5 truncate pl-6 text-[13px] text-ink-2" title={r.summary}>
          {r.summary}
        </p>
        <p className="mt-0.5 truncate pl-6 font-mono text-xs text-ink-3 lg:hidden">
          {showProject && `${r.project.name} · `}
          {scopeLabel(r)}
          <span className="sm:hidden"> · {formatShortDate(r.createdAt)}</span>
        </p>
      </td>
      {showProject && (
        <td className="hidden truncate pl-4 text-ink-2 md:table-cell">{r.project.name}</td>
      )}
      <td className="hidden truncate pl-4 font-mono text-xs text-ink-2 lg:table-cell">
        {scopeLabel(r)}
      </td>
      <TallyCells counts={r} />
      <td aria-hidden className="sm:hidden" />
      <td
        className="hidden pr-4 text-right font-mono text-xs whitespace-nowrap text-ink-3 sm:table-cell"
        title={formatDate(r.createdAt)}
      >
        {formatShortDate(r.createdAt)}
      </td>
    </tr>
  );
}

export function scopeLabel(r: Pick<ReviewSummary, "type" | "scope" | "filePaths">): string {
  if (r.type === "DIFF") return r.filePaths.join(" → ") || "diff";
  if (r.type === "ARCHITECTURE") return "whole project";
  if (r.scope === "PROJECT") return "whole project";
  if (r.scope === "FILE") return r.filePaths[0];
  return r.filePaths.length <= 2 ? r.filePaths.join(", ") : plural(r.filePaths.length, "file");
}
