"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useProject } from "@/components/project-context";
import { ReviewList } from "@/components/review-list";
import { UploadZip } from "@/components/upload-zip";
import {
  Button,
  buttonClass,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  Loading,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import type { Page, Project, ReviewDetail, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ProjectOverviewPage() {
  const { project, reload } = useProject();
  const reviews = useApi<Page<ReviewSummary>>(`/projects/${project.id}/reviews?pageSize=5`);
  const hasFiles = project._count.files > 0;

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-16">
      <header className="max-w-[72ch]">
        {project.description ? (
          <p className="text-[15px] leading-relaxed">{project.description}</p>
        ) : (
          <p className="text-ink-3">No description.</p>
        )}
        <p className="mt-1.5 font-mono text-xs text-ink-3">
          created {formatDate(project.createdAt)} · updated {formatDate(project.updatedAt)}
        </p>
      </header>

      {hasFiles ? (
        <ReviewActions projectId={project.id} onAnalysed={reload} />
      ) : (
        <Block title="Upload the source to start">
          <p className="mb-3 max-w-prose text-sm text-ink-2">
            Reviews, chat and diffs all read from an uploaded ZIP of the repository.
          </p>
          <UploadZip projectId={project.id} hasFiles={false} onUploaded={reload} />
        </Block>
      )}

      <Block
        title="Recent reviews"
        aside={
          reviews.data &&
          reviews.data.total > 5 && (
            <Link
              href={`/projects/${project.id}/reviews`}
              className="text-sm text-ink-2 hover:text-ink hover:underline"
            >
              All {reviews.data.total} reviews <span aria-hidden>→</span>
            </Link>
          )
        }
      >
        {reviews.loading && <Loading label="Loading reviews" />}
        <ErrorNote>{reviews.error}</ErrorNote>
        {reviews.data?.items.length === 0 && (
          <EmptyState title="No reviews yet">
            {hasFiles
              ? "Choose a review above. The first one takes about half a minute on a local model."
              : "Upload the source, then run a review."}
          </EmptyState>
        )}
        {reviews.data && reviews.data.items.length > 0 && (
          <ReviewList reviews={reviews.data.items} />
        )}
      </Block>

      {hasFiles && (
        <Block title="Source">
          <p className="mb-3 text-sm text-ink-2">
            {plural(project._count.files, "file")} stored. Replacing the ZIP removes them; past
            reviews are kept.
          </p>
          <UploadZip
            projectId={project.id}
            hasFiles
            onUploaded={() => {
              reload();
              reviews.reload();
            }}
          />
        </Block>
      )}

      <DeleteProject project={project} />
    </main>
  );
}

function Block({
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

/** Each way to review this project, as a row: what it does, then the one control that starts it. */
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
    <Block title="Review">
      <ul className="divide-y divide-rule border-y border-rule">
        <ActionRow
          title="Security, performance or code quality"
          detail="Choose a file, a selection or the whole project in the code explorer."
        >
          <Link href={`/projects/${projectId}/code`} className={buttonClass("primary")}>
            Open code explorer
          </Link>
        </ActionRow>
        <ActionRow
          title="Diff review"
          detail="Compare two versions of a file; only the changed lines go to the model."
        >
          <Link href={`/projects/${projectId}/diff`} className={buttonClass()}>
            Compare versions
          </Link>
        </ActionRow>
        <ActionRow
          title="Architecture analysis"
          detail="Modules, data flow and dependencies, from the tree, manifests and entry points."
        >
          <Button onClick={analyseArchitecture} busy={analysing}>
            {analysing ? "Analysing…" : "Analyse architecture"}
          </Button>
        </ActionRow>
      </ul>
      {analysing && (
        <p role="status" className="mt-2 text-xs text-ink-3">
          This reads the key files and can take a minute on a local model.
        </p>
      )}
      <div className="mt-2">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Block>
  );
}

function ActionRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-2">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

/** The destructive action lives at the end of the page, stated plainly, not in the header. */
function DeleteProject({ project }: { project: Project }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/projects/${project.id}`, { method: "DELETE" });
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-6 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-1">
        <h2 className="font-medium">Delete this project</h2>
        <p className="text-sm text-ink-2">
          Removes its files, reviews and chat history. This cannot be undone.
        </p>
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
      <Button variant="danger" onClick={() => setConfirming(true)}>
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
