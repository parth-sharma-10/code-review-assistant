"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { plural } from "@/lib/format";
import type { ReviewDetail, ReviewScope } from "@/lib/types";
import { useProject } from "./project-context";
import { ProviderSelect } from "./provider-select";
import { Button, ErrorNote } from "./ui";

type ReviewMode = "SECURITY" | "PERFORMANCE" | "QUALITY";

const TYPES: RadioOption<ReviewMode>[] = [
  {
    value: "SECURITY",
    label: "Security",
    detail: "Secrets, auth, injection, validation, data exposure",
  },
  {
    value: "PERFORMANCE",
    label: "Performance",
    detail: "Algorithms, N+1 queries, blocking work, memory",
  },
  {
    value: "QUALITY",
    label: "Quality",
    detail: "Naming, structure, duplication, error handling",
  },
];

export const MAX_SELECTED = 50;

interface Props {
  projectId: string;
  activeFile: { id: string; path: string } | null;
  selectedIds: string[];
  totalFiles: number;
  onClearSelection: () => void;
}

/**
 * The scope actually sent: the user's choice, falling back when it no longer applies
 * (selection cleared → this file; no open file → whole project).
 */
export function resolveScope(
  chosen: ReviewScope,
  activeFileId: string | null,
  selectedIds: string[],
): { scope: ReviewScope; fileIds?: string[] } {
  if (chosen === "FILES" && selectedIds.length > 0) return { scope: "FILES", fileIds: selectedIds };
  if (chosen !== "PROJECT" && activeFileId) return { scope: "FILE", fileIds: [activeFileId] };
  return { scope: "PROJECT" };
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
  const [type, setType] = useState<ReviewMode>("SECURITY");
  const [chosenScope, setChosenScope] = useState<ReviewScope>("FILE");
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { scope, fileIds } = resolveScope(chosenScope, activeFile?.id ?? null, selectedIds);
  const tooMany = scope === "FILES" && selectedIds.length > MAX_SELECTED;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const review = await api<ReviewDetail>(`/projects/${projectId}/reviews`, {
        body: { type, scope, fileIds, providerId: providerId || undefined },
      });
      reloadProject(); // review count in the project header
      router.push(`/projects/${projectId}/reviews/${review.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const scopes: RadioOption<ReviewScope>[] = [
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
    },
  ];

  return (
    <div className="space-y-4">
      <Segmented legend="Review type" name="type" options={TYPES} value={type} onChange={setType} />
      <div className="space-y-1.5">
        <RadioList
          legend="Scope"
          name="scope"
          options={scopes}
          value={scope}
          onChange={setChosenScope}
          mono
        />
        {selectedIds.length > 0 && (
          <button
            onClick={onClearSelection}
            className="ml-8 text-xs text-ink-2 underline underline-offset-2"
          >
            Clear selection
          </button>
        )}
        {tooMany && <p className="text-xs text-critical">Select at most {MAX_SELECTED} files.</p>}
      </div>
      <ProviderSelect value={providerId} onChange={setProviderId} />
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" className="w-full" onClick={run} busy={busy} disabled={tooMany}>
        {busy ? "Reviewing… this can take a minute" : "Run review"}
      </Button>
    </div>
  );
}

/** Native radios styled as one segmented row: arrow keys move between options for free. */
function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-3 rounded-[4px] border border-rule bg-sheet p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-[3px] px-1 py-1 text-center text-sm text-ink-2 hover:text-ink has-checked:bg-wash has-checked:font-medium has-checked:text-ink has-checked:shadow-[inset_0_0_0_1px_var(--color-ink-3)] has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {selected && <p className="mt-1.5 text-xs text-ink-3">{selected.detail}</p>}
    </fieldset>
  );
}

interface RadioOption<T extends string> {
  value: T;
  label: string;
  detail: string;
  disabled?: boolean;
}

function RadioList<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  mono,
}: {
  legend: string;
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  mono?: boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`-mx-2 flex gap-2 rounded-[4px] px-2 py-1 ${o.disabled ? "opacity-50" : "cursor-pointer hover:bg-wash"}`}
        >
          <input
            type="radio"
            name={name}
            disabled={o.disabled}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1 accent-ink"
          />
          <span className="min-w-0">
            <span className="block text-sm text-ink">{o.label}</span>
            <span className={`block break-words text-xs text-ink-3 ${mono ? "font-mono" : ""}`}>
              {o.detail}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
