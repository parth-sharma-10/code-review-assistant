"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { plural } from "@/lib/format";
import type { ReviewDetail, ReviewScope } from "@/lib/types";
import { useProject } from "./project-context";
import { ProviderSelect } from "./provider-select";
import { Button, ErrorNote } from "./ui";

const TYPES = [
  {
    value: "SECURITY",
    label: "Security",
    hint: "Secrets, auth, injection, validation, data exposure",
  },
  {
    value: "PERFORMANCE",
    label: "Performance",
    hint: "Algorithms, N+1 queries, blocking work, memory",
  },
  {
    value: "QUALITY",
    label: "Code quality",
    hint: "Naming, structure, duplication, error handling",
  },
] as const;

const MAX_SELECTED = 50;

interface Props {
  projectId: string;
  activeFile: { id: string; path: string } | null;
  selectedIds: string[];
  totalFiles: number;
  onClearSelection: () => void;
}

export function ReviewRunner({
  projectId,
  activeFile,
  selectedIds,
  totalFiles,
  onClearSelection,
}: Props) {
  const router = useRouter();
  const { reload: reloadProject } = useProject();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("SECURITY");
  const [scope, setScope] = useState<ReviewScope>("FILE");
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scope follows what the user has picked unless they chose otherwise.
  const effectiveScope: ReviewScope =
    scope === "FILES" && selectedIds.length === 0
      ? "FILE"
      : scope === "FILE" && !activeFile
        ? "PROJECT"
        : scope;
  const fileIds =
    effectiveScope === "FILE"
      ? activeFile
        ? [activeFile.id]
        : []
      : effectiveScope === "FILES"
        ? selectedIds
        : undefined;
  const tooMany = effectiveScope === "FILES" && selectedIds.length > MAX_SELECTED;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const review = await api<ReviewDetail>(`/projects/${projectId}/reviews`, {
        body: { type, scope: effectiveScope, fileIds, providerId: providerId || undefined },
      });
      reloadProject(); // review count in the project header
      router.push(`/projects/${projectId}/reviews/${review.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const scopes: { value: ReviewScope; label: string; detail: string; disabled: boolean }[] = [
    {
      value: "FILE",
      label: "This file",
      detail: activeFile?.path ?? "Open a file first",
      disabled: !activeFile,
    },
    {
      value: "FILES",
      label: "Selected files",
      detail: selectedIds.length ? plural(selectedIds.length, "file") : "Tick files in the tree",
      disabled: selectedIds.length === 0,
    },
    {
      value: "PROJECT",
      label: "Whole project",
      detail: `${plural(totalFiles, "file")}, most relevant first, within the model's context budget`,
      disabled: false,
    },
  ];

  return (
    <div className="space-y-4">
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">Review type</legend>
        {TYPES.map((t) => (
          <label
            key={t.value}
            className="flex cursor-pointer gap-2 rounded-[4px] px-2 py-1 hover:bg-wash"
          >
            <input
              type="radio"
              name="type"
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="mt-1 accent-ink"
            />
            <span>
              <span className="block text-sm text-ink">{t.label}</span>
              <span className="block text-xs text-ink-3">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">Scope</legend>
        {scopes.map((s) => (
          <label
            key={s.value}
            className={`flex gap-2 rounded-[4px] px-2 py-1 ${s.disabled ? "opacity-50" : "cursor-pointer hover:bg-wash"}`}
          >
            <input
              type="radio"
              name="scope"
              disabled={s.disabled}
              checked={effectiveScope === s.value}
              onChange={() => setScope(s.value)}
              className="mt-1 accent-ink"
            />
            <span className="min-w-0">
              <span className="block text-sm text-ink">{s.label}</span>
              <span className="block break-words font-mono text-xs text-ink-3">{s.detail}</span>
            </span>
          </label>
        ))}
        {selectedIds.length > 0 && (
          <button
            onClick={onClearSelection}
            className="ml-8 text-xs text-ink-2 underline underline-offset-2"
          >
            Clear selection
          </button>
        )}
        {tooMany && <p className="text-xs text-critical">Select at most {MAX_SELECTED} files.</p>}
      </fieldset>

      <ProviderSelect value={providerId} onChange={setProviderId} />
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" className="w-full" onClick={run} busy={busy} disabled={tooMany}>
        {busy ? "Reviewing… this can take a minute" : "Run review"}
      </Button>
    </div>
  );
}
