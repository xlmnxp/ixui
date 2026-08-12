import { useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
  vertical?: boolean;
}

export function SplitPane({ left, right, initial = 40, min = 15, vertical = false }: SplitPaneProps) {
  const [percent, setPercent] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = vertical ? ((clientY - rect.top) / rect.height) * 100 : ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(85, Math.max(min, pct)));
  };

  return (
    <div
      ref={containerRef}
      data-testid="split-pane"
      className={`flex h-full ${vertical ? "flex-col" : ""}`}
      onMouseMove={(e) => dragging && onMove(e.clientX, e.clientY)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => { setDragging(false); setHovered(false); }}
    >
      <div className="min-h-0 min-w-0 overflow-auto" style={vertical ? { height: `${percent}%` } : { width: `${percent}%` }}>{left}</div>
      <div
        data-testid="split-handle"
        className={`relative shrink-0 ${vertical ? "h-px w-full" : "h-full w-px"}`}
      >
        <div
          data-testid="split-handle-hit"
          onMouseDown={() => setDragging(true)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={[
            "absolute",
            vertical ? "left-0 top-1/2 h-1 w-full -translate-y-1/2 cursor-row-resize" : "left-1/2 top-0 h-full w-1 -translate-x-1/2 cursor-col-resize",
            dragging || hovered ? (vertical ? "h-0.5 bg-accent-500" : "w-0.5 bg-accent-500") : "bg-transparent",
          ].join(" ")}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}
