"use client";

import React from "react";
import { MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type AnimatedButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  MotionProps & {
    children?: React.ReactNode;
    as?: "button" | "a";
  };

/**
 * AnimatedButton (kept for API compatibility). The shine sweep and spring
 * scale were removed in the design overhaul: it now renders a plain secondary
 * button. Motion props are accepted and ignored.
 */
const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children = "Browse Components",
  className = "",
  as = "button",
  ...rest
}) => {
  const {
    whileHover: _whileHover,
    whileTap: _whileTap,
    whileFocus: _whileFocus,
    whileInView: _whileInView,
    whileDrag: _whileDrag,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...domProps
  } = rest as AnimatedButtonProps & Record<string, unknown>;
  void [_whileHover, _whileTap, _whileFocus, _whileInView, _whileDrag, _initial, _animate, _exit, _transition, _variants];
  const Component = (as === "a" ? "a" : "button") as React.ElementType;

  return (
    <Component
      {...domProps}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-fd-line-strong bg-fd-surface px-4 py-2 text-body-medium text-fd-ink",
        "transition-colors duration-120 ease-fd hover:bg-fd-surface-2",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-accent disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </Component>
  );
};

export default AnimatedButton;
