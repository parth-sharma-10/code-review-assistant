"use client";

import {
  Code2,
  CornerDownLeft,
  FolderGit2,
  LayoutDashboard,
  MessagesSquare,
  Plus,
  PlugZap,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { formatShortDate, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { Page, Project, ReviewSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { REVIEW_TYPE_ICON } from "./icons";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
}

export function buildCommands(projects: Project[], reviews: ReviewSummary[]): Command[] {
  const pages: Command[] = [
    { id: "dash", group: "Go to", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    {
      id: "prov",
      group: "Go to",
      label: "AI providers",
      icon: PlugZap,
      href: "/settings/providers",
    },
    { id: "new", group: "Go to", label: "New project", icon: Plus, href: "/projects/new" },
  ];
  const perProject = projects.flatMap((p): Command[] => [
    { id: p.id, group: "Projects", label: p.name, icon: FolderGit2, href: `/projects/${p.id}` },
    {
      id: `${p.id}-code`,
      group: "Projects",
      label: `${p.name} › Code`,
      icon: Code2,
      href: `/projects/${p.id}/code`,
    },
    {
      id: `${p.id}-chat`,
      group: "Projects",
      label: `${p.name} › Chat`,
      icon: MessagesSquare,
      href: `/projects/${p.id}/chat`,
    },
  ]);
  const recent = reviews.map((r): Command => ({
    id: r.id,
    group: "Recent reviews",
    label: `${REVIEW_TYPE_LABEL[r.type]} · ${r.project.name}`,
    hint: formatShortDate(r.createdAt),
    icon: REVIEW_TYPE_ICON[r.type],
    href: `/projects/${r.project.id}/reviews/${r.id}`,
  }));
  return [...pages, ...perProject, ...recent];
}

/** Every word of the query must appear in the label, in any order. */
export function matches(label: string, query: string): boolean {
  const l = label.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => l.includes(w));
}

export function CommandPalette({
  open,
  onOpenChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[] | undefined;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/25" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 animate-pop-in overflow-hidden rounded-panel border border-rule bg-sheet shadow-pop"
        >
          <Dialog.Title className="sr-only">Jump to</Dialog.Title>
          {/* Mounted only while open, so the query resets and reviews load on demand. */}
          {open && <PaletteBody projects={projects ?? []} onDone={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteBody({ projects, onDone }: { projects: Project[]; onDone: () => void }) {
  const router = useRouter();
  const reviews = useApi<Page<ReviewSummary>>("/reviews?pageSize=8");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const all = useMemo(
    () => buildCommands(projects, reviews.data?.items ?? []),
    [projects, reviews.data],
  );
  const results = all.filter((c) => matches(c.label, query));
  const current = Math.min(active, Math.max(0, results.length - 1));
  const currentId = results[current]?.id;
  useEffect(() => {
    if (currentId)
      document.getElementById(`cmd-${currentId}`)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  function go(c: Command | undefined) {
    if (!c) return;
    onDone();
    router.push(c.href);
  }

  function onKeyDown(e: KeyboardEvent) {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key in moves) {
      e.preventDefault();
      setActive((current + moves[e.key] + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[current]);
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2.5 border-b border-rule px-4">
        <Search aria-hidden className="size-4 text-ink-3" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Jump to a project, page or review"
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-activedescendant={results[current] ? `cmd-${results[current].id}` : undefined}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        <kbd>esc</kbd>
      </div>
      <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
        {results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-ink-3">No matches.</li>
        )}
        {results.map((c, i) => (
          <li key={c.id}>
            {(i === 0 || results[i - 1].group !== c.group) && (
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">
                {c.group}
              </p>
            )}
            <div
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={() => go(c)}
              className="flex h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-sm text-ink-2 aria-selected:bg-wash aria-selected:text-ink"
            >
              <c.icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
              <span className="truncate">{c.label}</span>
              {c.hint && (
                <span className="ml-auto shrink-0 font-mono text-xs text-ink-3">{c.hint}</span>
              )}
              {i === current && (
                <CornerDownLeft
                  aria-hidden
                  className={`size-3.5 shrink-0 text-ink-3 ${c.hint ? "" : "ml-auto"}`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
