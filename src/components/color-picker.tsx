export interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  colors?: string[];
  allowNone?: boolean;
  dataTestId?: string;
}

const DEFAULT_COLORS = ["#3fb950", "#58a6ff", "#d29922", "#f85149", "#bc8cff", "#39c5cf", "#f0883e", "#e3b341"];

export function ColorPicker({ value, onChange, colors = DEFAULT_COLORS, allowNone = true, dataTestId = "color-picker" }: ColorPickerProps) {
  return (
    <div data-testid={dataTestId} className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          data-testid={`${dataTestId}-${c}`}
          aria-label={`Color ${c}`}
          onClick={() => onChange(value === c ? "" : c)}
          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
            value === c ? "border-white scale-110" : "border-transparent"
          }`}
          style={{ background: c }}
        />
      ))}
      {allowNone && (
        <button
          type="button"
          data-testid={`${dataTestId}-none`}
          onClick={() => onChange("")}
          className={`relative ml-1 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
            !value ? "border-white scale-110" : "border-transparent"
          }`}
          aria-label="No color"
        >
          <span className="h-0.5 w-3 rounded bg-text-tertiary" />
        </button>
      )}
    </div>
  );
}
