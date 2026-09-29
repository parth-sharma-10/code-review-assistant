"use client";

import { useCallback, useEffect, useState } from "react";
import type { Severity } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { SEVERITY_STYLE } from "./severity";

/** Severity filter state. An empty set means "show everything". */
export function useSeverityFilter() {
  const [active, setActive] = useState<Set<Severity>>(new Set());
  const toggle = (s: Severity) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  const shows = useCallback((s: Severity) => active.size === 0 || active.has(s), [active]);
  return { active, toggle, clear: () => setActive(new Set()), shows };
}

/**
 * Sticky bar above the findings: toggles per severity (with counts, so it doubles as the
 * tally) and the keyboard hint. Sticks to the top of whichever element scrolls the page.
 */
export function FindingToolbar({
  counts,
  filter,
}: {
  counts: Record<Severity, number>;
  filter: ReturnType<typeof useSeverityFilter>;
}) {
  const total = SEVERITIES.reduce((n, s) => n + counts[s], 0);
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-paper py-2">
      <div role="group" aria-label="Filter findings by severity" className="flex flex-wrap gap-1">
        <FilterButton pressed={filter.active.size === 0} onClick={filter.clear}>
          All <Count n={total} />
        </FilterButton>
        {SEVERITIES.map((s) => (
          <FilterButton
            key={s}
            pressed={filter.active.has(s)}
            disabled={counts[s] === 0}
            onClick={() => filter.toggle(s)}
          >
            <span aria-hidden className={`size-2 ${SEVERITY_STYLE[s].bg}`} />
            {SEVERITY_STYLE[s].label} <Count n={counts[s]} />
          </FilterButton>
        ))}
      </div>
      {total > 1 && (
        <p className="ml-auto hidden text-xs text-ink-3 sm:block">
          <kbd>j</kbd> <kbd>k</kbd> next and previous finding
        </p>
      )}
    </div>
  );
}

function FilterButton({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-[4px] border border-transparent px-2 text-sm text-ink-2 hover:bg-wash hover:text-ink disabled:pointer-events-none disabled:opacity-40 aria-pressed:border-rule aria-pressed:bg-sheet aria-pressed:font-medium aria-pressed:text-ink"
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-mono text-xs tabular-nums text-ink-3">{n}</span>;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * j / k move focus through the findings in reading (DOM) order. Focus, not just scroll, so the
 * next Tab lands inside the finding and screen readers announce it. `ids` only re-arms the
 * handler when the visible set changes.
 */
export function useFindingKeys(ids: string[]) {
  useEffect(() => {
    if (ids.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key !== "j" && e.key !== "k") return;
      const all = [...document.querySelectorAll<HTMLElement>("article[id^='finding-']")];
      if (all.length === 0) return;
      const current = all.indexOf(document.activeElement as HTMLElement);
      const step = e.key === "j" ? 1 : -1;
      const next = current === -1 ? (step === 1 ? 0 : all.length - 1) : current + step;
      const el = all[Math.max(0, Math.min(all.length - 1, next))];
      e.preventDefault();
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids]);
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
