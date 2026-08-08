import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-text-primary ${className}`}>
      <input type="checkbox" className="h-4 w-4 accent-accent-600" {...rest} />
      {label}
    </label>
  );
}
