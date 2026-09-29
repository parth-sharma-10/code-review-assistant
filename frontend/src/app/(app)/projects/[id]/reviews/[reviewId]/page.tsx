"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ReviewResultView } from "@/components/review-result";
import { SeverityCounts } from "@/components/severity";
import { ErrorNote, Loading } from "@/components/ui";
import { formatDate, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReviewDetailPage() {
  const { id, reviewId } = useParams<{ id: string; reviewId: string }>();
  const { data: review, error, loading } = useApi<ReviewDetail>(`/reviews/${reviewId}`);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/projects/${id}/reviews`} className="text-sm text-ink-2 hover:text-ink">
        ← All reviews
      </Link>
      {loading && <Loading label="Loading review" />}
      <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>
      {review && (
        <article className="mt-2 space-y-8">
          <header className="space-y-4 border-b border-rule pb-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {REVIEW_TYPE_LABEL[review.type]}
              </h1>
              <p className="mt-1 font-mono text-xs text-ink-3">
                {formatDate(review.createdAt)} · {review.providerName} · {review.model}
              </p>
            </div>
            {review.type !== "ARCHITECTURE" && (
              <p className="max-w-prose leading-relaxed">{review.summary}</p>
            )}
            <SeverityCounts counts={review} size="lg" />
          </header>
          <ReviewResultView review={review} />
        </article>
      )}
    </main>
  );
}
