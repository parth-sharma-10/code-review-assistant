"use client";

import Link from "next/link";
import type { ProvidersResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/**
 * Which configured provider runs the request. Empty value = the user's default (or the
 * server's fallback). Renders a pointer to settings when nothing is configured.
 */
export function ProviderSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data } = useApi<ProvidersResponse>("/ai/providers");
  if (!data) return null;

  if (data.providers.length === 0 && !data.environmentFallback) {
    return (
      <p className="rounded-[4px] border border-medium/30 bg-medium-tint px-3 py-2 text-sm text-medium">
        No AI provider configured.{" "}
        <Link href="/settings/providers" className="font-medium underline underline-offset-2">
          Add one in AI providers
        </Link>{" "}
        (OpenAI, LM Studio, Ollama or any OpenAI-compatible endpoint).
      </p>
    );
  }

  const fallbackLabel = data.environmentFallback
    ? `Server default (${data.environmentFallback.model})`
    : null;
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">Model</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[4px] border border-rule bg-sheet px-2 py-1.5 text-sm focus:border-ink focus:outline-none"
      >
        {data.providers.length === 0 && fallbackLabel && <option value="">{fallbackLabel}</option>}
        {data.providers.map((p) => (
          <option key={p.id} value={p.isDefault ? "" : p.id}>
            {p.name} · {p.model}
            {p.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
