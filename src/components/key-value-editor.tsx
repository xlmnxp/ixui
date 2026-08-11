import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "./button";

const DESCRIPTION_ROW = "__description__";

export interface KeyValueEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  dataTestId?: string;
  descriptions?: Record<string, string>;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  showToolbar?: boolean;
}

export function KeyValueEditor({
  values,
  onChange,
  dataTestId = "kv-editor",
  descriptions,
  description,
  onDescriptionChange,
  selectedKeys: controlledSelected,
  onSelectionChange: onControlledSelection,
  showToolbar = true,
}: KeyValueEditorProps) {
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [displayValues, setDisplayValues] = useState(values);
  const editingRef = useRef<string | null>(null);

  const selectedKeys = controlledSelected ?? internalSelected;
  const setSelectedKeys: (keys: string[] | ((prev: string[]) => string[])) => void = controlledSelected !== undefined && onControlledSelection
    ? (updater) => onControlledSelection(typeof updater === "function" ? updater(selectedKeys) : updater)
    : setInternalSelected;

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
    setDraftKey(key === DESCRIPTION_ROW ? "Description" : key);
    setDraftValue(key === DESCRIPTION_ROW ? (description ?? "") : (values[key] ?? ""));
    setEditing(key);
  };

  const commitEdit = (oldKey: string, newKey: string, newValue: string) => {
    if (editingRef.current !== oldKey) return;
    editingRef.current = null;
    if (oldKey === DESCRIPTION_ROW) {
      onDescriptionChange?.(newValue);
      setEditing(null);
      return;
    }
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
    if (editing === "" && editingRef.current === "") {
      const next = { ...values };
      delete next[""];
      const nextDisplay = { ...displayValues };
      delete nextDisplay[""];
      setDisplayValues(nextDisplay);
      setSelectedKeys((prev) => prev.filter((k) => k !== ""));
      onChange(next);
    }
    editingRef.current = null;
    setEditing(null);
  };

  const removeSelected = () => {
    if (selectedKeys.length === 0) return;
    const next = { ...values };
    const nextDisplay = { ...displayValues };
    let clearDescription = false;
    for (const key of selectedKeys) {
      if (key === DESCRIPTION_ROW) {
        clearDescription = true;
        continue;
      }
      delete next[key];
      delete nextDisplay[key];
    }
    if (clearDescription) onDescriptionChange?.("");
    setDisplayValues(nextDisplay);
    setSelectedKeys([]);
    onChange(next);
  };

  const addEntry = () => {
    const key = "";
    const next = { ...values, [key]: "" };
    const nextDisplay = { ...displayValues, [key]: "" };
    setDisplayValues(nextDisplay);
    onChange(next);
    selectKeyOnEditRef.current = true;
    startEditing(key);
  };

  const selectKeyOnEditRef = useRef(false);

  useEffect(() => {
    if (editing === null || !selectKeyOnEditRef.current) return;
    selectKeyOnEditRef.current = false;
    const input = document.querySelector<HTMLInputElement>(`[data-testid="kv-key-edit-${editing}"]`);
    input?.focus();
    input?.select();
  }, [editing]);

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
      {showToolbar && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" data-testid="kv-add" onClick={addEntry}><Plus size={13} /> Add</Button>
          <Button variant="secondary" size="sm" data-testid="kv-edit" onClick={() => { if (selectedKeys[0]) startEditing(selectedKeys[0]); }} disabled={selectedKeys.length === 0}><Pencil size={13} /> Edit</Button>
          <Button variant="secondary" size="sm" data-testid="kv-remove" onClick={removeSelected} disabled={selectedKeys.length === 0}><Trash2 size={13} /> Remove</Button>
        </div>
      )}
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
          {description !== undefined && (
            <tr
              data-testid="kv-row-Description"
              data-selected={selectedKeys.includes(DESCRIPTION_ROW)}
              className={`group ${selectedKeys.includes(DESCRIPTION_ROW) ? "bg-accent-600/10" : "hover:bg-surface-700/60"}`}
            >
              <td className="w-8 px-2 py-1">
                <input type="checkbox" data-testid="kv-check-Description" checked={selectedKeys.includes(DESCRIPTION_ROW)} onChange={() => toggle(DESCRIPTION_ROW)} className="accent-accent-600" aria-label="Select Description" />
              </td>
              <td className="px-2 py-1 text-xs text-text-primary">Description</td>
              <td data-testid="kv-value-Description" onDoubleClick={() => startEditing(DESCRIPTION_ROW)} className="px-2 py-1 text-sm text-text-primary">
                {editing === DESCRIPTION_ROW ? valueInput(DESCRIPTION_ROW) : (
                  <span className="inline-flex items-center gap-1.5">
                    {description || "—"}
                    <span className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); startEditing(DESCRIPTION_ROW); }}>
                      <button data-testid={`kv-edit-${DESCRIPTION_ROW}`} aria-label="Edit Description" type="button" className="text-text-tertiary hover:text-text-primary"><Pencil size={13} /></button>
                    </span>
                  </span>
                )}
              </td>
            </tr>
          )}
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
          <tr className="hover:bg-surface-700/60">
            <td className="w-8 px-2 py-1" />
            <td className="px-2 py-1" colSpan={2}>
              <button type="button" data-testid="kv-add-row" onClick={addEntry} className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-xs text-text-tertiary hover:text-text-primary">
                <Plus size={13} /> Add row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
