"use client";

import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { REVIEW_TYPE_ICON } from "@/components/icons";
import { useProject } from "@/components/project-context";
import { ReviewList } from "@/components/review-list";
import { Button, EmptyState, ErrorNote, Page, SkeletonRows, TextInput } from "@/components/ui";
import { REVIEW_TYPE_LABEL } from "@/lib/format";
import type { Page as ApiPage, ReviewSummary, ReviewType } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const PAGE_SIZE = 10;
const TYPES = Object.keys(REVIEW_TYPE_LABEL) as ReviewType[];

export default function ReviewHistoryPage() {
  const { project } = useProject();
  const [type, setType] = useState<ReviewType | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (type) query.set("type", type);
  if (q) query.set("q", q);
  const { data, error, loading } = useApi<ApiPage<ReviewSummary>>(
    `/projects/${project.id}/reviews?${query}`,
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get("q") ?? "").trim());
    setPage(1);
  }

  function chooseType(t: ReviewType | "") {
    setType(t);
    setPage(1);
  }

  return (
    <Page className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form onSubmit={search} className="relative flex-1" role="search">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-3"
          />
          <TextInput
            name="q"
            defaultValue={q}
            placeholder="Search summaries, findings and file paths, then press Enter"
            aria-label="Search reviews"
            maxLength={200}
            className="pl-8"
          />
        </form>
        <div
          role="group"
          aria-label="Filter by review type"
          className="flex flex-wrap gap-0.5 rounded-control border border-rule bg-sheet p-0.5 shadow-panel"
        >
          <TypeChip pressed={type === ""} onClick={() => chooseType("")}>
            All
          </TypeChip>
          {TYPES.map((t) => {
            const Icon = REVIEW_TYPE_ICON[t];
            return (
              <TypeChip key={t} pressed={type === t} onClick={() => chooseType(t)}>
                <Icon aria-hidden strokeWidth={1.75} className="size-3.5" />
                {REVIEW_TYPE_LABEL[t].replace(/ (review|analysis)$/, "")}
              </TypeChip>
            );
          })}
        </div>
      </div>

      {loading && !data && <SkeletonRows rows={4} label="Loading reviews" />}
      <ErrorNote>{error}</ErrorNote>
      {data?.items.length === 0 && (
        <EmptyState icon={History} title={q || type ? "No reviews match" : "No reviews yet"}>
          {q || type ? "Try a different search or review type." : "Run one from the code explorer."}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <p className="mb-2 text-xs text-ink-3">
            {data.total} review{data.total === 1 ? "" : "s"}
            {q && ` matching “${q}”`}
          </p>
          <ReviewList reviews={data.items} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-3 flex items-center justify-between">
              <Button size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <span className="font-mono text-xs text-ink-3">
                {page} / {pages}
              </span>
              <Button size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                Next
                <ChevronRight aria-hidden />
              </Button>
            </nav>
          )}
        </div>
      )}
    </Page>
  );
}

function TypeChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-paper hover:text-ink aria-pressed:bg-wash aria-pressed:font-medium aria-pressed:text-ink"
    >
      {children}
    </button>
  );
}
