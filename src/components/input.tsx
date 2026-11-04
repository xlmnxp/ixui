import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, name, ...rest }: InputProps) {
  const inputId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={inputId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      {/* Field + message share one box: the field loses its bottom edge and the
          message loses its top edge, so they read as a single control. */}
      <div className="flex flex-col">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={[
            "h-8 bg-surface-500 px-2.5 text-sm text-text-primary focus:outline-none",
            error
              ? "rounded-t border border-b-0 border-danger focus:border-danger"
              : "rounded border border-border focus:border-accent-500",
            className,
          ].join(" ")}
          data-testid="input"
          {...rest}
        />
        {error && (
          <span
            id={`${inputId}-error`}
            role="alert"
            data-testid="input-error"
            className="rounded-b border border-t-0 border-danger bg-danger/10 px-2.5 py-1 text-xs text-red-300"
          >
            {error}
          </span>
        )}
      </div>
    </label>
  );
}
