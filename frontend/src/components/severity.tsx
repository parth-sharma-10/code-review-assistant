import type { Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";

export const SEVERITY_STYLE: Record<
  Severity,
  {
    text: string;
    bg: string;
    edge: string;
    mark: string;
    tint: string;
    label: string;
    short: string;
  }
> = {
  CRITICAL: {
    text: "text-critical",
    bg: "bg-critical",
    edge: "border-l-critical",
    mark: "bg-critical-mark",
    tint: "bg-critical-tint",
    label: "Critical",
    short: "C",
  },
  HIGH: {
    text: "text-high",
    bg: "bg-high",
    edge: "border-l-high",
    mark: "bg-high-mark",
    tint: "bg-high-tint",
    label: "High",
    short: "H",
  },
  MEDIUM: {
    text: "text-medium",
    bg: "bg-medium",
    edge: "border-l-medium",
    mark: "bg-medium-mark",
    tint: "bg-medium-tint",
    label: "Medium",
    short: "M",
  },
  LOW: {
    text: "text-low",
    bg: "bg-low",
    edge: "border-l-low",
    mark: "bg-low-mark",
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
      <span aria-hidden className={`size-2 rounded-[2px] ${s.mark}`} />
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
          <span aria-hidden className={`size-2 rounded-[2px] ${SEVERITY_STYLE[sev].mark}`} />
          <span className="font-mono tabular-nums">{values[sev]}</span>{" "}
          {SEVERITY_STYLE[sev].label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

/**
 * Stacked severity distribution: one bar, a 2px surface gap between segments, each segment
 * labelled in the legend below with its count (colour is never the only channel).
 */
export function SeverityBar({
  counts,
  legend = true,
  className = "",
}: {
  counts: Counts;
  legend?: boolean;
  className?: string;
}) {
  const values = countsOf(counts);
  const total = SEVERITIES.reduce((n, s) => n + values[s], 0);
  const summary = SEVERITIES.map(
    (s) => `${values[s]} ${SEVERITY_STYLE[s].label.toLowerCase()}`,
  ).join(", ");
  return (
    <div className={className}>
      <div role="img" aria-label={total ? summary : "No findings"} className="flex h-2 gap-0.5">
        {total === 0 ? (
          <span className="h-full w-full rounded-full bg-wash" />
        ) : (
          SEVERITIES.filter((s) => values[s] > 0).map((s) => (
            <span
              key={s}
              title={`${values[s]} ${SEVERITY_STYLE[s].label.toLowerCase()}`}
              style={{ flexGrow: values[s] }}
              className={`h-full origin-left animate-[bar-grow_420ms_cubic-bezier(0.2,0.8,0.2,1)] first:rounded-l-full last:rounded-r-full ${SEVERITY_STYLE[s].mark}`}
            />
          ))
        )}
      </div>
      {legend && (
        <ul aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {SEVERITIES.map((s) => (
            <li key={s} className={`flex items-center gap-1.5 ${values[s] ? "" : "opacity-50"}`}>
              <span className={`size-2 rounded-[2px] ${SEVERITY_STYLE[s].mark}`} />
              {SEVERITY_STYLE[s].label}
              <span className="font-mono tabular-nums text-ink">{values[s]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
