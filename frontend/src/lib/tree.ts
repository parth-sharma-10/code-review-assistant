import type { FileMeta } from "./types";

export interface TreeNode {
  name: string;
  path: string;
  file?: FileMeta; // set for files, undefined for folders
  children: TreeNode[];
}

/** Turns flat file paths into a folder hierarchy: folders first, then files, each alphabetical. */
export function buildTree(files: FileMeta[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part && !c.file === !isFile);
      if (!child) {
        child = { name: part, path, children: [], ...(isFile && { file }) };
        node.children.push(child);
      }
      node = child;
    });
  }
  sort(root);
  return root.children;
}

function sort(node: TreeNode) {
  node.children.sort((a, b) => {
    if (!a.file !== !b.file) return a.file ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sort);
}

/** Folders that contain `path`, so selecting a deep file opens its ancestors. */
export function ancestorsOf(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}
