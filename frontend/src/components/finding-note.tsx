import Link from "next/link";
import type { ReviewIssue } from "@/lib/types";
import { SEVERITY_STYLE, SeverityLabel } from "./severity";
import { CopyButton } from "./ui";

/** A finding as rendered in a listing. Diff findings have no file; review pages add id and href. */
export type Note = Omit<ReviewIssue, "file" | "line" | "recommendation"> & {
  file?: string;
  line?: number | null;
  recommendation?: string;
  /** Anchor id, also the keyboard-navigation target. */
  id?: string;
  /** Where the location links to, e.g. the line in the code explorer. */
  href?: string;
  /** Shown instead of file:line, e.g. "bug · new line 8" for a diff finding. */
  location?: string;
};

/**
 * A reviewer's note written into the listing: a severity rule on the left, the claim, why it
 * matters, and the fix. Flat on purpose: it belongs to the line above it, not floating over it.
 */
export function FindingNote({ issue }: { issue: Note }) {
  const location =
    issue.location ?? (issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ""}` : null);
  return (
    <article
      id={issue.id}
      tabIndex={issue.id ? -1 : undefined}
      aria-label={`${SEVERITY_STYLE[issue.severity].label}: ${issue.title}`}
      className={`sticky left-0 w-[100cqw] max-w-full scroll-mt-[5.5rem] border-y border-l-[3px] border-y-rule bg-paper py-3 pr-4 pl-4 font-sans text-sm outline-none focus-visible:bg-wash focus-visible:shadow-[inset_0_0_0_1px_var(--color-ink)] ${SEVERITY_STYLE[issue.severity].edge}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SeverityLabel severity={issue.severity} />
        <h3 className="min-w-0 font-semibold text-ink">{issue.title}</h3>
        {location && (
          <span className="ml-auto flex items-center gap-0.5 font-mono text-xs">
            {issue.href ? (
              <Link
                href={issue.href}
                title="Open in the code explorer"
                className="rounded-[3px] px-1 text-ink-2 underline decoration-marker-edge decoration-2 underline-offset-2 hover:bg-marker hover:text-ink"
              >
                {location}
              </Link>
            ) : (
              <span className="px-1 text-ink-3">{location}</span>
            )}
            {issue.file && <CopyButton text={location} label={`Copy ${location}`} />}
          </span>
        )}
      </header>
      <p className="mt-1.5 max-w-[75ch] leading-relaxed text-ink-2">
        <InlineCode text={issue.description} />
      </p>
      {issue.recommendation && (
        <p className="mt-2 max-w-[75ch] leading-relaxed text-ink">
          <span className="mr-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            Fix
          </span>
          <InlineCode text={issue.recommendation} />
        </p>
      )}
    </article>
  );
}

/** Model text often quotes code in backticks; render those spans as code, never as HTML. */
export function InlineCode({ text }: { text: string }) {
  return text.split(/(`[^`\n]+`)/).map((part, i) =>
    part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded-[3px] bg-wash px-1 font-mono text-[0.92em] text-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
