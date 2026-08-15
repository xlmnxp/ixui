import { Fragment, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { normalizeTypedPath } from "../lib/path";

export interface ExplorerNavbarProps {
  /** Current absolute path, shown as breadcrumbs. */
  cwd: string;
  canBack?: boolean;
  canForward?: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  /** Called with an absolute path when a crumb is clicked. */
  onNavigate: (path: string) => void;
  /** Validate and apply a typed path. Throwing keeps the input open with an inline error. */
  onCommitPath: (path: string) => void | Promise<void>;
  /** Extra actions rendered on the right side of the bar. */
  actions?: ReactNode;
  /** Pin the bar to the top of the nearest scroll container (default true). */
  sticky?: boolean;
}

export function ExplorerNavbar({
  cwd,
  canBack = false,
  canForward = false,
  onBack,
  onForward,
  onUp,
  onNavigate,
  onCommitPath,
  actions,
  sticky = true,
}: ExplorerNavbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const crumbs = cwd === "/" ? [] : cwd.split("/").slice(1);

  const startEditing = () => {
    setDraft(cwd);
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const commit = async () => {
    const path = normalizeTypedPath(draft);
    busyRef.current = true;
    setError(null);
    try {
      await onCommitPath(path);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : `Path not found: ${path}`);
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <div className={`top-0 z-10 bg-surface-900 ${sticky ? "sticky" : ""}`} data-testid="files-navbar">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Button size="sm" variant="ghost" aria-label="Back" data-testid="files-back" disabled={!canBack} onClick={onBack}><ArrowLeft size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label="Forward" data-testid="files-forward" disabled={!canForward} onClick={onForward}><ArrowRight size={14} /></Button>
        <Button size="sm" variant="ghost" data-testid="files-up" disabled={cwd === "/"} onClick={onUp}><ArrowUp size={14} /></Button>

        {editing ? (
          <input
            autoFocus
            data-testid="files-path-input"
            aria-invalid={error !== null}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              else if (e.key === "Escape") cancelEditing();
            }}
            onBlur={() => {
              if (!busyRef.current) cancelEditing();
            }}
            placeholder="/path/to/directory"
            className={`min-w-0 flex-1 rounded border bg-surface-700 px-2 py-1.5 font-mono text-xs text-text-primary outline-none placeholder:text-text-tertiary ${error ? "border-danger focus:border-danger" : "border-accent-500"}`}
          />
        ) : (
          <div
            className="flex min-w-0 flex-1 cursor-text items-center gap-1 overflow-hidden rounded border border-border bg-surface-700 px-2 py-1.5 hover:border-surface-500"
            data-testid="files-breadcrumbs"
            title="Click to edit path"
            onClick={startEditing}
          >
            <button
              type="button"
              data-testid="crumb-root"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate("/");
              }}
              className="shrink-0 rounded px-1 font-mono text-xs text-text-secondary hover:bg-surface-600 hover:text-text-primary"
            >
              /
            </button>
            {crumbs.map((segment, i) => {
              const path = "/" + crumbs.slice(0, i + 1).join("/");
              return (
                <Fragment key={path}>
                  <ChevronRight size={12} className="shrink-0 text-text-tertiary" />
                  <button
                    type="button"
                    data-testid={`crumb-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(path);
                    }}
                    className={`shrink-0 rounded px-1 font-mono text-xs ${i === crumbs.length - 1 ? "text-text-primary" : "text-text-secondary hover:bg-surface-600 hover:text-text-primary"}`}
                  >
                    {segment}
                  </button>
                </Fragment>
              );
            })}
          </div>
        )}

        {actions}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="files-path-error"
          className="border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-red-300"
        >
          {error}
        </div>
      )}
    </div>
  );
}
