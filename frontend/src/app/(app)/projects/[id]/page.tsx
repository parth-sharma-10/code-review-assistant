"use client";

import { ArrowRight, History, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { REVIEW_TYPE_ICON } from "@/components/icons";
import { useProject } from "@/components/project-context";
import { ReviewList } from "@/components/review-list";
import { SeverityBar } from "@/components/severity";
import { useShell } from "@/components/shell";
import { UploadZip } from "@/components/upload-zip";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Page,
  Panel,
  SkeletonRows,
  Spinner,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatShortDate, plural } from "@/lib/format";
import type { Page as ApiPage, Project, ReviewDetail, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ProjectOverviewPage() {
  const { project, reload } = useProject();
  const reviews = useApi<ApiPage<ReviewSummary>>(`/projects/${project.id}/reviews?pageSize=50`);
  const hasFiles = project._count.files > 0;

  return (
    <Page className="space-y-8">
      {!hasFiles ? (
        <Section title="Upload the source to start">
          <UploadZip projectId={project.id} hasFiles={false} onUploaded={reload} />
        </Section>
      ) : (
        <>
          <Summary reviews={reviews.data} />
          <ReviewActions projectId={project.id} onAnalysed={reload} />
        </>
      )}

      <Section
        title="Recent reviews"
        aside={
          reviews.data &&
          reviews.data.total > 5 && (
            <Link
              href={`/projects/${project.id}/reviews`}
              className="flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
            >
              All {reviews.data.total} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )
        }
      >
        {reviews.loading && <SkeletonRows label="Loading reviews" />}
        <ErrorNote>{reviews.error}</ErrorNote>
        {reviews.data?.items.length === 0 && (
          <EmptyState icon={History} title="No reviews yet">
            {hasFiles
              ? "Pick a review above. The first one takes about half a minute on a local model."
              : "Upload the source, then run a review."}
          </EmptyState>
        )}
        {reviews.data && reviews.data.items.length > 0 && (
          <ReviewList reviews={reviews.data.items.slice(0, 5)} />
        )}
      </Section>

      {hasFiles && (
        <Section title="Source">
          <UploadZip
            projectId={project.id}
            hasFiles
            fileCount={project._count.files}
            onUploaded={() => {
              reload();
              reviews.reload();
            }}
          />
        </Section>
      )}

      <DeleteProject project={project} />
    </Page>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Findings across this project's latest reviews: one number, its breakdown, and recency. */
function Summary({ reviews }: { reviews?: ApiPage<ReviewSummary> }) {
  if (!reviews || reviews.items.length === 0) return null;
  const sum = (k: "criticalCount" | "highCount" | "mediumCount" | "lowCount") =>
    reviews.items.reduce((n, r) => n + r[k], 0);
  const counts = {
    criticalCount: sum("criticalCount"),
    highCount: sum("highCount"),
    mediumCount: sum("mediumCount"),
    lowCount: sum("lowCount"),
  };
  const total = counts.criticalCount + counts.highCount + counts.mediumCount + counts.lowCount;
  return (
    <Panel className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      <div>
        <p className="text-[13px] text-ink-2">Findings reported</p>
        <p className="mt-0.5 font-mono text-3xl font-semibold tabular-nums">{total}</p>
        <p className="mt-1 text-xs text-ink-3">
          across {plural(reviews.items.length, "review")} · last{" "}
          {formatShortDate(reviews.items[0].createdAt)}
        </p>
      </div>
      <SeverityBar counts={counts} className="sm:border-l sm:border-rule sm:pl-6" />
    </Panel>
  );
}

/** Each way to review this project as a card: what it does, one control that starts it. */
function ReviewActions({ projectId, onAnalysed }: { projectId: string; onAnalysed: () => void }) {
  const router = useRouter();
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyseArchitecture() {
    setAnalysing(true);
    setError(null);
    try {
      const review = await api<ReviewDetail>(`/projects/${projectId}/architecture-analysis`, {
        body: {},
      });
      onAnalysed();
      router.push(`/projects/${projectId}/reviews/${review.id}`);
    } catch (err) {
      setError((err as Error).message);
      setAnalysing(false);
    }
  }

  return (
    <Section title="Start a review">
      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard
          href={`/projects/${projectId}/code`}
          icon={REVIEW_TYPE_ICON.SECURITY}
          title="Security, performance, quality"
          detail="Pick a file, a selection or the whole project in the code explorer."
        />
        <ActionCard
          href={`/projects/${projectId}/diff`}
          icon={REVIEW_TYPE_ICON.DIFF}
          title="Diff review"
          detail="Compare two versions of a file. Only the changed lines go to the model."
        />
        <ActionCard
          onClick={analyseArchitecture}
          busy={analysing}
          icon={REVIEW_TYPE_ICON.ARCHITECTURE}
          title="Architecture analysis"
          detail={
            analysing
              ? "Reading the key files. This can take a minute on a local model."
              : "Modules, data flow and dependencies from the tree, manifests and entry points."
          }
        />
      </div>
      <div className="mt-2">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Section>
  );
}

function ActionCard({
  href,
  onClick,
  busy,
  icon: Icon,
  title,
  detail,
}: {
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  const body = (
    <>
      <span className="flex size-8 items-center justify-center rounded-control border border-rule bg-paper text-ink transition-colors group-hover:border-ink-3/50 group-hover:bg-sheet">
        {busy ? <Spinner /> : <Icon aria-hidden strokeWidth={1.75} className="size-4" />}
      </span>
      <span className="mt-3 flex items-center gap-1 font-medium text-ink">
        {title}
        <ArrowRight
          aria-hidden
          className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
        />
      </span>
      <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{detail}</span>
    </>
  );
  const cls =
    "group block h-full rounded-panel border border-rule bg-sheet p-4 text-left shadow-panel transition-[border-color,box-shadow] hover:border-ink-3/40 hover:shadow-pop disabled:cursor-progress";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={`${cls} w-full`}
    >
      {body}
    </button>
  );
}

/** The destructive action lives at the end of the page, stated plainly, not in the header. */
function DeleteProject({ project }: { project: Project }) {
  const router = useRouter();
  const { reloadProjects } = useShell();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      reloadProjects();
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-critical/20 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-1">
        <h2 className="font-medium">Delete this project</h2>
        <p className="text-[13px] text-ink-2">
          Removes its files, reviews and chat history. This cannot be undone.
        </p>
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden />
        Delete project
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${project.name}?`}
        body={`This permanently deletes the project, its ${plural(project._count.files, "file")}, ${plural(project._count.reviews, "review")} and chat history.`}
        confirmLabel="Delete project"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
