"use client";

import { ArrowLeft, Bot, CalendarClock, Crosshair } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ReviewTypeIcon } from "@/components/icons";
import { scopeLabel } from "@/components/review-list";
import { ReviewResultView } from "@/components/review-result";
import { SeverityBar } from "@/components/severity";
import { ErrorNote, Page, Panel, Skeleton } from "@/components/ui";
import { formatDate, REVIEW_TYPE_LABEL } from "@/lib/format";
import type { ReviewDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReviewDetailPage() {
  const { id, reviewId } = useParams<{ id: string; reviewId: string }>();
  const { data: review, error, loading } = useApi<ReviewDetail>(`/reviews/${reviewId}`);

  return (
    <Page>
      <Link
        href={`/projects/${id}/reviews`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        All reviews
      </Link>
      <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>
      {loading && <HeaderSkeleton />}
      {review && (
        <article>
          <Panel as="header" className="mb-8 overflow-hidden">
            <div className="flex flex-wrap items-start gap-4 p-5">
              <span className="hidden size-10 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper text-ink sm:flex">
                <ReviewTypeIcon type={review.type} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight">
                  {REVIEW_TYPE_LABEL[review.type]}
                </h1>
                <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
                  <Meta icon={<Crosshair className="size-3.5" />}>
                    <span className="font-mono text-xs">{scopeLabel(review)}</span>
                  </Meta>
                  <Meta icon={<CalendarClock className="size-3.5" />}>
                    <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                  </Meta>
                  <Meta icon={<Bot className="size-3.5" />}>
                    {review.providerName}{" "}
                    <span className="font-mono text-xs text-ink-3">{review.model}</span>
                  </Meta>
                </ul>
                {review.type !== "ARCHITECTURE" && (
                  <p className="mt-3 max-w-[80ch] text-[15px] leading-relaxed">{review.summary}</p>
                )}
              </div>
            </div>
            <div className="border-t border-rule bg-paper px-5 py-4">
              <SeverityBar counts={review} />
            </div>
          </Panel>
          <ReviewResultView review={review} />
        </article>
      )}
    </Page>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="text-ink-3">
        {icon}
      </span>
      {children}
    </li>
  );
}

function HeaderSkeleton() {
  return (
    <Panel className="mb-8 p-5" role="status" aria-label="Loading review">
      <div className="flex gap-4">
        <Skeleton className="size-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        </div>
      </div>
    </Panel>
  );
}
