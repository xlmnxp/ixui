import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "./button";

export interface KeyValueEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  dataTestId?: string;
  descriptions?: Record<string, string>;
}

export function KeyValueEditor({ values, onChange, dataTestId = "kv-editor", descriptions }: KeyValueEditorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [displayValues, setDisplayValues] = useState(values);
  const editingRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplayValues(values);
  }, [values]);

  const entries = Object.entries(displayValues);
  const entryCount = entries.length;
  const selectedExists = selected !== null && selected in displayValues;

  const startEditing = (key: string) => {
    editingRef.current = key;
    setDraftKey(key);
    setDraftValue(values[key] ?? "");
    setEditing(key);
  };

  const commitEdit = (oldKey: string, newKey: string, newValue: string) => {
    if (editingRef.current !== oldKey) return;
    editingRef.current = null;
    const next = { ...values };
    const finalKey = newKey in next && newKey !== oldKey ? oldKey : newKey;
    if (finalKey !== oldKey) {
      delete next[oldKey];
    }
    next[finalKey] = newValue;
    setEditing(null);
    setSelected(finalKey);
    if (finalKey === oldKey && next[oldKey] === values[oldKey]) return;
    const nextDisplay = { ...displayValues };
    if (finalKey !== oldKey) {
      delete nextDisplay[oldKey];
    }
    nextDisplay[finalKey] = newValue;
    setDisplayValues(nextDisplay);
    onChange(next);
  };

  const cancelEdit = () => {
    editingRef.current = null;
    setEditing(null);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = { ...values };
    delete next[selected];
    const nextDisplay = { ...displayValues };
    delete nextDisplay[selected];
    setDisplayValues(nextDisplay);
    setSelected(null);
    onChange(next);
  };

  const addEntry = () => {
    const key = `custom_${entryCount + 1}`;
    const next = { ...values, [key]: "" };
    const nextDisplay = { ...displayValues, [key]: "" };
    setDisplayValues(nextDisplay);
    onChange(next);
  };

  const keyInput = (rowKey: string) => (
    <input
      data-testid={`kv-key-edit-${rowKey}`}
      data-kv-edit-row={rowKey}
      className="w-full rounded border border-border bg-surface-500 px-1.5 font-mono text-xs text-text-primary focus:border-accent-500 focus:outline-none"
      value={draftKey}
      onChange={(e) => setDraftKey(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitEdit(rowKey, draftKey, draftValue);
        if (e.key === "Escape") cancelEdit();
      }}
      onBlur={(e) => {
        if (editingRef.current !== rowKey) return;
        const next = e.relatedTarget;
        if (next instanceof HTMLElement && next.dataset.kvEditRow === rowKey) return;
        commitEdit(rowKey, draftKey, draftValue);
      }}
      aria-label={`Edit key ${rowKey}`}
    />
  );

  const valueInput = (rowKey: string) => (
    <input
      data-testid={`kv-value-edit-${rowKey}`}
      data-kv-edit-row={rowKey}
      className="w-full rounded border border-border bg-surface-500 px-1.5 text-sm text-text-primary focus:border-accent-500 focus:outline-none"
      value={draftValue}
      onChange={(e) => setDraftValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitEdit(rowKey, draftKey, draftValue);
        if (e.key === "Escape") cancelEdit();
      }}
      onBlur={(e) => {
        if (editingRef.current !== rowKey) return;
        const next = e.relatedTarget;
        if (next instanceof HTMLElement && next.dataset.kvEditRow === rowKey) return;
        commitEdit(rowKey, draftKey, draftValue);
      }}
      aria-label={`Edit value ${rowKey}`}
    />
  );

  return (
    <div className="space-y-2" data-testid={dataTestId}>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" data-testid="kv-add" onClick={addEntry}><Plus size={13} /> Add</Button>
        <Button variant="secondary" size="sm" data-testid="kv-edit" onClick={() => { if (selected) startEditing(selected); }} disabled={!selectedExists}><Pencil size={13} /> Edit</Button>
        <Button variant="secondary" size="sm" data-testid="kv-remove" onClick={removeSelected} disabled={!selectedExists}><Trash2 size={13} /> Remove</Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-xs font-medium text-text-secondary">
            <th className="px-2 py-1">Key</th>
            <th className="px-2 py-1">Value</th>
            <th className="px-2 py-1">Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr
              key={key}
              data-testid={`kv-row-${key}`}
              data-selected={selected === key}
              className={`group ${selected === key ? "bg-accent-600/10" : ""}`}
              onClick={() => setSelected(key)}
            >
              <td data-testid={`kv-key-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 font-mono text-xs text-text-primary">
                {editing === key ? keyInput(key) : (
                  <span className="inline-flex items-center gap-1.5">
                    {key}
                    <span className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); startEditing(key); }}>
                      <button data-testid={`kv-edit-${key}`} aria-label={`Edit ${key}`} type="button" className="text-text-tertiary hover:text-text-primary"><Pencil size={13} /></button>
                    </span>
                  </span>
                )}
              </td>
              <td data-testid={`kv-value-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 text-sm text-text-primary">
                {editing === key ? valueInput(key) : value}
              </td>
              <td className="px-2 py-1 text-xs text-text-tertiary">{descriptions?.[key] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
