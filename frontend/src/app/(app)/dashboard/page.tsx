"use client";

import Link from "next/link";
import { ReviewList } from "@/components/review-list";
import { EmptyState, ErrorNote, Loading } from "@/components/ui";
import { formatDate, plural } from "@/lib/format";
import type { Page, Project, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const projects = useApi<Project[]>("/projects");
  const recent = useApi<Page<ReviewSummary>>("/reviews?pageSize=5");

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <Link
            href="/projects/new"
            className="rounded-[4px] border border-ink bg-ink px-3 py-1.5 text-sm font-medium text-sheet hover:bg-ink/90"
          >
            New project
          </Link>
        </div>

        {projects.loading && <Loading label="Loading projects" />}
        <ErrorNote>{projects.error}</ErrorNote>
        {projects.data?.length === 0 && (
          <EmptyState title="No projects yet">
            Create a project, upload your repository as a ZIP, then run a review.{" "}
            <Link
              href="/projects/new"
              className="font-medium text-ink underline underline-offset-2"
            >
              Create a project
            </Link>
          </EmptyState>
        )}
        {projects.data && projects.data.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block h-full rounded-[4px] border border-rule bg-sheet p-4 hover:border-ink-3"
                >
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="mt-1 line-clamp-2 min-h-[2.6em] text-sm text-ink-2">
                    {p.description || <span className="text-ink-3">No description</span>}
                  </p>
                  <p className="mt-3 font-mono text-xs text-ink-3">
                    {p._count.files === 0 ? "no source uploaded" : plural(p._count.files, "file")} ·{" "}
                    {plural(p._count.reviews, "review")}
                  </p>
                  <p className="font-mono text-xs text-ink-3">updated {formatDate(p.updatedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold">Recent reviews</h2>
        {recent.loading && <Loading label="Loading reviews" />}
        <ErrorNote>{recent.error}</ErrorNote>
        {recent.data?.items.length === 0 && (
          <EmptyState title="No reviews yet">
            Open a project and run a security, performance or quality review.
          </EmptyState>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <ReviewList reviews={recent.data.items} showProject />
        )}
      </section>
    </main>
  );
}
