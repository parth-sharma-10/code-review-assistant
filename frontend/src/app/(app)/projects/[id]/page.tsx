"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProject } from "@/components/project-context";
import { ReviewList } from "@/components/review-list";
import { UploadZip } from "@/components/upload-zip";
import { Button, EmptyState, ErrorNote, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Page, ReviewDetail, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ProjectOverviewPage() {
  const { project, reload } = useProject();
  const reviews = useApi<Page<ReviewSummary>>(`/projects/${project.id}/reviews?pageSize=5`);
  const hasFiles = project._count.files > 0;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="space-y-2">
        {project.description && <p className="max-w-prose text-ink-2">{project.description}</p>}
        <p className="text-xs text-ink-3">
          Created {formatDate(project.createdAt)} · updated {formatDate(project.updatedAt)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Source code</h2>
        <UploadZip
          projectId={project.id}
          hasFiles={hasFiles}
          onUploaded={() => {
            reload();
            reviews.reload();
          }}
        />
      </section>

      {hasFiles && <ReviewActions projectId={project.id} onAnalysed={reload} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Recent reviews</h2>
          {reviews.data && reviews.data.total > 5 && (
            <Link
              href={`/projects/${project.id}/reviews`}
              className="text-sm text-ink-2 underline underline-offset-2"
            >
              All {reviews.data.total} reviews
            </Link>
          )}
        </div>
        {reviews.loading && <Loading label="Loading reviews" />}
        <ErrorNote>{reviews.error}</ErrorNote>
        {reviews.data?.items.length === 0 && (
          <EmptyState title="No reviews yet">
            {hasFiles
              ? "Open the code explorer to run the first review."
              : "Upload source code to start reviewing."}
          </EmptyState>
        )}
        {reviews.data && reviews.data.items.length > 0 && (
          <ReviewList reviews={reviews.data.items} />
        )}
      </section>
    </main>
  );
}

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
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Review</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[4px] border border-rule bg-sheet p-4">
          <p className="font-medium">Security, performance or quality review</p>
          <p className="mt-1 text-sm text-ink-2">
            Pick a file, several files or the whole project in the code explorer, then choose a
            review type.
          </p>
          <Link
            href={`/projects/${projectId}/code`}
            className="mt-3 inline-block rounded-[4px] border border-ink bg-ink px-3 py-1.5 text-sm font-medium text-sheet hover:bg-ink/90"
          >
            Open code explorer
          </Link>
        </div>
        <div className="rounded-[4px] border border-rule bg-sheet p-4">
          <p className="font-medium">Architecture analysis</p>
          <p className="mt-1 text-sm text-ink-2">
            Summarises modules, data flow and dependencies from the file tree, manifests and entry
            points.
          </p>
          <Button className="mt-3" onClick={analyseArchitecture} busy={analysing}>
            {analysing ? "Analysing… this can take a minute" : "Analyse architecture"}
          </Button>
          <div className="mt-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        </div>
      </div>
    </section>
  );
}
