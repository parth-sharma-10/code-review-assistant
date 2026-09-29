import type { ReviewIssue, Severity } from "./types";

export const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const bySeverity = <T extends { severity: Severity }>(items: T[]) =>
  [...items].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

/** A review issue with a stable id (its index in the stored result), used for anchors and focus. */
export interface Finding extends ReviewIssue {
  id: string;
}

export interface FileGroup {
  file: string;
  findings: Finding[];
}

export function toFindings(issues: ReviewIssue[]): Finding[] {
  return issues.map((issue, i) => ({ ...issue, id: `finding-${i + 1}` }));
}

/**
 * One group per file, worst file first (then by path). Inside a file, findings follow the code
 * top to bottom, with line-less findings first, because that is the order they are rendered in.
 */
export function groupByFile(findings: Finding[]): FileGroup[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) groups.set(f.file, [...(groups.get(f.file) ?? []), f]);
  const worst = (fs: Finding[]) => Math.min(...fs.map((f) => SEVERITY_RANK[f.severity]));
  return [...groups.entries()]
    .map(([file, fs]) => ({
      file,
      findings: [...fs].sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    }))
    .sort((a, b) => worst(a.findings) - worst(b.findings) || a.file.localeCompare(b.file));
}

export interface LineRange {
  from: number;
  to: number;
}

/** Windows of `context` lines around each cited line, merged when they overlap or touch. */
export function hunksAround(lines: number[], lineCount: number, context: number): LineRange[] {
  const sorted = [...new Set(lines)].filter((n) => n >= 1 && n <= lineCount).sort((a, b) => a - b);
  const out: LineRange[] = [];
  for (const n of sorted) {
    const from = Math.max(1, n - context);
    const to = Math.min(lineCount, n + context);
    const last = out.at(-1);
    if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}
