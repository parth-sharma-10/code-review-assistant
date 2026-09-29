import { describe, expect, it } from "vitest";
import { ancestorsOf, buildTree } from "./tree";
import type { FileMeta } from "./types";

const file = (path: string): FileMeta => ({
  id: path,
  path,
  name: path.split("/").pop()!,
  extension: "",
  size: 1,
});

describe("buildTree", () => {
  it("nests paths into folders, folders before files, each alphabetical", () => {
    const tree = buildTree([
      file("src/b.ts"),
      file("README.md"),
      file("src/a/x.ts"),
      file("src/a.ts"),
    ]);
    expect(tree.map((n) => n.name)).toEqual(["src", "README.md"]);
    const src = tree[0];
    expect(src.file).toBeUndefined();
    expect(src.children.map((n) => n.name)).toEqual(["a", "a.ts", "b.ts"]);
    expect(src.children[0].children[0].path).toBe("src/a/x.ts");
  });

  it("keeps a folder and a file with the same name apart", () => {
    const tree = buildTree([file("docs"), file("docs/readme.md")]);
    expect(tree.map((n) => [n.name, Boolean(n.file)])).toEqual([
      ["docs", false],
      ["docs", true],
    ]);
  });
});

describe("ancestorsOf", () => {
  it("lists every containing folder", () => {
    expect(ancestorsOf("a/b/c.ts")).toEqual(["a", "a/b"]);
    expect(ancestorsOf("root.ts")).toEqual([]);
  });
});
