"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ProjectContext } from "@/components/project-context";
import { ErrorNote, Loading } from "@/components/ui";
import { plural } from "@/lib/format";
import type { Project } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/code", label: "Code" },
  { href: "/reviews", label: "Reviews" },
  { href: "/chat", label: "Chat" },
  { href: "/diff", label: "Diff review" },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: project, error, reload } = useApi<Project>(`/projects/${id}`);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
          Back to projects
        </Link>
      </main>
    );
  }
  if (!project)
    return (
      <main className="mx-auto max-w-6xl px-4">
        <Loading label="Loading project" />
      </main>
    );

  const base = `/projects/${id}`;
  const active = (href: string) =>
    href === ""
      ? pathname === base
      : pathname === base + href || pathname.startsWith(`${base + href}/`);

  return (
    <ProjectContext.Provider value={{ project, reload }}>
      <div className="flex flex-col lg:h-full">
        <div className="shrink-0 border-b border-rule bg-sheet">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-end gap-x-8 px-4">
            <div className="flex min-w-0 items-baseline gap-3 pt-3 pb-2 lg:py-2.5">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">
                <Link href={base} className="hover:underline">
                  {project.name}
                </Link>
              </h1>
              <p className="shrink-0 font-mono text-xs text-ink-3">
                {plural(project._count.files, "file")}
              </p>
            </div>
            <nav
              aria-label="Project"
              className="-mb-px flex w-full gap-1 overflow-x-auto sm:w-auto"
            >
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={base + t.href}
                  aria-current={active(t.href) ? "page" : undefined}
                  className="flex items-baseline gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 text-sm whitespace-nowrap text-ink-2 hover:border-rule hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
                >
                  {t.label}
                  {t.href === "/reviews" && project._count.reviews > 0 && (
                    <span className="font-mono text-xs font-normal text-ink-3">
                      {project._count.reviews}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</div>
      </div>
    </ProjectContext.Provider>
  );
}
