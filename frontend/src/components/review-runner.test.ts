import { describe, expect, it } from "vitest";
import { resolveScope } from "./review-runner";

describe("resolveScope", () => {
  it("sends the open file for a FILE review", () => {
    expect(resolveScope("FILE", "f1", [])).toEqual({ scope: "FILE", fileIds: ["f1"] });
  });

  it("sends the ticked files for a FILES review", () => {
    expect(resolveScope("FILES", "f1", ["a", "b"])).toEqual({
      scope: "FILES",
      fileIds: ["a", "b"],
    });
  });

  it("falls back to the open file when the selection is cleared", () => {
    expect(resolveScope("FILES", "f1", [])).toEqual({ scope: "FILE", fileIds: ["f1"] });
  });

  it("falls back to the whole project when no file is open", () => {
    expect(resolveScope("FILE", null, [])).toEqual({ scope: "PROJECT" });
    expect(resolveScope("FILES", null, [])).toEqual({ scope: "PROJECT" });
  });

  it("never sends file ids for a PROJECT review", () => {
    expect(resolveScope("PROJECT", "f1", ["a"])).toEqual({ scope: "PROJECT" });
  });
});
