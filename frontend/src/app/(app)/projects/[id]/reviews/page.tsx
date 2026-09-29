"use client";

import { useState, type FormEvent } from "react";
import { useProject } from "@/components/project-context";
import { ReviewList } from "@/components/review-list";
import { Button, EmptyState, ErrorNote, Loading, TextInput } from "@/components/ui";
import { REVIEW_TYPE_LABEL } from "@/lib/format";
import type { Page, ReviewSummary, ReviewType } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const PAGE_SIZE = 10;

export default function ReviewHistoryPage() {
  const { project } = useProject();
  const [type, setType] = useState<ReviewType | "">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (type) query.set("type", type);
  if (q) query.set("q", q);
  const { data, error, loading } = useApi<Page<ReviewSummary>>(
    `/projects/${project.id}/reviews?${query}`,
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get("q") ?? "").trim());
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={search} className="flex flex-1 gap-2" role="search">
          <TextInput
            name="q"
            defaultValue={q}
            placeholder="Search summaries, findings and file paths"
            aria-label="Search reviews"
            maxLength={200}
          />
          <Button type="submit">Search</Button>
        </form>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as ReviewType | "");
            setPage(1);
          }}
          aria-label="Filter by review type"
          className="rounded-[4px] border border-rule bg-sheet px-2 py-1.5 text-sm focus:border-ink focus:outline-none"
        >
          <option value="">All review types</option>
          {Object.entries(REVIEW_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading && <Loading label="Loading reviews" />}
      <ErrorNote>{error}</ErrorNote>
      {data?.items.length === 0 && (
        <EmptyState title={q || type ? "No reviews match" : "No reviews yet"}>
          {q || type ? "Try a different search or review type." : "Run one from the code explorer."}
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <p className="text-xs text-ink-3">
            {data.total} review{data.total === 1 ? "" : "s"}
          </p>
          <ReviewList reviews={data.items} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between">
              <Button onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                Previous
              </Button>
              <span className="font-mono text-xs text-ink-3">
                page {page} of {pages}
              </span>
              <Button onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
