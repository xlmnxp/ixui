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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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
  const allSelected = entryCount > 0 && selectedKeys.length === entryCount;

  const toggle = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleAll = () => {
    setSelectedKeys(allSelected ? [] : entries.map(([key]) => key));
  };

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
    setSelectedKeys((prev) => (prev.includes(oldKey) ? prev.map((k) => (k === oldKey ? finalKey : k)) : prev));
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
    if (selectedKeys.length === 0) return;
    const next = { ...values };
    const nextDisplay = { ...displayValues };
    for (const key of selectedKeys) {
      delete next[key];
      delete nextDisplay[key];
    }
    setDisplayValues(nextDisplay);
    setSelectedKeys([]);
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
        <Button variant="secondary" size="sm" data-testid="kv-edit" onClick={() => { if (selectedKeys[0]) startEditing(selectedKeys[0]); }} disabled={selectedKeys.length === 0}><Pencil size={13} /> Edit</Button>
        <Button variant="secondary" size="sm" data-testid="kv-remove" onClick={removeSelected} disabled={selectedKeys.length === 0}><Trash2 size={13} /> Remove</Button>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead className="border-b border-border bg-surface-700 text-left text-xs text-text-secondary">
          <tr>
            <th className="w-8 px-2 py-1">
              <input type="checkbox" data-testid="kv-select-all" checked={allSelected} onChange={toggleAll} className="accent-accent-600" aria-label="Select all" />
            </th>
            <th className="px-2 py-1">Key</th>
            <th className="px-2 py-1">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-800">
          {entries.map(([key, value]) => (
            <tr
              key={key}
              data-testid={`kv-row-${key}`}
              data-selected={selectedKeys.includes(key)}
              className={`group ${selectedKeys.includes(key) ? "bg-accent-600/10" : "hover:bg-surface-700/60"}`}
            >
              <td className="w-8 px-2 py-1">
                <input type="checkbox" data-testid={`kv-check-${key}`} checked={selectedKeys.includes(key)} onChange={() => toggle(key)} className="accent-accent-600" aria-label={`Select ${key}`} />
              </td>
              <td data-testid={`kv-key-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 font-mono text-xs text-text-primary">
                {editing === key ? keyInput(key) : key}
              </td>
              <td data-testid={`kv-value-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 text-sm text-text-primary">
                {editing === key ? valueInput(key) : (
                  <span className="inline-flex items-center gap-1.5">
                    {value}
                    <span className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); startEditing(key); }}>
                      <button data-testid={`kv-edit-${key}`} aria-label={`Edit ${key}`} type="button" className="text-text-tertiary hover:text-text-primary"><Pencil size={13} /></button>
                    </span>
                  </span>
                )}
                {descriptions?.[key] && <div className="text-xs text-text-tertiary">{descriptions[key]}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
