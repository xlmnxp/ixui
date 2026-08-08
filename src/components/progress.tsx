export interface ProgressProps {
  value?: number;
  tone?: "accent" | "success" | "danger";
  size?: "sm" | "md";
}

const toneClasses = { accent: "bg-accent-500", success: "bg-success", danger: "bg-danger" };

export function Progress({ value, tone = "accent", size = "sm" }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      data-testid="progress"
      className={`w-full overflow-hidden rounded bg-surface-500 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
    >
      {value === undefined ? (
        <div className={`h-full w-1/3 ${toneClasses[tone]} animate-[indeterminate_1.2s_ease-in-out_infinite]`} />
      ) : (
        <div className={`h-full ${toneClasses[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      )}
    </div>
  );
}
