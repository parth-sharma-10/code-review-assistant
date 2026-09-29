"use client";

import Link from "next/link";
import { ReviewList } from "@/components/review-list";
import { buttonClass, EmptyState, ErrorNote, Loading } from "@/components/ui";
import { formatDate, formatShortDate } from "@/lib/format";
import type { Page, Project, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function DashboardPage() {
  const projects = useApi<Project[]>("/projects");
  const recent = useApi<Page<ReviewSummary>>("/reviews?pageSize=5");

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-16">
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-[22px] font-semibold tracking-tight">Projects</h1>
          <Link href="/projects/new" className={buttonClass("primary")}>
            New project
          </Link>
        </div>

        {projects.loading && <Loading label="Loading projects" />}
        <ErrorNote>{projects.error}</ErrorNote>
        {projects.data?.length === 0 && (
          <EmptyState title="No projects yet">
            A project holds one repository: upload it as a ZIP, then review files, compare versions
            or ask questions about it.{" "}
            <Link
              href="/projects/new"
              className="font-medium text-ink underline underline-offset-2"
            >
              Create the first project
            </Link>
          </EmptyState>
        )}
        {projects.data && projects.data.length > 0 && <ProjectTable projects={projects.data} />}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Recent reviews</h2>
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

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-rule bg-sheet">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="border-b border-rule text-left text-xs text-ink-3">
          <tr className="[&>th]:py-1.5 [&>th]:font-medium">
            <th scope="col" className="pl-3">
              Project
            </th>
            <th scope="col" className="w-20 text-right">
              Files
            </th>
            <th scope="col" className="w-20 text-right">
              Reviews
            </th>
            <th scope="col" className="hidden w-36 pr-3 text-right sm:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {projects.map((p) => (
            <tr key={p.id} className="relative align-baseline hover:bg-wash focus-within:bg-wash">
              <td className="py-2.5 pl-3">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
                >
                  {p.name}
                </Link>
                <p className="mt-0.5 truncate text-ink-2" title={p.description ?? undefined}>
                  {p.description || <span className="text-ink-3">No description</span>}
                </p>
              </td>
              <td className="text-right font-mono tabular-nums text-ink-2">
                {p._count.files || <span className="text-ink-3">none</span>}
              </td>
              <td className="text-right font-mono tabular-nums text-ink-2">{p._count.reviews}</td>
              <td
                className="hidden pr-3 text-right font-mono text-xs whitespace-nowrap text-ink-3 sm:table-cell"
                title={formatDate(p.updatedAt)}
              >
                {formatShortDate(p.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
