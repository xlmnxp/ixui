import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center ${className ?? ""}`}
    >
      {icon && <div className="text-3xl">{icon}</div>}
      <div className="text-sm font-medium text-text-primary">{title}</div>
      {description && <p className="max-w-md text-xs text-text-secondary">{description}</p>}
      {action}
    </div>
  );
}
