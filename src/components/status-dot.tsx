import type { BadgeTone } from "./badge";

const dotClasses: Record<BadgeTone, string> = {
  neutral: "bg-text-tertiary",
  info: "bg-blue-400",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface StatusDotProps {
  tone: BadgeTone;
  label?: string;
}

export function StatusDot({ tone, label }: StatusDotProps) {
  return (
    <span data-testid="status-dot" className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClasses[tone]}`} />
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </span>
  );
}
