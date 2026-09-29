"use client";

import { CircleCheck, FileArchive, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { api } from "@/lib/api";
import { formatBytes, plural } from "@/lib/format";
import type { UploadResult } from "@/lib/types";
import { ErrorNote, Spinner } from "./ui";

const MAX_BYTES = 20 * 1024 * 1024;

const REASON_LABEL: Record<string, string> = {
  "ignored-directory": "dependency or build folder",
  secret: "possible secret",
  binary: "binary",
  "too-large": "over 512 KB",
  symlink: "symlink",
};

/** A drop zone that is also a button: drag a ZIP onto it, or click / press Enter to pick one. */
export function UploadZip({
  projectId,
  hasFiles,
  fileCount,
  onUploaded,
}: {
  projectId: string;
  hasFiles: boolean;
  fileCount?: number;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function upload(file: File) {
    setError(null);
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError(`${file.name} is not a .zip archive.`);
      return;
    }
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

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !busy) upload(file);
  }

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full items-center gap-4 rounded-panel border border-dashed px-5 py-5 text-left transition-colors ${
          dragging
            ? "border-ink bg-marker/30"
            : "border-ink-3/40 bg-sheet hover:border-ink-3 hover:bg-paper"
        }`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper text-ink-2">
          {busy ? <Spinner /> : <Upload aria-hidden strokeWidth={1.75} className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-ink">{prompt(busy, dragging, hasFiles)}</span>
          <span className="block text-[13px] text-ink-2">
            Drag it here or click to choose. Up to 20 MB; dependencies, build output, binaries and
            secret files are skipped.
            {hasFiles &&
              fileCount !== undefined &&
              ` Replacing removes the ${plural(fileCount, "stored file")}; past reviews are kept.`}
          </span>
        </span>
      </button>
      <ErrorNote>{error}</ErrorNote>
      {result && <UploadSummary result={result} />}
    </div>
  );
}

function prompt(busy: boolean, dragging: boolean, hasFiles: boolean): string {
  if (busy) return "Uploading and scanning…";
  if (dragging) return "Drop to upload";
  return hasFiles ? "Replace the source" : "Upload the repository as a .zip";
}

function UploadSummary({ result }: { result: UploadResult }) {
  return (
    <div
      role="status"
      className="rounded-panel border border-rule bg-sheet p-4 text-sm shadow-panel"
    >
      <p className="flex flex-wrap items-center gap-x-2">
        <CircleCheck aria-hidden className="size-4 text-ok" />
        <span className="font-medium">Stored {plural(result.storedFiles, "file")}</span>
        <span className="text-ink-3">{formatBytes(result.totalBytes)}</span>
        {result.skippedCount > 0 && (
          <span className="text-ink-2">· skipped {result.skippedCount}</span>
        )}
      </p>
      {result.skipped.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-xs text-ink-2 hover:text-ink">
            Show skipped files
          </summary>
          <ul className="mt-2 max-h-48 divide-y divide-rule overflow-y-auto rounded-control border border-rule font-mono text-xs">
            {result.skipped.map((s) => (
              <li key={s.path} className="flex items-center justify-between gap-4 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <FileArchive aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                  {s.path}
                </span>
                <span className="shrink-0 font-sans text-ink-3">
                  {REASON_LABEL[s.reason] ?? s.reason}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
