"use client";

import Link from "next/link";
import type { ProvidersResponse } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { SelectInput } from "./ui";

/**
 * Which configured provider runs the request. Empty value = the user's default (or the
 * server's fallback). Renders a pointer to settings when nothing is configured.
 */
export function ProviderSelect({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Just the control, for toolbars; the accessible name stays "Model". */
  compact?: boolean;
}) {
  const { data } = useApi<ProvidersResponse>("/ai/providers");
  if (!data) return null;

  if (data.providers.length === 0 && !data.environmentFallback) {
    return (
      <p className="rounded-control border border-medium/30 bg-medium-tint px-3 py-2 text-[13px] text-medium">
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
  const select = (
    <SelectInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={compact ? "Model" : undefined}
      className={
        compact ? "h-7 w-auto max-w-[16rem] border-transparent bg-paper text-xs shadow-none" : ""
      }
    >
      {data.providers.length === 0 && fallbackLabel && <option value="">{fallbackLabel}</option>}
      {data.providers.map((p) => (
        <option key={p.id} value={p.isDefault ? "" : p.id}>
          {p.name} · {p.model}
          {p.isDefault ? " (default)" : ""}
        </option>
      ))}
    </SelectInput>
  );
  if (compact) return select;
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">Model</span>
      {select}
    </label>
  );
}
