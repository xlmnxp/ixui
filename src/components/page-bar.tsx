import type { ReactNode } from "react";

export interface BarState {
  title: ReactNode;
  actions: ReactNode[];
}

export interface PageBarProps {
  title: ReactNode;
  actions?: ReactNode[];
  dataTestId?: string;
  /** Pin the bar to the top of the scroll container (default true). */
  sticky?: boolean;
}

export function PageBar({ title, actions, dataTestId = "page-bar", sticky = true }: PageBarProps) {
  return (
    <div className={`flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-900 px-3 ${sticky ? "sticky top-0 z-10" : ""}`} data-testid={dataTestId}>
      <div className="min-w-0 truncate text-sm font-semibold text-text-primary">{title}</div>
      {actions && actions.length > 0 && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
    </div>
  );
}
