"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatBytes, plural } from "@/lib/format";
import type { UploadResult } from "@/lib/types";
import { Button, ErrorNote } from "./ui";

const MAX_BYTES = 20 * 1024 * 1024;

const REASON_LABEL: Record<string, string> = {
  "ignored-directory": "dependency or build folder",
  secret: "possible secret",
  binary: "binary",
  "too-large": "over 512 KB",
  symlink: "symlink",
};

export function UploadZip({
  projectId,
  hasFiles,
  onUploaded,
}: {
  projectId: string;
  hasFiles: boolean;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function upload(file: File) {
    setError(null);
    setResult(null);
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${formatBytes(file.size)}. The upload limit is 20 MB.`);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      setResult(await api<UploadResult>(`/projects/${projectId}/upload`, { body }));
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          id="zip-input"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button
          variant={hasFiles ? "secondary" : "primary"}
          busy={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Uploading…" : hasFiles ? "Replace source (.zip)" : "Upload source (.zip)"}
        </Button>
        <span className="text-xs text-ink-3">
          Up to 20 MB. Dependencies, build output, binaries and secret files are skipped.
          {hasFiles && " Replacing removes the current files; past reviews are kept."}
        </span>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <div className="rounded-[4px] border border-rule bg-sheet p-3 text-sm" role="status">
          <p>
            <span className="font-medium text-ok">Stored {plural(result.storedFiles, "file")}</span>{" "}
            <span className="text-ink-3">({formatBytes(result.totalBytes)})</span>
            {result.skippedCount > 0 && (
              <span className="text-ink-2"> · skipped {result.skippedCount}</span>
            )}
          </p>
          {result.skipped.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ink-2">Show skipped files</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-xs">
                {result.skipped.map((s) => (
                  <li key={s.path} className="flex justify-between gap-4 py-0.5">
                    <span className="truncate">{s.path}</span>
                    <span className="shrink-0 text-ink-3">
                      {REASON_LABEL[s.reason] ?? s.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
