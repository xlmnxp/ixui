import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = "", id, name, children, ...rest }: SelectProps) {
  const selectId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={selectId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <div className="flex flex-col">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={[
            "h-8 bg-surface-500 px-2.5 text-sm text-text-primary focus:outline-none",
            error
              ? "rounded-t border border-b-0 border-danger focus:border-danger"
              : "rounded border border-border focus:border-accent-500",
            className,
          ].join(" ")}
          data-testid="select"
          {...rest}
        >
          {children}
        </select>
        {error && (
          <span
            id={`${selectId}-error`}
            role="alert"
            data-testid="select-error"
            className="rounded-b border border-t-0 border-danger bg-danger/10 px-2.5 py-1 text-xs text-red-300"
          >
            {error}
          </span>
        )}
      </div>
    </label>
  );
}
