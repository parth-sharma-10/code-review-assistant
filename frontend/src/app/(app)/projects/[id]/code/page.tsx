"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CodeViewer } from "@/components/code-viewer";
import { FileTree } from "@/components/file-tree";
import { useProject } from "@/components/project-context";
import { ReviewRunner } from "@/components/review-runner";
import { CopyButton, EmptyState, ErrorNote, Loading, Padded, TextInput } from "@/components/ui";
import { formatBytes, plural, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { CodeReviewResult, FileDetail, FileMeta, ReviewDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CodePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Explorer />
    </Suspense>
  );
}

/**
 * URL state: ?file=<path>&line=<n>&review=<id>. Links from a review finding land here with the
 * cited line highlighted and that review's findings pinned into the listing.
 */
function Explorer() {
  const { project } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activePath = params.get("file");
  const [selected, setSelected] = useState<Map<string, FileMeta>>(new Map());
  const all = useApi<FileMeta[]>(`/projects/${project.id}/files`);

  function updateUrl(set: Record<string, string>, remove: string[]) {
    const next = new URLSearchParams(params);
    Object.entries(set).forEach(([k, v]) => next.set(k, v));
    remove.forEach((k) => next.delete(k));
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  function toggleSelect(f: FileMeta) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(f.id)) next.delete(f.id);
      else next.set(f.id, f);
      return next;
    });
  }

  if (all.loading)
    return (
      <Padded>
        <Loading label="Loading files" />
      </Padded>
    );
  if (all.error)
    return (
      <Padded>
        <ErrorNote>{all.error}</ErrorNote>
      </Padded>
    );
  if (!all.data || all.data.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <EmptyState title="No source code yet">
          <Link href={`/projects/${project.id}`} className="font-medium text-ink underline">
            Upload a ZIP
          </Link>{" "}
          to browse and review it here.
        </EmptyState>
      </div>
    );
  }

  const activeMeta = all.data.find((f) => f.path === activePath) ?? null;
  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_300px]">
      <TreePanel
        projectId={project.id}
        files={all.data}
        activePath={activePath}
        selected={selected}
        onOpen={(f) => updateUrl({ file: f.path }, ["line"])}
        onToggleSelect={toggleSelect}
      />
      <ListingPanel
        projectId={project.id}
        activePath={activePath}
        activeMeta={activeMeta}
        focusLine={Number(params.get("line")) || null}
        reviewId={params.get("review")}
        onHideFindings={() => updateUrl({}, ["review", "line"])}
      />
      <aside
        aria-labelledby="run-review"
        className="border-t border-rule bg-paper p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l"
      >
        <h2 id="run-review" className="mb-4 text-[15px] font-semibold">
          Run a review
        </h2>
        <ReviewRunner
          projectId={project.id}
          activeFile={activeMeta}
          selectedIds={[...selected.keys()]}
          totalFiles={all.data.length}
          onClearSelection={() => setSelected(new Map())}
        />
      </aside>
    </div>
  );
}

/** File tree with a client-side name filter and a server-side content search. */
function TreePanel({
  projectId,
  files,
  activePath,
  selected,
  onOpen,
  onToggleSelect,
}: {
  projectId: string;
  files: FileMeta[];
  activePath: string | null;
  selected: Map<string, FileMeta>;
  onOpen: (file: FileMeta) => void;
  onToggleSelect: (file: FileMeta) => void;
}) {
  const [filter, setFilter] = useState("");
  const [contentQuery, setContentQuery] = useState("");
  const searched = useApi<FileMeta[]>(
    contentQuery ? `/projects/${projectId}/files?q=${encodeURIComponent(contentQuery)}` : null,
  );

  const visible = useMemo(() => {
    const base = contentQuery && searched.data ? searched.data : files;
    const f = filter.trim().toLowerCase();
    return f ? base.filter((x) => x.path.toLowerCase().includes(f)) : base;
  }, [files, searched.data, contentQuery, filter]);

  return (
    <aside className="flex max-h-80 flex-col border-b border-rule bg-sheet lg:max-h-none lg:border-r lg:border-b-0">
      <div className="space-y-2 border-b border-rule p-2">
        <TextInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by file name"
          aria-label="Filter files by name"
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setContentQuery(String(new FormData(e.currentTarget).get("q") ?? "").trim());
          }}
        >
          <TextInput
            name="q"
            placeholder="Search file contents ↵"
            aria-label="Search file contents"
            maxLength={200}
          />
        </form>
        {contentQuery && (
          <p className="flex justify-between text-xs text-ink-3">
            <span>
              {searched.loading
                ? "Searching…"
                : `${visible.length} files contain “${contentQuery}”`}
            </span>
            <button onClick={() => setContentQuery("")} className="underline">
              Clear
            </button>
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="p-3 text-sm text-ink-3">No files match.</p>
        ) : (
          <FileTree
            files={visible}
            activePath={activePath}
            selected={new Set(selected.keys())}
            onOpen={onOpen}
            onToggleSelect={onToggleSelect}
          />
        )}
      </div>
    </aside>
  );
}

/** The open file, with the linked review's findings (if any) pinned under their lines. */
function ListingPanel({
  projectId,
  activePath,
  activeMeta,
  focusLine,
  reviewId,
  onHideFindings,
}: {
  projectId: string;
  activePath: string | null;
  activeMeta: FileMeta | null;
  focusLine: number | null;
  reviewId: string | null;
  onHideFindings: () => void;
}) {
  const review = useApi<ReviewDetail>(reviewId ? `/reviews/${reviewId}` : null);
  const file = useApi<FileDetail>(
    activeMeta ? `/projects/${projectId}/files/${activeMeta.id}` : null,
  );
  const annotations = useMemo(() => {
    const result = review.data?.result as CodeReviewResult | undefined;
    return result?.issues?.filter((i) => i.file === activePath) ?? [];
  }, [review.data, activePath]);

  return (
    <section className="flex min-h-[50vh] flex-col bg-sheet lg:min-h-0" aria-label="File contents">
      {review.data && (
        <div className="flex items-center justify-between gap-2 border-b border-marker-edge/50 bg-marker/40 px-4 py-1.5 text-xs">
          <span>
            Findings from{" "}
            <Link
              href={`/projects/${projectId}/reviews/${review.data.id}`}
              className="font-medium underline underline-offset-2"
            >
              {REVIEW_TYPE_LABEL[review.data.type]}
            </Link>
          </span>
          <button className="underline" onClick={onHideFindings}>
            Hide findings
          </button>
        </div>
      )}
      {!activeMeta ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-ink-3">
          {activePath ? `${activePath} is not in this upload.` : "Select a file to view it."}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-rule px-4 py-1.5">
            <h2 className="min-w-0 truncate font-mono text-[13px] font-semibold">
              {activeMeta.path}
            </h2>
            <CopyButton text={activeMeta.path} label={`Copy path ${activeMeta.path}`} />
            <span className="ml-auto shrink-0 font-mono text-xs text-ink-3">
              {annotations.length > 0 && `${plural(annotations.length, "finding")} · `}
              {formatBytes(activeMeta.size)}
            </span>
          </div>
          <div className="@container flex-1 overflow-auto">
            {file.loading && <Loading label="Loading file" />}
            <ErrorNote>{file.error}</ErrorNote>
            {file.data?.path === activePath && file.data && (
              <CodeViewer
                path={file.data.path}
                content={file.data.content}
                focusLine={focusLine}
                annotations={annotations}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
