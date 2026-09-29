"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { TooltipProvider } from "./ui";

/** App-wide client context: honour the OS reduced-motion setting, one tooltip delay everywhere. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
