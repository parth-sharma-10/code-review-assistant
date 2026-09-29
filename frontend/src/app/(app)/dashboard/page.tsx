"use client";

import { FolderGit2, History, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FindingsChart } from "@/components/findings-chart";
import { ReviewList } from "@/components/review-list";
import { SeverityBar } from "@/components/severity";
import { useShell } from "@/components/shell";
import {
  buttonClass,
  EmptyState,
  ErrorNote,
  Page,
  PageHeader,
  Panel,
  Skeleton,
  SkeletonRows,
} from "@/components/ui";
import { formatDate, formatShortDate } from "@/lib/format";
import type { Page as ApiPage, Project, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Counts = Pick<ReviewSummary, "criticalCount" | "highCount" | "mediumCount" | "lowCount">;
const ZERO: Counts = { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 };

function add(a: Counts, b: Counts): Counts {
  return {
    criticalCount: a.criticalCount + b.criticalCount,
    highCount: a.highCount + b.highCount,
    mediumCount: a.mediumCount + b.mediumCount,
    lowCount: a.lowCount + b.lowCount,
  };
}

export default function DashboardPage() {
  const { projects } = useShell();
  // The API caps a page at 50; every aggregate below says it covers the latest reviews.
  const recent = useApi<ApiPage<ReviewSummary>>("/reviews?pageSize=50");
  const reviews = recent.data?.items ?? [];
  const byProject = new Map<string, Counts>();
  for (const r of reviews) byProject.set(r.project.id, add(byProject.get(r.project.id) ?? ZERO, r));

  return (
    <Page className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="What your latest reviews found, and where."
        actions={
          <Link href="/projects/new" className={buttonClass("primary")}>
            <Plus aria-hidden />
            New project
          </Link>
        }
      />
      <ErrorNote>{recent.error}</ErrorNote>
      {recent.loading && <StatsSkeleton />}
      {recent.data && reviews.length > 0 && (
        <Overview
          reviews={reviews}
          total={recent.data.total}
          projectCount={projects?.length ?? 0}
        />
      )}

      <Section title="Projects">
        {!projects && <SkeletonRows rows={2} label="Loading projects" />}
        {projects?.length === 0 && (
          <EmptyState
            icon={FolderGit2}
            title="No projects yet"
            action={
              <Link href="/projects/new" className={buttonClass("primary")}>
                <Plus aria-hidden />
                New project
              </Link>
            }
          >
            A project holds one repository: upload it as a ZIP, then review files, compare versions
            or ask questions about it.
          </EmptyState>
        )}
        {projects && projects.length > 0 && (
          <ProjectTable projects={projects} findings={byProject} />
        )}
      </Section>

      <Section title="Recent reviews">
        {recent.loading && <SkeletonRows label="Loading reviews" />}
        {recent.data && reviews.length === 0 && (
          <EmptyState icon={History} title="No reviews yet">
            Open a project and run a security, performance or quality review.
          </EmptyState>
        )}
        {reviews.length > 0 && <ReviewList reviews={reviews.slice(0, 6)} showProject />}
      </Section>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Overview({
  reviews,
  total,
  projectCount,
}: {
  reviews: ReviewSummary[];
  total: number;
  projectCount: number;
}) {
  const counts = reviews.reduce(add, ZERO);
  const findings = counts.criticalCount + counts.highCount + counts.mediumCount + counts.lowCount;
  return (
    <Panel className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col justify-between gap-6 border-b border-rule p-5 lg:border-r lg:border-b-0">
        <dl className="grid grid-cols-3 gap-4">
          <Stat label="Projects" value={projectCount} />
          <Stat label="Reviews" value={total} />
          <Stat
            label="Findings"
            value={findings}
            note={total > reviews.length ? `latest ${reviews.length}` : undefined}
          />
        </dl>
        <div>
          <p className="mb-2 text-[13px] text-ink-2">By severity</p>
          <SeverityBar counts={counts} />
        </div>
      </div>
      <div className="p-5">
        <p className="mb-4 text-[13px] text-ink-2">Findings per review</p>
        <FindingsChart reviews={reviews.slice(0, 24)} />
      </div>
    </Panel>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-[11px] text-ink-3">{note}</dd>}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <Panel className="p-5" role="status" aria-label="Loading summary">
      <div className="flex gap-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-24 w-full" />
    </Panel>
  );
}

function ProjectTable({
  projects,
  findings,
}: {
  projects: Project[];
  findings: Map<string, Counts>;
}) {
  return (
    <div className="overflow-hidden rounded-panel border border-rule bg-sheet shadow-panel">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="border-b border-rule bg-paper text-left text-xs text-ink-3">
          <tr className="[&>th]:py-2 [&>th]:font-medium">
            <th scope="col" className="pl-4">
              Project
            </th>
            <th scope="col" className="hidden w-56 pl-4 md:table-cell">
              Findings in latest reviews
            </th>
            <th scope="col" className="w-16 text-right">
              Files
            </th>
            <th scope="col" className="w-20 pr-4 text-right sm:pr-0">
              Reviews
            </th>
            <th scope="col" className="hidden w-32 pr-4 text-right sm:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {projects.map((p) => (
            <tr
              key={p.id}
              className="relative align-middle transition-colors hover:bg-paper focus-within:bg-paper"
            >
              <td className="py-3 pl-4">
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-2 font-mono text-[13px] font-semibold text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
                >
                  <FolderGit2 aria-hidden strokeWidth={1.75} className="size-4 text-ink-2" />
                  {p.name}
                </Link>
                <p
                  className="mt-0.5 truncate pl-6 text-[13px] text-ink-2"
                  title={p.description ?? undefined}
                >
                  {p.description || <span className="text-ink-3">No description</span>}
                </p>
              </td>
              <td className="hidden pr-6 pl-4 md:table-cell">
                <SeverityBar counts={findings.get(p.id) ?? ZERO} legend={false} />
              </td>
              <td className="text-right font-mono tabular-nums text-ink-2">
                {p._count.files || <span className="text-ink-3">–</span>}
              </td>
              <td className="pr-4 text-right font-mono text-ink-2 tabular-nums sm:pr-0">
                {p._count.reviews}
              </td>
              <td
                className="hidden pr-4 text-right font-mono text-xs whitespace-nowrap text-ink-3 sm:table-cell"
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
