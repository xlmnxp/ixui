import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = "", id, name, children, ...rest }: SelectProps) {
  const selectId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={selectId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <select
        id={selectId}
        className={`h-8 rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none ${className}`}
        data-testid="select"
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
