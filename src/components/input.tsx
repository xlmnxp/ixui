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
      <div className="flex flex-col">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={[
            "h-8 rounded border bg-surface-500 px-2.5 text-sm text-text-primary transition-colors duration-150 focus:outline-none",
            error ? "border-danger focus:border-danger" : "border-border focus:border-accent-500",
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
            className="field-error-in mx-1 rounded-b bg-danger/10 px-2 py-0.5 text-xs text-red-300"
          >
            {error}
          </span>
        )}
      </div>
    </label>
  );
}
