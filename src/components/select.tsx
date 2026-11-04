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
            "h-8 rounded border bg-surface-500 px-2.5 text-sm text-text-primary transition-colors duration-150 focus:outline-none",
            error ? "border-danger focus:border-danger" : "border-border focus:border-accent-500",
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
            className="field-error-in mx-1 rounded-b bg-danger/10 px-2 py-0.5 text-xs text-red-300"
          >
            {error}
          </span>
        )}
      </div>
    </label>
  );
}
