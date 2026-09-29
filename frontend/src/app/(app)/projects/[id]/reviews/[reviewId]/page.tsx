"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { scopeLabel } from "@/components/review-list";
import { ReviewResultView } from "@/components/review-result";
import { ErrorNote, Loading } from "@/components/ui";
import { formatDate, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReviewDetailPage() {
  const { id, reviewId } = useParams<{ id: string; reviewId: string }>();
  const { data: review, error, loading } = useApi<ReviewDetail>(`/reviews/${reviewId}`);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 pb-16">
      <Link
        href={`/projects/${id}/reviews`}
        className="text-sm text-ink-2 hover:text-ink hover:underline"
      >
        <span aria-hidden>← </span>All reviews
      </Link>
      {loading && <Loading label="Loading review" />}
      <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>
      {review && (
        <article className="mt-1">
          <header className="mb-8 max-w-[80ch]">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {REVIEW_TYPE_LABEL[review.type]}
            </h1>
            <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-xs text-ink-3">
              <span>{scopeLabel(review)}</span>
              <span aria-hidden>·</span>
              <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
              <span aria-hidden>·</span>
              <span>
                {review.providerName} / {review.model}
              </span>
            </p>
            {review.type !== "ARCHITECTURE" && (
              <p className="mt-4 text-[15px] leading-relaxed">{review.summary}</p>
            )}
          </header>
          <ReviewResultView review={review} />
        </article>
      )}
    </main>
  );
}
