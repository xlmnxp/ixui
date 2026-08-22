import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface SplitButtonOption {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface SplitButtonProps {
  label: string;
  icon?: ReactNode;
  onPrimary: () => void;
  options: SplitButtonOption[];
  dataTestId?: string;
}

/** A grouped primary button + dropdown caret that share one border. */
export function SplitButton({ label, icon, onPrimary, options, dataTestId = "split-button" }: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} data-testid={dataTestId} className="relative flex items-center">
      <button
        type="button"
        data-testid={`${dataTestId}-primary`}
        onClick={onPrimary}
        className="inline-flex h-7 items-center gap-2 rounded-l rounded-r-none border border-border border-r-0 bg-surface-600 px-2.5 text-xs font-medium text-text-primary hover:bg-surface-700"
      >
        {icon}
        {label}
      </button>
      <button
        type="button"
        data-testid={`${dataTestId}-menu`}
        aria-label={`${label} options`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center justify-center rounded-l-none rounded-r border border-border bg-surface-600 px-1.5 text-xs text-text-primary hover:bg-surface-700"
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div data-testid={`${dataTestId}-items`} className="absolute right-0 top-full z-40 mt-1 min-w-44 overflow-hidden rounded border border-border bg-surface-800 py-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setOpen(false);
                opt.onSelect();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-surface-700"
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
