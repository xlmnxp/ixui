import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-700 text-text-secondary",
  info: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  success: "border-green-500/30 bg-green-500/15 text-green-300",
  warning: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  danger: "border-red-500/30 bg-red-500/15 text-red-300",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      data-testid="badge"
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
