import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", id, name, ...rest }: TextareaProps) {
  const textareaId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={textareaId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <textarea
        id={textareaId}
        className={`rounded border border-border bg-surface-500 px-2.5 py-1.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none ${className}`}
        data-testid="textarea"
        {...rest}
      />
    </label>
  );
}
