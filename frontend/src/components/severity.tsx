import type { Severity } from "@/lib/types";

const STYLE: Record<Severity, { text: string; tint: string; label: string }> = {
  CRITICAL: { text: "text-critical", tint: "bg-critical-tint", label: "Critical" },
  HIGH: { text: "text-high", tint: "bg-high-tint", label: "High" },
  MEDIUM: { text: "text-medium", tint: "bg-medium-tint", label: "Medium" },
  LOW: { text: "text-low", tint: "bg-low-tint", label: "Low" },
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  CRITICAL: "border-l-critical",
  HIGH: "border-l-high",
  MEDIUM: "border-l-medium",
  LOW: "border-l-low",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = STYLE[severity];
  return (
    <span
      className={`inline-block rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${s.text} ${s.tint}`}
    >
      {s.label}
    </span>
  );
}

/** Four fixed columns in severity order; zero counts drop to tertiary ink rather than being hidden. */
export function SeverityCounts({
  counts,
  size = "sm",
}: {
  counts: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number };
  size?: "sm" | "lg";
}) {
  const values: [Severity, number][] = [
    ["CRITICAL", counts.criticalCount],
    ["HIGH", counts.highCount],
    ["MEDIUM", counts.mediumCount],
    ["LOW", counts.lowCount],
  ];
  const big = size === "lg";
  return (
    <dl className={`flex ${big ? "gap-6" : "gap-3"}`}>
      {values.map(([sev, n]) => (
        <div key={sev}>
          <dt
            className={`font-mono uppercase tracking-wide ${big ? "text-xs" : "text-[10px]"} ${n > 0 ? STYLE[sev].text : "text-ink-3"}`}
          >
            {STYLE[sev].label}
          </dt>
          <dd
            className={`font-mono tabular-nums ${big ? "text-2xl" : "text-sm"} ${n > 0 ? STYLE[sev].text : "text-ink-3"}`}
          >
            {n}
          </dd>
        </div>
      ))}
    </dl>
  );
}
