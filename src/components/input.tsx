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
      <input
        id={inputId}
        className={[
          "h-8 rounded border bg-surface-500 px-2.5 text-sm text-text-primary",
          "placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none",
          error ? "border-danger" : "border-border",
          className,
        ].join(" ")}
        {...rest}
      />
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  );
}
