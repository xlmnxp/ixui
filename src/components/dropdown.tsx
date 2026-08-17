import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  dataTestId?: string;
  /** sm: compact table-cell control, md: form-sized control. */
  size?: "sm" | "md";
  /** Menu alignment relative to the button. */
  align?: "left" | "right";
}

const sizeClasses = {
  sm: "h-7 px-1.5 text-xs",
  md: "h-8 px-2.5 text-sm",
};

/** Custom dropdown with icon options. The menu renders in a portal so scrollable
    tables and windows cannot clip it; it flips upward when near the viewport bottom. */
export function Dropdown({ value, onChange, options, dataTestId = "dropdown", size = "md", align = "left" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const buttonHeight = size === "sm" ? 28 : 32;
  const gap = 4;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid={dataTestId}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({
            left: rect.left,
            top: rect.top,
            width: Math.max(rect.width, 96),
            up: window.innerHeight - rect.bottom < 140,
          });
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-1.5 rounded border border-border bg-surface-500 text-text-primary hover:bg-surface-600 ${sizeClasses[size]}`}
      >
        {current?.icon}
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? value}</span>
        <ChevronDown size={size === "sm" ? 12 : 14} className="shrink-0 text-text-tertiary" />
      </button>
      {open && pos && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[60] overflow-hidden rounded border border-border bg-surface-700 py-0.5 shadow-xl"
          style={
            pos.up
              ? { left: pos.left, width: pos.width, bottom: window.innerHeight - pos.top + gap }
              : { left: pos.left, width: pos.width, top: pos.top + buttonHeight + gap }
          }
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`${dataTestId}-${opt.value}`}
              disabled={opt.disabled}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] disabled:opacity-40 ${
                opt.danger ? "text-danger hover:bg-danger/10" : "text-text-primary hover:bg-surface-600"
              }`}
            >
              {opt.icon}
              <span className={`min-w-0 flex-1 truncate ${align === "right" ? "text-right" : ""}`}>{opt.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
