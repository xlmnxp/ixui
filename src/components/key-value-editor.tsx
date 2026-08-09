import { Button } from "./button";

export interface KeyValueEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  dataTestId?: string;
}

export function KeyValueEditor({ values, onChange, dataTestId = "kv-editor" }: KeyValueEditorProps) {
  const entries = Object.entries(values);
  const entryCount = entries.length;

  const setValue = (key: string, value: string) => onChange({ ...values, [key]: value });

  const setKey = (oldKey: string, newKey: string) => {
    const next = { ...values };
    const value = next[oldKey];
    delete next[oldKey];
    next[newKey] = value ?? "";
    onChange(next);
  };

  const removeEntry = (key: string) => {
    const next = { ...values };
    delete next[key];
    onChange(next);
  };

  const addEntry = () => {
    onChange({ ...values, [`custom_${entryCount + 1}`]: "" });
  };

  return (
    <div className="space-y-2" data-testid={dataTestId}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <input
            data-testid={`kv-key-${key}`}
            className="h-8 w-1/2 rounded border border-border bg-surface-500 px-2.5 font-mono text-xs text-text-primary focus:border-accent-500 focus:outline-none"
            value={key}
            onChange={(e) => setKey(key, e.target.value)}
            aria-label={`Key ${key}`}
          />
          <input
            data-testid={`kv-value-${key}`}
            className="h-8 flex-1 rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
            value={value}
            onChange={(e) => setValue(key, e.target.value)}
            aria-label={`Value ${key}`}
          />
          <Button variant="ghost" size="sm" data-testid={`kv-remove-${key}`} onClick={() => removeEntry(key)} aria-label={`Remove ${key}`}>✕</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" data-testid="kv-add" onClick={addEntry}>Add key</Button>
    </div>
  );
}
