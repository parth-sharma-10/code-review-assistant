import { describe, expect, it } from "vitest";
import { buildCommands, matches } from "./command-palette";
import type { Project } from "@/lib/types";

describe("matches", () => {
  it("needs every word, in any order, case-insensitively", () => {
    expect(matches("demo-api › Code", "code demo")).toBe(true);
    expect(matches("demo-api › Code", "chat demo")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matches("Dashboard", "   ")).toBe(true);
  });
});

describe("buildCommands", () => {
  it("offers each project and its code and chat pages", () => {
    const project = { id: "p1", name: "api" } as Project;
    const hrefs = buildCommands([project], []).map((c) => c.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/projects/p1", "/projects/p1/code", "/projects/p1/chat"]),
    );
  });
});
