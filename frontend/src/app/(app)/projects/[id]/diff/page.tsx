"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProject } from "@/components/project-context";
import { ProviderSelect } from "@/components/provider-select";
import { Button, EmptyState, ErrorNote, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import type { FileMeta, ReviewDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Source = "file" | "paste";

export default function DiffReviewPage() {
  const { project, reload } = useProject();
  const router = useRouter();
  const files = useApi<FileMeta[]>(`/projects/${project.id}/files`);
  const [baseId, setBaseId] = useState("");
  const [source, setSource] = useState<Source>("file");
  const [compareId, setCompareId] = useState("");
  const [pasted, setPasted] = useState("");
  const [providerId, setProviderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = files.data?.find((f) => f.id === baseId);
  const ready =
    baseId && (source === "file" ? compareId && compareId !== baseId : pasted.trim().length > 0);

  async function loadBaseIntoEditor() {
    const f = await api<{ content: string }>(`/projects/${project.id}/files/${baseId}`);
    setPasted(f.content);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const review = await api<ReviewDetail>(`/projects/${project.id}/diff-review`, {
        body: {
          baseFileId: baseId,
          ...(source === "file" ? { compareFileId: compareId } : { compareContent: pasted }),
          providerId: providerId || undefined,
        },
      });
      reload();
      router.push(`/projects/${project.id}/reviews/${review.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (files.loading)
    return (
      <div className="px-4">
        <Loading label="Loading files" />
      </div>
    );
  if (files.data?.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState title="Upload source code to compare versions" />
      </main>
    );
  }

  const fileSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    exclude?: string,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full rounded-[4px] border border-rule bg-sheet px-2 py-1.5 font-mono text-sm focus:border-ink focus:outline-none"
    >
      <option value="">Choose a file…</option>
      {files.data
        ?.filter((f) => f.id !== exclude)
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.path}
          </option>
        ))}
    </select>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h2 className="text-base font-semibold">Diff review</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          Compare two versions of a file. Only the changed lines, with a little surrounding context,
          are sent to the model, which reports bugs, security and performance concerns and risky
          changes.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Version A: original</p>
        {fileSelect(baseId, setBaseId, "Original file")}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Version B: changed</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={source === "file"}
              onChange={() => setSource("file")}
              className="accent-ink"
            />
            Another file in this project
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={source === "paste"}
              onChange={() => setSource("paste")}
              className="accent-ink"
            />
            Edited text
          </label>
        </div>
        {source === "file" ? (
          fileSelect(compareId, setCompareId, "Changed file", baseId)
        ) : (
          <div className="space-y-2">
            {base && (
              <Button type="button" onClick={loadBaseIntoEditor}>
                Start from {base.name}
              </Button>
            )}
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={16}
              spellCheck={false}
              aria-label="Changed version"
              placeholder="Paste or edit the changed version here."
              className="w-full rounded-[4px] border border-rule bg-sheet p-3 font-mono text-[12.5px] focus:border-ink focus:outline-none"
            />
          </div>
        )}
      </fieldset>

      <div className="max-w-sm">
        <ProviderSelect value={providerId} onChange={setProviderId} />
      </div>
      <ErrorNote>{error}</ErrorNote>
      <Button variant="primary" onClick={run} busy={busy} disabled={!ready}>
        {busy ? "Reviewing changes…" : "Review changes"}
      </Button>
    </main>
  );
}
