import { useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initial?: number;
  min?: number;
}

export function SplitPane({ left, right, initial = 40, min = 15 }: SplitPaneProps) {
  const [percent, setPercent] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(85, Math.max(min, pct)));
  };

  return (
    <div
      ref={containerRef}
      data-testid="split-pane"
      className="flex h-full"
      onMouseMove={(e) => dragging && onMove(e.clientX)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      <div className="min-w-0 overflow-auto" style={{ width: `${percent}%` }}>{left}</div>
      <div
        data-testid="split-handle"
        onMouseDown={() => setDragging(true)}
        className="w-1 cursor-col-resize bg-border hover:bg-accent-500"
      />
      <div className="min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}
