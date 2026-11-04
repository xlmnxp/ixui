import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name for the group; defaults to the label. */
  ariaLabel?: string;
  dataTestId?: string;
}

/** Compact single-choice control: a labeled pill group of options. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
  dataTestId = "segmented",
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        data-testid={dataTestId}
        className="inline-flex w-fit rounded border border-border bg-surface-500 p-0.5"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`${dataTestId}-${option.value}`}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                selected ? "bg-accent-600 font-medium text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
