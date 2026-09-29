import Link from "next/link";
import type { ReactNode } from "react";
import { plural } from "@/lib/format";
import type {
  ArchitectureResult,
  CodeReviewResult,
  DiffReviewResult,
  ReviewDetail,
  ReviewIssue,
  Severity,
} from "@/lib/types";
import { SEVERITY_BORDER, SeverityBadge } from "./severity";

const ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const bySeverity = <T extends { severity: Severity }>(items: T[]) =>
  [...items].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

export function ReviewResultView({ review }: { review: ReviewDetail }) {
  if (review.type === "DIFF")
    return <DiffResult review={review} result={review.result as DiffReviewResult} />;
  if (review.type === "ARCHITECTURE")
    return (
      <ArchitectureView
        result={review.result as ArchitectureResult}
        projectId={review.project.id}
      />
    );
  return <CodeResult review={review} result={review.result as CodeReviewResult} />;
}

function CodeResult({ review, result }: { review: ReviewDetail; result: CodeReviewResult }) {
  const meta = result.meta;
  return (
    <div className="space-y-8">
      <Section title={`Findings (${result.issues.length})`}>
        {result.issues.length === 0 ? (
          <p className="text-sm text-ink-2">No definite problems found for this review type.</p>
        ) : (
          <ol className="space-y-3">
            {bySeverity(result.issues).map((issue, i) => (
              <IssueCard key={i} issue={issue} href={codeLink(review, issue)} />
            ))}
          </ol>
        )}
      </Section>
      <Recommendations items={result.recommendations} />
      <Section title="Coverage">
        <p className="text-sm text-ink-2">Reviewed {plural(meta.reviewedFiles.length, "file")}:</p>
        <FileList paths={meta.reviewedFiles} projectId={review.project.id} />
        {meta.omittedFiles.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-medium">
              {plural(meta.omittedFiles.length, "file")} not reviewed: they did not fit the
              model&apos;s context budget
            </summary>
            <FileList paths={meta.omittedFiles} projectId={review.project.id} />
          </details>
        )}
        {meta.truncatedFiles.length > 0 && (
          <p className="mt-2 text-sm text-medium">
            Truncated to fit: {meta.truncatedFiles.join(", ")}
          </p>
        )}
        {meta.discardedIssues > 0 && (
          <p className="mt-2 text-sm text-ink-2">
            {plural(meta.discardedIssues, "finding")} discarded because the model cited a file it
            was not shown.
          </p>
        )}
      </Section>
    </div>
  );
}

function DiffResult({ review, result }: { review: ReviewDetail; result: DiffReviewResult }) {
  const riskColor = { LOW: "text-ok", MEDIUM: "text-medium", HIGH: "text-critical" }[result.risk];
  return (
    <div className="space-y-8">
      <p className="font-mono text-sm">
        <span className="text-ink-3">{review.filePaths[0]}</span> →{" "}
        <span>{review.filePaths[1]}</span>
        <span className="ml-3 text-ok">+{result.meta.linesAdded}</span>{" "}
        <span className="text-critical">−{result.meta.linesRemoved}</span>
        <span className={`ml-3 font-medium ${riskColor}`}>{result.risk} risk</span>
      </p>
      {result.meta.diffTruncated && (
        <p className="text-sm text-medium">The diff was truncated to fit the context budget.</p>
      )}
      <Section title={`Findings (${result.issues.length})`}>
        {result.issues.length === 0 ? (
          <p className="text-sm text-ink-2">No problems found in the changes.</p>
        ) : (
          <ol className="space-y-3">
            {bySeverity(result.issues).map((issue, i) => (
              <IssueCard
                key={i}
                issue={issue}
                label={`${issue.category.toLowerCase()}${issue.line ? ` · new line ${issue.line}` : ""}`}
              />
            ))}
          </ol>
        )}
      </Section>
      <Recommendations items={result.recommendations} />
    </div>
  );
}

function ArchitectureView({
  result,
  projectId,
}: {
  result: ArchitectureResult;
  projectId: string;
}) {
  return (
    <div className="space-y-8">
      <Section title="Overview">
        <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{result.overview}</p>
      </Section>
      <Section title="Components">
        <dl className="divide-y divide-rule rounded-[4px] border border-rule bg-sheet">
          {result.components.map((c, i) => (
            <div key={i} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr]">
              <dt>
                <span className="block text-sm font-medium">{c.name}</span>
                {c.path && (
                  <span className="block truncate font-mono text-xs text-ink-3">{c.path}</span>
                )}
              </dt>
              <dd className="text-sm text-ink-2">{c.responsibility}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Data flow">
        <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{result.dataFlow}</p>
      </Section>
      <Section title="Dependencies">
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {result.dependencies.map((d, i) => (
            <li key={i}>
              <span className="font-mono">{d.name}</span>{" "}
              <span className="text-ink-2">— {d.purpose}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Concerns (${result.concerns.length})`}>
        <ol className="space-y-3">
          {bySeverity(result.concerns).map((c, i) => (
            <li
              key={i}
              className={`rounded-[4px] border border-l-4 border-rule bg-sheet p-4 ${SEVERITY_BORDER[c.severity]}`}
            >
              <p className="flex items-center gap-2">
                <SeverityBadge severity={c.severity} />
                <span className="font-medium">{c.title}</span>
              </p>
              <p className="mt-1 text-sm text-ink-2">{c.description}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Recommendations items={result.recommendations} />
      <Section title="Files read in full">
        <FileList paths={result.meta.keyFiles} projectId={projectId} />
      </Section>
    </div>
  );
}

function IssueCard({
  issue,
  href,
  label,
}: {
  issue: Omit<ReviewIssue, "file"> & { file?: string };
  href?: string;
  label?: string;
}) {
  const location = issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ""}` : label;
  return (
    <li
      className={`rounded-[4px] border border-l-4 border-rule bg-sheet p-4 ${SEVERITY_BORDER[issue.severity]}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityBadge severity={issue.severity} />
        <span className="font-medium">{issue.title}</span>
        {location &&
          (href ? (
            <Link
              href={href}
              className="font-mono text-xs text-ink-2 underline decoration-marker-edge decoration-2 underline-offset-2 hover:bg-marker"
            >
              {location}
            </Link>
          ) : (
            <span className="font-mono text-xs text-ink-3">{location}</span>
          ))}
      </div>
      <p className="mt-2 text-sm text-ink-2">{issue.description}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Fix: </span>
        {issue.recommendation}
      </p>
    </li>
  );
}

function Recommendations({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="Recommendations">
      <p className="mb-2 text-xs text-ink-3">Suggestions, not confirmed problems.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </Section>
  );
}

function FileList({ paths, projectId }: { paths: string[]; projectId: string }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs">
      {paths.map((p) => (
        <li key={p}>
          <Link
            href={`/projects/${projectId}/code?file=${encodeURIComponent(p)}`}
            className="text-ink-2 hover:text-ink hover:underline"
          >
            {p}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function codeLink(review: ReviewDetail, issue: ReviewIssue): string {
  const q = new URLSearchParams({ file: issue.file, review: review.id });
  if (issue.line) q.set("line", String(issue.line));
  return `/projects/${review.project.id}/code?${q}`;
}
