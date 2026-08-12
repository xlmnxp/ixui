import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import { operationsStore, dismissOperation } from "../state/operations";
import { useStore } from "../state/store";
import { Badge } from "../components/badge";
import { Progress } from "../components/progress";

const statusTone = { Running: "info", Success: "success", Failure: "danger", Cancelled: "warning", Unknown: "neutral" } as const;

export interface TaskLogProps {
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}

export function TaskLog({ collapsed, onToggle }: TaskLogProps) {
  const operations = useStore(operationsStore);
  const [height, setHeight] = useState(224);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ y: 0, h: 0 });

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const max = Math.round(window.innerHeight * 0.6);
      setHeight(Math.min(max, Math.max(96, dragStart.current.h + (dragStart.current.y - e.clientY))));
    };
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (collapsed) {
    return (
      <div className="flex h-8 items-center justify-between border-t border-border bg-surface-900/95 px-3 backdrop-blur" data-testid="task-log">
        <span className="text-xs text-text-secondary">Operations ({operations.length})</span>
        <button data-testid="tasklog-toggle" onClick={() => onToggle(false)} className="text-text-tertiary hover:text-text-primary" aria-label="Expand task log"><ChevronUp size={14} /></button>
      </div>
    );
  }

  const running = operations.filter((o) => o.status === "Running").length;

  return (
    <div className="flex flex-col overflow-hidden border-t border-border bg-surface-900/95 backdrop-blur" style={{ height }} data-testid="task-log">
      <div
        data-testid="tasklog-resize"
        onMouseDown={(e) => { setDragging(true); dragStart.current = { y: e.clientY, h: height }; }}
        className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-accent-500"
      />
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-text-secondary">Operations ({running} running)</span>
        <div className="flex gap-2">
          <button data-testid="tasklog-toggle" onClick={() => onToggle(true)} className="text-xs text-text-tertiary hover:text-text-primary" aria-label="Collapse task log"><ChevronDown size={14} /></button>
          <button data-testid="tasklog-clear" onClick={() => operationsStore.setState((prev) => prev.filter((o) => o.status === "Running"))} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"><Trash2 size={12} /> Clear finished</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {operations.length === 0 ? (
          <p className="px-3 pb-2 text-xs text-text-tertiary">No operations.</p>
        ) : (
          <ul className="divide-y divide-border">
            {operations.map((op) => (
              <li key={op.id} className="flex items-center gap-3 px-3 py-1.5" data-testid="tasklog-entry">
                <Badge tone={statusTone[op.status]}>{op.status}</Badge>
                <span className="flex-1 truncate text-xs text-text-primary">{op.description}</span>
                {op.status === "Running" && <div className="w-32"><Progress value={undefined} /></div>}
                {op.status !== "Running" && op.err && <span className="max-w-48 truncate text-xs text-red-300">{op.err}</span>}
                {op.status !== "Running" && (
                  <button data-testid={`tasklog-dismiss-${op.id}`} onClick={() => dismissOperation(op.id)} className="text-text-tertiary hover:text-text-primary" aria-label="Dismiss"><X size={12} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
