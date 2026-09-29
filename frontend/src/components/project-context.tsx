"use client";

import { createContext, useContext } from "react";
import type { Project } from "@/lib/types";

export const ProjectContext = createContext<{ project: Project; reload: () => void } | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside the project layout");
  return ctx;
}
