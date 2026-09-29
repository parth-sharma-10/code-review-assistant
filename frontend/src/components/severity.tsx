import type { Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";

export const SEVERITY_STYLE: Record<
  Severity,
  { text: string; bg: string; edge: string; tint: string; label: string; short: string }
> = {
  CRITICAL: {
    text: "text-critical",
    bg: "bg-critical",
    edge: "border-l-critical",
    tint: "bg-critical-tint",
    label: "Critical",
    short: "C",
  },
  HIGH: {
    text: "text-high",
    bg: "bg-high",
    edge: "border-l-high",
    tint: "bg-high-tint",
    label: "High",
    short: "H",
  },
  MEDIUM: {
    text: "text-medium",
    bg: "bg-medium",
    edge: "border-l-medium",
    tint: "bg-medium-tint",
    label: "Medium",
    short: "M",
  },
  LOW: {
    text: "text-low",
    bg: "bg-low",
    edge: "border-l-low",
    tint: "bg-low-tint",
    label: "Low",
    short: "L",
  },
};

type Counts = { criticalCount: number; highCount: number; mediumCount: number; lowCount: number };

export function countsOf(c: Counts): Record<Severity, number> {
  return { CRITICAL: c.criticalCount, HIGH: c.highCount, MEDIUM: c.mediumCount, LOW: c.lowCount };
}

/** A square mark and the word: severity is read, not decoded from a colour. */
export function SeverityLabel({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${s.text}`}
    >
      <span aria-hidden className={`size-2 ${s.bg}`} />
      {s.label}
    </span>
  );
}

/**
 * Column headers for a table of tallies. Abbreviated to one letter; the full word is in the
 * title and for screen readers.
 */
export function TallyHeaders() {
  return SEVERITIES.map((sev) => (
    <th
      key={sev}
      scope="col"
      className={`w-7 px-0 text-right font-mono text-[11px] font-semibold ${SEVERITY_STYLE[sev].text}`}
    >
      <abbr title={SEVERITY_STYLE[sev].label} className="no-underline">
        {SEVERITY_STYLE[sev].short}
      </abbr>
    </th>
  ));
}

/** One table cell per severity. Zero is a quiet dot so the non-zero counts stand out. */
export function TallyCells({ counts }: { counts: Counts }) {
  const values = countsOf(counts);
  return SEVERITIES.map((sev) => (
    <td key={sev} className="w-7 px-0 text-right align-baseline font-mono tabular-nums">
      {values[sev] > 0 ? (
        <span className={`font-semibold ${SEVERITY_STYLE[sev].text}`}>{values[sev]}</span>
      ) : (
        <>
          <span aria-hidden className="text-rule">
            ·
          </span>
          <span className="sr-only">0</span>
        </>
      )}
    </td>
  ));
}

/** Inline prose tally, e.g. "1 critical · 2 medium", listing only what was found. */
export function TallyText({ counts }: { counts: Counts }) {
  const values = countsOf(counts);
  const found = SEVERITIES.filter((s) => values[s] > 0);
  if (found.length === 0) return <span className="text-ink-3">no findings</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3">
      {found.map((sev) => (
        <span key={sev} className={`inline-flex items-center gap-1.5 ${SEVERITY_STYLE[sev].text}`}>
          <span aria-hidden className={`size-2 ${SEVERITY_STYLE[sev].bg}`} />
          <span className="font-mono tabular-nums">{values[sev]}</span>{" "}
          {SEVERITY_STYLE[sev].label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}
