"use client";

import Link from "next/link";
import { formatShortDate, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewSummary } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { countsOf, SEVERITY_STYLE } from "./severity";
import { Tooltip } from "./ui";

const HEIGHT = 120;

/**
 * Findings per review, oldest to newest: one stacked column per review, severity segments with a
 * 2px surface gap. Each column is a link to its review, so hover, focus and click all work.
 */
export function FindingsChart({ reviews }: { reviews: ReviewSummary[] }) {
  const series = [...reviews].reverse();
  const totals = series.map((r) => SEVERITIES.reduce((n, s) => n + countsOf(r)[s], 0));
  const max = Math.max(1, ...totals);
  const ticks = [0, Math.ceil(max / 2), max];

  return (
    <figure>
      <div className="flex gap-3">
        <div
          aria-hidden
          className="flex flex-col-reverse justify-between py-px text-right font-mono text-[11px] text-ink-3"
          style={{ height: HEIGHT }}
        >
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: HEIGHT }}>
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 h-px bg-rule"
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}
          <ol className="relative flex h-full items-end justify-around gap-1">
            {series.map((r, i) => (
              <Column key={r.id} review={r} total={totals[i]} max={max} />
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-7 text-xs text-ink-2">
        <span className="text-ink-3">
          Latest {series.length} reviews, oldest first. Hover or focus a column for details.
        </span>
        <span className="flex flex-wrap gap-3">
          {SEVERITIES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={`size-2 rounded-[2px] ${SEVERITY_STYLE[s].mark}`} />
              {SEVERITY_STYLE[s].label}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

function Column({ review: r, total, max }: { review: ReviewSummary; total: number; max: number }) {
  const counts = countsOf(r);
  const label = `${REVIEW_TYPE_LABEL[r.type]}, ${r.project.name}, ${formatShortDate(r.createdAt)}: ${total} findings`;
  return (
    <li className="flex h-full min-w-0 flex-1 justify-center">
      <Tooltip
        label={
          <span className="block">
            <span className="block font-medium">{REVIEW_TYPE_LABEL[r.type]}</span>
            <span className="block text-sheet/70">
              {r.project.name} · {formatShortDate(r.createdAt)}
            </span>
            <span className="mt-1 flex gap-2 font-mono">
              {SEVERITIES.map((s) => (
                <span key={s}>
                  {SEVERITY_STYLE[s].short} {counts[s]}
                </span>
              ))}
            </span>
          </span>
        }
      >
        <Link
          href={`/projects/${r.project.id}/reviews/${r.id}`}
          aria-label={label}
          className="group flex h-full w-full max-w-6 flex-col justify-end rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {total === 0 ? (
            <span className="h-0.5 w-full rounded-full bg-rule" />
          ) : (
            <span
              className="flex w-full origin-bottom animate-[col-grow_480ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col-reverse gap-0.5 overflow-hidden rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{ height: `${(total / max) * 100}%` }}
            >
              {SEVERITIES.map(
                (s) =>
                  counts[s] > 0 && (
                    <span
                      key={s}
                      className={SEVERITY_STYLE[s].mark}
                      style={{ flexGrow: counts[s], flexBasis: 0 }}
                    />
                  ),
              )}
            </span>
          )}
        </Link>
      </Tooltip>
    </li>
  );
}
