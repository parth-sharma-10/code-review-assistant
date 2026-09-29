"use client";

import {
  Code2,
  FolderGit2,
  GitCompareArrows,
  History,
  LayoutDashboard,
  MessagesSquare,
  Play,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { ProjectContext } from "@/components/project-context";
import { useShell } from "@/components/shell";
import { buttonClass, ErrorNote, Page, Skeleton } from "@/components/ui";
import { plural } from "@/lib/format";
import type { Project } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/reviews", label: "Reviews", icon: History },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/diff", label: "Diff review", icon: GitCompareArrows },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { reloadProjects } = useShell();
  const { data: project, error, reload } = useApi<Project>(`/projects/${id}`);
  // File and review counts show in the header and the sidebar; refresh both together.
  const reloadAll = useCallback(() => {
    reload();
    reloadProjects();
  }, [reload, reloadProjects]);

  if (error) {
    return (
      <Page>
        <ErrorNote>{error}</ErrorNote>
        <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
          Back to the dashboard
        </Link>
      </Page>
    );
  }
  if (!project) return <HeaderSkeleton />;

  const base = `/projects/${id}`;
  const active = (href: string) =>
    href === ""
      ? pathname === base
      : pathname === base + href || pathname.startsWith(`${base + href}/`);

  return (
    <ProjectContext.Provider value={{ project, reload: reloadAll }}>
      <div className="flex flex-1 flex-col lg:min-h-0">
        <header className="shrink-0 border-b border-rule bg-sheet">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4 sm:px-6">
            <span className="hidden size-10 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper text-ink-2 sm:flex">
              <FolderGit2 aria-hidden strokeWidth={1.75} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-mono text-lg font-semibold tracking-tight">
                {project.name}
              </h1>
              <p className="truncate text-[13px] text-ink-3">
                {plural(project._count.files, "file")} · {plural(project._count.reviews, "review")}
                {project.description && <> · {project.description}</>}
              </p>
            </div>
            {project._count.files > 0 && !active("/code") && (
              <Link href={`${base}/code`} className={buttonClass("primary")}>
                <Play aria-hidden />
                Review code
              </Link>
            )}
          </div>
          <nav aria-label="Project" className="mt-3 flex gap-1 overflow-x-auto px-3 sm:px-5">
            {TABS.map((t) => (
              <Tab key={t.href} tab={t} href={base + t.href} active={active(t.href)}>
                {t.href === "/reviews" && project._count.reviews > 0 && (
                  <span className="rounded-full bg-wash px-1.5 font-mono text-[11px] text-ink-2 tabular-nums">
                    {project._count.reviews}
                  </span>
                )}
              </Tab>
            ))}
          </nav>
        </header>
        <div className="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">{children}</div>
      </div>
    </ProjectContext.Provider>
  );
}

/** The underline slides between tabs (shared layoutId) so the move reads as one control. */
function Tab({
  tab,
  href,
  active,
  children,
}: {
  tab: (typeof TABS)[number];
  href: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="group relative flex items-center gap-1.5 px-2.5 pt-1.5 pb-2.5 text-sm whitespace-nowrap text-ink-2 hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className="size-4 opacity-70 group-aria-[current=page]:opacity-100"
      />
      {tab.label}
      {children}
      {active && (
        <motion.span
          layoutId="project-tab"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-ink"
        />
      )}
    </Link>
  );
}

function HeaderSkeleton() {
  return (
    <div
      className="border-b border-rule bg-sheet px-4 pt-4 pb-3 sm:px-6"
      role="status"
      aria-label="Loading project"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
      <div className="mt-5 flex gap-4">
        {TABS.map((t) => (
          <Skeleton key={t.href} className="h-4 w-16" />
        ))}
      </div>
    </div>
  );
}
