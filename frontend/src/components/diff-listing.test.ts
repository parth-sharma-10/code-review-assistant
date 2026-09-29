import { describe, expect, it } from "vitest";
import { diffRows } from "./diff-listing";

describe("diffRows", () => {
  it("numbers removed lines by the old file and added lines by the new file", () => {
    const [hunk] = diffRows("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(hunk.rows).toEqual([
      { kind: "ctx", oldLine: 1, newLine: 1, text: "a" },
      { kind: "del", oldLine: 2, newLine: null, text: "b" },
      { kind: "add", oldLine: null, newLine: 2, text: "B" },
      { kind: "ctx", oldLine: 3, newLine: 3, text: "c" },
      { kind: "add", oldLine: null, newLine: 4, text: "d" },
    ]);
  });

  it("has no hunks when nothing changed", () => {
    expect(diffRows("same\n", "same\n")).toEqual([]);
  });
});
