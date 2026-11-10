import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Horizontal anchoring; use "end" near a container's right edge so the bubble grows inwards. */
  align?: "center" | "start" | "end";
}

export function Tooltip({ label, children, side = "top", align = "center" }: TooltipProps) {
  const horizontal =
    align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 ${
          side === "top" ? "bottom-full mb-1" : "top-full mt-1"
        } ${horizontal}`}
      >
        {label}
      </span>
    </span>
  );
}
