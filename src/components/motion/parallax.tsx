"use client";

import { type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

export interface ParallaxProps {
  children: ReactNode;
  /**
   * Drift as a fraction of the element's travel through the viewport.
   * Positive moves with the scroll (foreground), negative against it
   * (background). ~0.1–0.5 reads best.
   */
  speed?: number;
  axis?: "x" | "y";
  /** Scroll container for contained scroll areas. Defaults to the viewport. */
  container?: RefObject<HTMLElement | null>;
  /** Spring-smooth the drift. Disabled automatically under reduced motion. */
  spring?: boolean;
  className?: string;
}

/** Inert since the design overhaul (no parallax, DESIGN_SPEC §3.4): renders
 * its children plainly. Kept so existing imports compile; drop it from call
 * sites. */
export function Parallax({ children, className }: ParallaxProps) {
  return <div className={cn(className)}>{children}</div>;
}
