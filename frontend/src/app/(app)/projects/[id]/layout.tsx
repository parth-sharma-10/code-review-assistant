"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectContext } from "@/components/project-context";
import { Button, ConfirmDialog, ErrorNote, Loading } from "@/components/ui";
import { api } from "@/lib/api";
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
  const router = useRouter();
  const { data: project, error, reload } = useApi<Project>(`/projects/${id}`);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
          Back to projects
        </Link>
      </main>
    );
  }
  if (!project)
    return (
      <main className="mx-auto max-w-5xl px-4">
        <Loading label="Loading project" />
      </main>
    );

  async function remove() {
    setDeleting(true);
    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      router.replace("/dashboard");
    } catch (err) {
      setDeleteError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  }

  const base = `/projects/${id}`;
  const active = (href: string) =>
    href === ""
      ? pathname === base
      : pathname === base + href || pathname.startsWith(`${base + href}/`);

  return (
    <ProjectContext.Provider value={{ project, reload }}>
      <div className="flex flex-col lg:h-full">
        <div className="shrink-0 border-b border-rule bg-sheet">
          <div className="mx-auto max-w-[1600px] px-4 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-ink-3">
                  <Link href="/dashboard" className="hover:text-ink">
                    Projects
                  </Link>{" "}
                  /
                </p>
                <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
                <p className="font-mono text-xs text-ink-3">
                  {plural(project._count.files, "file")} ·{" "}
                  {plural(project._count.reviews, "review")}
                </p>
              </div>
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete project
              </Button>
            </div>
            <ErrorNote>{deleteError}</ErrorNote>
            <nav aria-label="Project" className="-mb-px mt-4 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={base + t.href}
                  aria-current={active(t.href) ? "page" : undefined}
                  className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-ink-2 hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${project.name}?`}
        body={`This permanently deletes the project, its ${plural(project._count.files, "file")}, ${plural(project._count.reviews, "review")} and chat history.`}
        confirmLabel="Delete project"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </ProjectContext.Provider>
  );
}
