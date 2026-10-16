"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TiltCardProps {
  children: ReactNode;
  /** Ignored: the tilt effect was removed (DESIGN_SPEC §3.4). */
  max?: number;
  /** Ignored: the glare effect was removed (DESIGN_SPEC §3.4). */
  glare?: boolean;
  className?: string;
}

/** Inert since the design overhaul: renders its children plainly. Kept so
 * existing imports compile; drop it from call sites. */
export function TiltCard({ children, className }: TiltCardProps) {
  return <div className={cn(className)}>{children}</div>;
}
