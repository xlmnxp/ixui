import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, name, ...rest }: TextareaProps) {
  const textareaId = id ?? name;
  return (
    <label className="flex flex-col gap-1" htmlFor={textareaId}>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={[
          "rounded border bg-surface-500 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none",
          error ? "border-danger focus:border-danger" : "border-border focus:border-accent-500",
          className,
        ].join(" ")}
        data-testid="textarea"
        {...rest}
      />
      {error && (
        <span
          id={`${textareaId}-error`}
          role="alert"
          data-testid="textarea-error"
          className="mx-1 rounded bg-danger/10 px-2 py-1 text-xs text-red-300"
        >
          {error}
        </span>
      )}
    </label>
  );
}
