export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-testid="switch"
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-accent-600" : "bg-surface-500"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4.5" : "left-0.5"}`}
        />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
