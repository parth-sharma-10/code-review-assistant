"use client";

import { structuredPatch } from "diff";
import { Fragment, useMemo } from "react";
import type { ThemedToken } from "shiki/core";
import { Tokens, useTokens } from "./code-viewer";
import { FindingNote, type Note } from "./finding-note";

interface Row {
  kind: "add" | "del" | "ctx";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

/** Unified diff rows with both line numbers, the same 3-line context the model was shown. */
export function diffRows(before: string, after: string): { header: string; rows: Row[] }[] {
  const patch = structuredPatch("a", "b", before, after, "", "", { context: 3 });
  return patch.hunks.map((h) => {
    let oldLine = h.oldStart;
    let newLine = h.newStart;
    const rows: Row[] = [];
    for (const line of h.lines) {
      const text = line.slice(1);
      if (line[0] === "+") rows.push({ kind: "add", oldLine: null, newLine: newLine++, text });
      else if (line[0] === "-") rows.push({ kind: "del", oldLine: oldLine++, newLine: null, text });
      else if (line[0] === " ")
        rows.push({ kind: "ctx", oldLine: oldLine++, newLine: newLine++, text });
    }
    return { header: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`, rows };
  });
}

const ROW_STYLE = {
  add: { row: "bg-add-tint", gutter: "border-add-edge", sign: "+" },
  del: { row: "bg-critical-tint", gutter: "border-del-edge", sign: "−" },
  ctx: { row: "", gutter: "border-rule", sign: " " },
};

/**
 * The change as a unified diff, with each finding pinned under the new-version line it cites.
 * Findings citing a line outside every hunk are listed above the diff.
 */
export function DiffListing({
  before,
  after,
  beforePath,
  afterPath,
  notes,
}: {
  before: string;
  after: string;
  beforePath: string;
  afterPath: string;
  notes: Note[];
}) {
  const hunks = useMemo(() => diffRows(before, after), [before, after]);
  const oldTokens = useTokens(before, beforePath);
  const newTokens = useTokens(after, afterPath);
  const shownNew = new Set(hunks.flatMap((h) => h.rows.map((r) => r.newLine)));
  const outside = notes.filter((n) => !n.line || !shownNew.has(n.line));

  return (
    <div className="font-mono text-[12.5px] leading-[1.65]">
      {outside.map((n, i) => (
        <FindingNote key={`outside-${i}`} issue={n} />
      ))}
      <table className="w-full border-collapse">
        <tbody>
          {hunks.map((h) => (
            <Fragment key={h.header}>
              <tr className="bg-wash text-ink-3">
                <td colSpan={4} className="px-3 py-0.5 text-xs">
                  {h.header}
                </td>
              </tr>
              {h.rows.map((r, i) => {
                const tokens = r.newLine ? newTokens?.[r.newLine - 1] : oldTokens?.[r.oldLine! - 1];
                const pinned = r.kind !== "del" ? notes.filter((n) => n.line === r.newLine) : [];
                return <DiffRow key={i} row={r} tokens={tokens} notes={pinned} />;
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ row, tokens, notes }: { row: Row; tokens?: ThemedToken[]; notes: Note[] }) {
  const s = ROW_STYLE[row.kind];
  const marked = notes.length > 0;
  return (
    <>
      <tr className={marked ? "bg-marker/70" : s.row}>
        <Num n={row.oldLine} />
        <Num n={row.newLine} />
        <td aria-hidden className={`w-5 select-none border-l-2 text-center text-ink-3 ${s.gutter}`}>
          {s.sign}
        </td>
        <td className="whitespace-pre pr-6">
          <span className="sr-only">
            {row.kind === "add" ? "added: " : row.kind === "del" ? "removed: " : ""}
          </span>
          {tokens ? <Tokens tokens={tokens} /> : row.text || " "}
        </td>
      </tr>
      {marked && (
        <tr>
          <td colSpan={4} className="p-0">
            {notes.map((n, j) => (
              <FindingNote key={j} issue={n} />
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

function Num({ n }: { n: number | null }) {
  return (
    <td className="w-[6ch] select-none px-2 text-right align-top tabular-nums text-ink-3">
      {n ?? ""}
    </td>
  );
}
