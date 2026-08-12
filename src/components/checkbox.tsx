import { useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-text-primary ${className}`}>
      <input
        ref={inputRef}
        type="checkbox"
        className="peer sr-only pointer-events-none"
        data-testid="checkbox"
        {...rest}
      />
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-surface-600 text-transparent transition-colors peer-checked:border-accent-500 peer-checked:bg-accent-600 peer-checked:text-white peer-hover:border-accent-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-400"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
