"use client";

import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import type { ThemedToken } from "shiki/core";
import { hunksAround, type LineRange } from "@/lib/findings";
import { KEYWORD_COLOR, MAX_HIGHLIGHT_CHARS, tokenize } from "@/lib/highlight";
import { FindingNote, type Note } from "./finding-note";

interface Props {
  path: string;
  content: string;
  /** Line to highlight and scroll to (1-based), e.g. from a review finding. */
  focusLine?: number | null;
  /** Review findings for this file, rendered under the line they cite. */
  annotations?: Note[];
  /**
   * Show only this many lines around each annotated line, like a pull-request hunk. Hidden
   * stretches become a row that expands them. Omit to show the whole file.
   */
  context?: number;
}

/**
 * A line-numbered listing. Findings are pinned beneath the line they cite, the way a reviewer
 * writes in the margin of a printout, and the cited line gets the highlighter.
 */
export function CodeViewer({ path, content, focusLine, annotations = [], context }: Props) {
  const tokens = useTokens(content, path);
  const focusRef = useRef<HTMLTableRowElement>(null);
  const lines = content.split("\n");
  const [expanded, setExpanded] = useState<LineRange[]>([]);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
  }, [focusLine, path, tokens]);

  const { byLine, fileLevel } = groupByLine(annotations, lines.length);
  const gutterWidth = `${String(lines.length).length + 2}ch`;
  const ranges =
    context === undefined
      ? [{ from: 1, to: lines.length }]
      : visibleRanges([...byLine.keys()], lines.length, context, expanded);

  const renderLine = (n: number) => (
    <Line
      key={n}
      n={n}
      text={lines[n - 1]}
      tokens={tokens?.[n - 1]}
      notes={byLine.get(n)}
      focused={n === focusLine}
      focusRef={focusRef}
      gutterWidth={gutterWidth}
    />
  );

  return (
    <div className="font-mono text-[12.5px] leading-[1.65]">
      {content.length > MAX_HIGHLIGHT_CHARS && (
        <p className="border-b border-rule bg-wash px-4 py-1.5 font-sans text-xs text-ink-2">
          Large file: shown without syntax highlighting.
        </p>
      )}
      {fileLevel.length > 0 && (
        <div className="border-b border-rule">
          {fileLevel.map((issue, i) => (
            <FindingNote key={`file-${i}`} issue={issue} />
          ))}
        </div>
      )}
      <table className="w-full border-collapse">
        <tbody>
          {ranges.map((r, i) => {
            const gapFrom = i === 0 ? 1 : ranges[i - 1].to + 1;
            return (
              <Fragment key={r.from}>
                {r.from > gapFrom && (
                  <Gap
                    from={gapFrom}
                    to={r.from - 1}
                    onExpand={(g) => setExpanded((prev) => [...prev, g])}
                  />
                )}
                {range(r.from, r.to).map(renderLine)}
              </Fragment>
            );
          })}
          {ranges.length > 0 && ranges.at(-1)!.to < lines.length && (
            <Gap
              from={ranges.at(-1)!.to + 1}
              to={lines.length}
              onExpand={(g) => setExpanded((prev) => [...prev, g])}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

function visibleRanges(
  noted: number[],
  lineCount: number,
  context: number,
  expanded: LineRange[],
): LineRange[] {
  const lines = [...hunksAround(noted, lineCount, context), ...expanded].flatMap(({ from, to }) =>
    range(from, to),
  );
  return hunksAround(lines, lineCount, 0);
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** A collapsed stretch of the file. Expanding it reveals the lines in place. */
function Gap({
  from,
  to,
  onExpand,
}: {
  from: number;
  to: number;
  onExpand: (range: LineRange) => void;
}) {
  const count = to - from + 1;
  return (
    <tr className="bg-wash/60">
      <td colSpan={2} className="p-0">
        <button
          type="button"
          onClick={() => onExpand({ from, to })}
          className="block w-full px-3 py-0.5 text-left font-sans text-xs text-ink-3 hover:bg-wash hover:text-ink"
        >
          <span aria-hidden className="mr-2 font-mono">
            ⋯
          </span>
          Show {count === 1 ? `line ${from}` : `lines ${from}–${to}`}
        </button>
      </td>
    </tr>
  );
}

/** Syntax tokens for the current file, or null while loading / for unsupported languages. */
export function useTokens(content: string, path: string): ThemedToken[][] | null {
  const [state, setState] = useState<{ path: string; lines: ThemedToken[][] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    tokenize(content, path.split("/").pop() ?? path)
      .then((result) => !cancelled && setState(result ? { path, lines: result } : null))
      .catch(() => !cancelled && setState(null)); // fall back to plain text
    return () => {
      cancelled = true;
    };
  }, [content, path]);
  return state?.path === path ? state.lines : null;
}

/** Findings with a usable line go under that line; the rest are shown above the listing. */
function groupByLine<T extends { line?: number | null }>(annotations: T[], lineCount: number) {
  const byLine = new Map<number, T[]>();
  const fileLevel: T[] = [];
  for (const issue of annotations) {
    if (issue.line && issue.line <= lineCount) {
      byLine.set(issue.line, [...(byLine.get(issue.line) ?? []), issue]);
    } else {
      fileLevel.push(issue);
    }
  }
  return { byLine, fileLevel };
}

function Line({
  n,
  text,
  tokens,
  notes,
  focused,
  focusRef,
  gutterWidth,
}: {
  n: number;
  text: string;
  tokens?: ThemedToken[];
  notes?: Note[];
  focused: boolean;
  focusRef: RefObject<HTMLTableRowElement | null>;
  gutterWidth: string;
}) {
  const marked = focused || Boolean(notes);
  return (
    <>
      <tr
        ref={focused ? focusRef : undefined}
        className={marked ? "bg-marker/70" : "hover:bg-wash/70"}
      >
        <td
          style={{ width: gutterWidth }}
          className={`select-none border-r pr-3 text-right align-top tabular-nums ${
            marked ? "border-marker-edge text-ink" : "border-rule text-ink-3"
          }`}
        >
          {n}
        </td>
        <td className="whitespace-pre pl-4 pr-6 align-top">
          {tokens ? <Tokens tokens={tokens} /> : text || " "}
        </td>
      </tr>
      {notes && (
        <tr>
          <td colSpan={2} className="p-0">
            {notes.map((issue, j) => (
              <FindingNote key={j} issue={issue} />
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

export function Tokens({ tokens }: { tokens: ThemedToken[] }) {
  return tokens.map((t, i) => (
    <span
      key={i}
      style={{
        color: t.color,
        fontWeight: t.color === KEYWORD_COLOR ? 600 : undefined,
        fontStyle: t.fontStyle && t.fontStyle & 1 ? "italic" : undefined,
      }}
    >
      {t.content}
    </span>
  ));
}
