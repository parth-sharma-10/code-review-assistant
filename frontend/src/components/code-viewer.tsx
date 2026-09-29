"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ThemedToken } from "shiki/core";
import { KEYWORD_COLOR, MAX_HIGHLIGHT_CHARS, tokenize } from "@/lib/highlight";
import type { ReviewIssue } from "@/lib/types";
import { SEVERITY_BORDER, SeverityBadge } from "./severity";

interface Props {
  path: string;
  content: string;
  /** Line to highlight and scroll to (1-based), e.g. from a review finding. */
  focusLine?: number | null;
  /** Review findings for this file, rendered under the line they cite. */
  annotations?: ReviewIssue[];
}

/**
 * A line-numbered listing. Findings are pinned beneath the line they cite, the way a reviewer
 * writes in the margin of a printout, and the cited line gets the highlighter.
 */
export function CodeViewer({ path, content, focusLine, annotations = [] }: Props) {
  const tokens = useTokens(content, path);
  const focusRef = useRef<HTMLTableRowElement>(null);
  const lines = content.split("\n");

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
  }, [focusLine, path, tokens]);

  const { byLine, fileLevel } = groupByLine(annotations, lines.length);
  const gutterWidth = `${String(lines.length).length + 2}ch`;

  return (
    <div className="font-mono text-[12.5px] leading-[1.6]">
      {content.length > MAX_HIGHLIGHT_CHARS && (
        <p className="border-b border-rule bg-wash px-4 py-1.5 font-sans text-xs text-ink-2">
          Large file: shown without syntax highlighting.
        </p>
      )}
      {fileLevel.map((issue, i) => (
        <Annotation key={`file-${i}`} issue={issue} />
      ))}
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((text, i) => (
            <Line
              key={i}
              n={i + 1}
              text={text}
              tokens={tokens?.[i]}
              notes={byLine.get(i + 1)}
              focused={i + 1 === focusLine}
              focusRef={focusRef}
              gutterWidth={gutterWidth}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Syntax tokens for the current file, or null while loading / for unsupported languages. */
function useTokens(content: string, path: string): ThemedToken[][] | null {
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
function groupByLine(annotations: ReviewIssue[], lineCount: number) {
  const byLine = new Map<number, ReviewIssue[]>();
  const fileLevel: ReviewIssue[] = [];
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
  notes?: ReviewIssue[];
  focused: boolean;
  focusRef: RefObject<HTMLTableRowElement | null>;
  gutterWidth: string;
}) {
  const marked = focused || Boolean(notes);
  return (
    <>
      <tr ref={focused ? focusRef : undefined} className={marked ? "bg-marker/70" : undefined}>
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
          <td className="border-r border-rule" />
          <td className="py-1 pl-4 pr-6">
            {notes.map((issue, j) => (
              <Annotation key={j} issue={issue} />
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

function Tokens({ tokens }: { tokens: ThemedToken[] }) {
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

function Annotation({ issue }: { issue: ReviewIssue }) {
  return (
    <div
      className={`my-1 max-w-[min(48rem,calc(100vw-5rem))] whitespace-normal rounded-[3px] border border-l-4 border-rule bg-sheet px-3 py-2 font-sans text-sm shadow-sm ${SEVERITY_BORDER[issue.severity]}`}
    >
      <p className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <span className="font-medium text-ink">{issue.title}</span>
      </p>
      <p className="mt-1 text-ink-2">{issue.description}</p>
      <p className="mt-1 text-ink">
        <span className="font-medium">Fix: </span>
        {issue.recommendation}
      </p>
    </div>
  );
}
