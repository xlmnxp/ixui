import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { operationsStore, dismissOperation } from "../state/operations";
import { useStore } from "../state/store";
import { Badge } from "../components/badge";
import { Progress } from "../components/progress";

const statusTone = { Running: "info", Success: "success", Failure: "danger", Cancelled: "warning", Unknown: "neutral" } as const;

export function TaskLog() {
  const operations = useStore(operationsStore);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="flex h-8 items-center justify-between border-t border-border bg-surface-900 px-3" data-testid="task-log">
        <span className="text-xs text-text-secondary">Operations ({operations.length})</span>
        <button data-testid="tasklog-toggle" onClick={() => setCollapsed(false)} className="text-text-tertiary hover:text-text-primary" aria-label="Expand task log">▴</button>
      </div>
    );
  }

  const running = operations.filter((o) => o.status === "Running").length;

  return (
    <div className="max-h-56 overflow-y-auto border-t border-border bg-surface-900" data-testid="task-log">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-text-secondary">Operations ({running} running)</span>
        <div className="flex gap-2">
          <button data-testid="tasklog-toggle" onClick={() => setCollapsed(true)} className="text-xs text-text-tertiary hover:text-text-primary" aria-label="Collapse task log">▾</button>
          <button data-testid="tasklog-clear" onClick={() => operationsStore.setState((prev) => prev.filter((o) => o.status === "Running"))} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"><Trash2 size={12} /> Clear finished</button>
        </div>
      </div>
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
  );
}
