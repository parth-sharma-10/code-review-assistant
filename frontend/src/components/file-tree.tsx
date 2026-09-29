"use client";

import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { formatBytes } from "@/lib/format";
import { ancestorsOf, buildTree, type TreeNode } from "@/lib/tree";
import type { FileMeta } from "@/lib/types";
import { FileIcon } from "./icons";

interface Props {
  files: FileMeta[];
  activePath: string | null;
  selected: Set<string>;
  onOpen: (file: FileMeta) => void;
  onToggleSelect: (file: FileMeta) => void;
}

export function FileTree({ files, activePath, selected, onOpen, onToggleSelect }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // A folder is open unless the user collapsed it; the active file's folders are always open.
  const forcedOpen = useMemo(
    () => new Set(activePath ? ancestorsOf(activePath) : []),
    [activePath],
  );
  const isOpen = (path: string) => forcedOpen.has(path) || !collapsed.has(path);
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  function render(nodes: TreeNode[], depth: number) {
    return nodes.map((node) => {
      const indent = { paddingLeft: `${depth * 12 + 8}px` };
      if (!node.file) {
        const open = isOpen(node.path);
        return (
          <li key={node.path} role="treeitem" aria-expanded={open} aria-selected={false}>
            <button
              onClick={() => toggle(node.path)}
              style={indent}
              className="flex h-7 w-full items-center gap-1.5 pr-2 text-left text-ink-2 hover:bg-wash hover:text-ink"
            >
              <ChevronRight
                aria-hidden
                className={`size-3.5 shrink-0 text-ink-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
              />
              {open ? (
                <FolderOpen
                  aria-hidden
                  strokeWidth={1.75}
                  className="size-3.5 shrink-0 text-ink-3"
                />
              ) : (
                <Folder aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0 text-ink-3" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {open && <ul role="group">{render(node.children, depth + 1)}</ul>}
          </li>
        );
      }
      const file = node.file;
      const active = file.path === activePath;
      return (
        <li
          key={node.path}
          role="treeitem"
          aria-selected={active}
          className={`group relative flex items-center ${active ? "bg-marker/60" : "hover:bg-wash"}`}
        >
          <button
            onClick={() => onOpen(file)}
            style={indent}
            title={`${file.path} · ${formatBytes(file.size)}`}
            className={`flex h-7 min-w-0 flex-1 items-center gap-1.5 pr-1 text-left text-ink ${
              active ? "font-medium" : ""
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-marker-edge"
              />
            )}
            <span aria-hidden className="w-3.5 shrink-0" />
            <FileIcon name={node.name} className={active ? "text-ink" : "text-ink-3"} />
            <span className="truncate">{node.name}</span>
          </button>
          <input
            type="checkbox"
            checked={selected.has(file.id)}
            onChange={() => onToggleSelect(file)}
            aria-label={`Select ${file.path} for review`}
            className={`mr-2 size-3.5 accent-ink ${selected.has(file.id) ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
          />
        </li>
      );
    });
  }

  return (
    <ul role="tree" aria-label="Project files" className="py-1 font-mono text-[12.5px]">
      {render(tree, 0)}
    </ul>
  );
}
