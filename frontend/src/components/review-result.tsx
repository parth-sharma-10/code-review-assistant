"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { bySeverity, groupByFile, toFindings, type FileGroup, type Finding } from "@/lib/findings";
import { plural } from "@/lib/format";
import type {
  ArchitectureResult,
  CodeReviewResult,
  DiffReviewResult,
  FileDetail,
  FileMeta,
  ReviewDetail,
  Severity,
} from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { CodeViewer } from "./code-viewer";
import { DiffListing } from "./diff-listing";
import { FindingNote, InlineCode, type Note } from "./finding-note";
import { FindingToolbar, useFindingKeys, useSeverityFilter } from "./finding-nav";
import { CopyButton } from "./ui";

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

function countBySeverity(items: { severity: Severity }[]): Record<Severity, number> {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const i of items) counts[i.severity]++;
  return counts;
}

/** Findings grouped by file, each group showing the cited code with its findings pinned in. */
function CodeResult({ review, result }: { review: ReviewDetail; result: CodeReviewResult }) {
  const findings = useMemo(() => toFindings(result.issues), [result.issues]);
  const filter = useSeverityFilter();
  const { shows } = filter;
  const groups = useMemo(
    () => groupByFile(findings.filter((f) => shows(f.severity))),
    [findings, shows],
  );
  useFindingKeys(useMemo(() => groups.flatMap((g) => g.findings.map((f) => f.id)), [groups]));
  // Every cited file, not just the filtered ones, so toggling a filter never refetches.
  const cited = useMemo(() => [...new Set(findings.map((f) => f.file))], [findings]);
  const sources = useSources(review.project.id, cited);

  return (
    <div className="space-y-10">
      {findings.length === 0 ? (
        <p className="border-y border-rule py-6 text-sm text-ink-2">
          No definite problems found for this review type.
        </p>
      ) : (
        <section aria-label="Findings">
          <FindingToolbar counts={countBySeverity(findings)} filter={filter} />
          <div className="mt-4 space-y-6">
            {groups.map((g) => (
              <FileFindings
                key={g.file}
                group={g}
                review={review}
                source={sources?.get(g.file)}
                loading={sources === null}
              />
            ))}
          </div>
        </section>
      )}
      <Recommendations items={result.recommendations} />
      <Coverage meta={result.meta} projectId={review.project.id} />
    </div>
  );
}

/**
 * Current contents of the files a review cites, keyed by path. null while loading; a missing
 * key means the file is no longer in the project (its source was replaced).
 */
function useSources(projectId: string, paths: string[]) {
  const files = useApi<FileMeta[]>(`/projects/${projectId}/files`);
  const [sources, setSources] = useState<Map<string, FileDetail> | null>(null);
  const key = paths.join("\n");

  useEffect(() => {
    if (!files.data) return;
    let cancelled = false;
    const wanted = new Set(key.split("\n"));
    const metas = files.data.filter((f) => wanted.has(f.path));
    Promise.all(metas.map((f) => api<FileDetail>(`/projects/${projectId}/files/${f.id}`)))
      .then((details) => !cancelled && setSources(new Map(details.map((d) => [d.path, d]))))
      .catch(() => !cancelled && setSources(new Map()));
    return () => {
      cancelled = true;
    };
  }, [files.data, projectId, key]);

  return files.error ? new Map<string, FileDetail>() : sources;
}

function FileFindings({
  group,
  review,
  source,
  loading,
}: {
  group: FileGroup;
  review: ReviewDetail;
  source?: FileDetail;
  loading: boolean;
}) {
  const notes = group.findings.map((f) => ({ ...f, href: codeLink(review, f) }));
  const replaced = source && source.createdAt > review.createdAt;
  return (
    <section
      aria-label={group.file}
      className="overflow-hidden rounded-[4px] border border-rule bg-sheet"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-3 py-2">
        <h2 className="min-w-0 truncate font-mono text-[13px] font-semibold text-ink">
          {group.file}
        </h2>
        <CopyButton text={group.file} label={`Copy path ${group.file}`} />
        <span className="text-xs text-ink-3">{plural(group.findings.length, "finding")}</span>
        {source && (
          <Link
            href={`/projects/${review.project.id}/code?${new URLSearchParams({ file: group.file, review: review.id })}`}
            className="ml-auto text-xs text-ink-2 underline-offset-2 hover:text-ink hover:underline"
          >
            Open whole file
          </Link>
        )}
      </header>
      {replaced && (
        <p className="border-b border-rule bg-medium-tint px-3 py-1.5 text-xs text-medium">
          The source was replaced after this review, so the cited lines may have moved.
        </p>
      )}
      <div className="@container overflow-x-auto">
        {source ? (
          <CodeViewer path={source.path} content={source.content} annotations={notes} context={3} />
        ) : (
          <>
            <p className="px-3 py-1.5 text-xs text-ink-3">
              {loading ? "Loading source…" : "This file is not in the current upload."}
            </p>
            {notes.map((n) => (
              <FindingNote key={n.id} issue={n} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function Coverage({ meta, projectId }: { meta: CodeReviewResult["meta"]; projectId: string }) {
  return (
    <Section title="Coverage">
      <p className="text-sm text-ink-2">Reviewed {plural(meta.reviewedFiles.length, "file")}</p>
      <FileList paths={meta.reviewedFiles} projectId={projectId} />
      {meta.omittedFiles.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-medium">
            {plural(meta.omittedFiles.length, "file")} not reviewed: they did not fit the
            model&apos;s context budget
          </summary>
          <FileList paths={meta.omittedFiles} projectId={projectId} />
        </details>
      )}
      {meta.truncatedFiles.length > 0 && (
        <p className="mt-2 text-sm text-medium">
          Truncated to fit: {meta.truncatedFiles.join(", ")}
        </p>
      )}
      {meta.discardedIssues > 0 && (
        <p className="mt-2 text-sm text-ink-2">
          {plural(meta.discardedIssues, "finding")} discarded because the model cited a file it was
          not shown.
        </p>
      )}
    </Section>
  );
}

const RISK_STYLE: Record<DiffReviewResult["risk"], string> = {
  LOW: "text-ok",
  MEDIUM: "text-medium",
  HIGH: "text-critical",
};

function DiffResult({ review, result }: { review: ReviewDetail; result: DiffReviewResult }) {
  const [basePath, comparePath] = review.filePaths;
  const notes = useMemo(
    () =>
      bySeverity(result.issues).map((issue, i) => ({
        ...issue,
        id: `finding-${i + 1}`,
        location: `${issue.category.toLowerCase()}${issue.line ? ` · new line ${issue.line}` : ""}`,
      })),
    [result.issues],
  );
  const filter = useSeverityFilter();
  const { shows } = filter;
  const visible = useMemo(() => notes.filter((n) => shows(n.severity)), [notes, shows]);
  useFindingKeys(useMemo(() => visible.map((n) => n.id), [visible]));

  return (
    <div className="-mt-4 space-y-8">
      <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-mono text-ok">+{result.meta.linesAdded}</span>
        <span className="font-mono text-critical">−{result.meta.linesRemoved}</span>
        <span className={`font-semibold ${RISK_STYLE[result.risk]}`}>
          {result.risk.charAt(0) + result.risk.slice(1).toLowerCase()} risk
        </span>
        <span className="text-ink-3">as judged by the model</span>
      </p>
      {result.meta.diffTruncated && (
        <p className="text-sm text-medium">The diff was truncated to fit the context budget.</p>
      )}
      {notes.length === 0 && (
        <p className="border-y border-rule py-6 text-sm text-ink-2">
          No problems found in the changes.
        </p>
      )}
      <section aria-label="Changes and findings">
        {notes.length > 0 && <FindingToolbar counts={countBySeverity(notes)} filter={filter} />}
        <div className="mt-4 overflow-hidden rounded-[4px] border border-rule bg-sheet">
          <DiffSource
            projectId={review.project.id}
            basePath={basePath}
            comparePath={comparePath}
            notes={visible}
          />
        </div>
      </section>
      <Recommendations items={result.recommendations} />
    </div>
  );
}

/**
 * Redraws the diff when both versions are project files. Pasted text is not stored, so for an
 * "(edited)" version only the findings can be shown.
 */
function DiffSource({
  projectId,
  basePath,
  comparePath,
  notes,
}: {
  projectId: string;
  basePath: string;
  comparePath: string;
  notes: Note[];
}) {
  const sources = useSources(projectId, [basePath, comparePath]);
  const before = sources?.get(basePath);
  const after = sources?.get(comparePath);
  if (before && after) {
    return (
      <div className="@container overflow-x-auto">
        <DiffListing
          before={before.content}
          after={after.content}
          beforePath={basePath}
          afterPath={comparePath}
          notes={notes}
        />
      </div>
    );
  }
  return (
    <>
      <p className="border-b border-rule px-3 py-1.5 text-xs text-ink-3">
        {sources === null
          ? "Loading the diff…"
          : "The changed version was pasted text, which is not stored, so the diff cannot be redrawn."}
      </p>
      {notes.map((n) => (
        <FindingNote key={n.id} issue={n} />
      ))}
    </>
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
    <div className="space-y-10">
      <Section title="Overview">
        <Prose text={result.overview} />
      </Section>
      <Section title="Components">
        <dl className="divide-y divide-rule border-y border-rule">
          {result.components.map((c, i) => (
            <div key={i} className="grid gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[16rem_1fr]">
              <dt className="min-w-0">
                <span className="block text-sm font-semibold">{c.name}</span>
                {c.path && (
                  <span className="block truncate font-mono text-xs text-ink-3">{c.path}</span>
                )}
              </dt>
              <dd className="text-sm leading-relaxed text-ink-2">{c.responsibility}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Data flow">
        <Prose text={result.dataFlow} />
      </Section>
      <Section title="Dependencies">
        <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
          {result.dependencies.map((d, i) => (
            <div key={i} className="contents">
              <dt className="font-mono text-[13px]">{d.name}</dt>
              <dd className="mb-1.5 text-ink-2 sm:mb-0">{d.purpose}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Concerns" count={result.concerns.length}>
        <div className="overflow-hidden rounded-[4px] border border-rule">
          {bySeverity(result.concerns).map((c, i) => (
            <FindingNote key={i} issue={{ ...c, line: null }} />
          ))}
        </div>
      </Section>
      <Recommendations items={result.recommendations} />
      <Section title="Files read in full">
        <FileList paths={result.meta.keyFiles} projectId={projectId} />
      </Section>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  return <p className="max-w-[72ch] whitespace-pre-line leading-relaxed">{text}</p>;
}

function Recommendations({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="Recommendations" note="Suggestions, not confirmed problems">
      <ul className="max-w-[80ch] space-y-1.5 text-sm leading-relaxed">
        {items.map((r, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-ink-3" />
            <span>
              <InlineCode text={r} />
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FileList({ paths, projectId }: { paths: string[]; projectId: string }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs">
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

function Section({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count?: number;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 text-[15px] font-semibold">
        {title}
        {count !== undefined && (
          <span className="font-mono text-xs font-normal text-ink-3">{count}</span>
        )}
        {note && <span className="text-xs font-normal text-ink-3">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

function codeLink(review: ReviewDetail, issue: Finding): string {
  const q = new URLSearchParams({ file: issue.file, review: review.id });
  if (issue.line) q.set("line", String(issue.line));
  return `/projects/${review.project.id}/code?${q}`;
}
