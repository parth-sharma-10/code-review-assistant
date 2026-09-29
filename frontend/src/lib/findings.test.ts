import { describe, expect, it } from "vitest";
import { groupByFile, hunksAround, toFindings } from "./findings";
import type { ReviewIssue, Severity } from "./types";

const issue = (file: string, line: number | null, severity: Severity): ReviewIssue => ({
  title: `${file}:${line}`,
  description: "",
  severity,
  file,
  line,
  recommendation: "",
});

describe("groupByFile", () => {
  it("puts the file with the worst finding first, then orders each file top to bottom", () => {
    const groups = groupByFile(
      toFindings([
        issue("a.ts", 9, "LOW"),
        issue("b.ts", 20, "CRITICAL"),
        issue("b.ts", 3, "MEDIUM"),
        issue("b.ts", null, "LOW"),
      ]),
    );
    expect(groups.map((g) => g.file)).toEqual(["b.ts", "a.ts"]);
    expect(groups[0].findings.map((f) => f.line)).toEqual([null, 3, 20]);
  });

  it("keeps ids tied to the original position, so filtering never renumbers anchors", () => {
    const findings = toFindings([issue("a.ts", 1, "LOW"), issue("a.ts", 2, "HIGH")]);
    const [group] = groupByFile(findings.filter((f) => f.severity === "HIGH"));
    expect(group.findings[0].id).toBe("finding-2");
  });

  it("returns nothing for no findings", () => {
    expect(groupByFile([])).toEqual([]);
  });
});

describe("hunksAround", () => {
  it("merges windows that overlap or touch and clamps to the file", () => {
    expect(hunksAround([2, 5, 20], 22, 2)).toEqual([
      { from: 1, to: 7 },
      { from: 18, to: 22 },
    ]);
  });

  it("merges windows that only touch, leaving no one-line gap row", () => {
    expect(hunksAround([2, 5], 10, 1)).toEqual([{ from: 1, to: 6 }]);
  });

  it("drops lines outside the file and duplicates", () => {
    expect(hunksAround([0, 3, 3, 99], 10, 1)).toEqual([{ from: 2, to: 4 }]);
  });

  it("keeps separate windows separate", () => {
    expect(hunksAround([2, 10], 20, 1)).toEqual([
      { from: 1, to: 3 },
      { from: 9, to: 11 },
    ]);
  });
});
