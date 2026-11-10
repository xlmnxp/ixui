import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Anchor the bubble to the trigger's centre, start or end edge. */
  align?: "center" | "start" | "end";
}

/**
 * Renders through a portal so it is never clipped by a scroll container
 * (the sidebar lives inside an overflow-auto pane) — the bubble can therefore
 * stay centred on its trigger at any edge of the window.
 */
export function Tooltip({ label, children, side = "top", align = "center" }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [open, setOpen] = useState(false);

  const measure = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left =
      align === "end" ? rect.right : align === "start" ? rect.left : rect.left + rect.width / 2;
    setAnchor({ left, top: side === "top" ? rect.top : rect.bottom });
  };

  // Measure once on mount so the bubble exists (hidden) even before hovering.
  useLayoutEffect(() => {
    measure();
  }, [side, align]);

  useLayoutEffect(() => {
    if (open) measure();
    // Re-measure on layout changes (scroll, resize, sidebar drag).
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, side, align]);

  const alignClass =
    align === "end" ? "-translate-x-full" : align === "start" ? "" : "-translate-x-1/2";

  return (
    <span
      ref={triggerRef}
      data-testid="tooltip-trigger"
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {anchor &&
        createPortal(
          <span
            role="tooltip"
            data-testid="tooltip"
            aria-hidden={!open}
            className={`pointer-events-none fixed z-[60] whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-white transition-opacity ${
              open ? "opacity-100" : "opacity-0"
            } ${alignClass} ${side === "top" ? "-translate-y-full" : "translate-y-0"}`}
            style={{ left: anchor.left, top: side === "top" ? anchor.top - 4 : anchor.top + 4 }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
