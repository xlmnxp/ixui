import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";
import { metadataStore, metadataTypesStore, loadMetadata, configDescription } from "../state/metadata";
import { useStore } from "../state/store";

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
  /** Pin the Key/Value header while the surrounding container scrolls (default false). */
  stickyHeader?: boolean;
  /** Distance in px from the scroll container's top for the pinned header (default 0). */
  stickyHeaderOffset?: number;
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
  stickyHeader = false,
  stickyHeaderOffset = 0,
}: KeyValueEditorProps) {
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [displayValues, setDisplayValues] = useState(values);
  const editingRef = useRef<string | null>(null);

  const metadataDescriptions = useStore(metadataStore);
  const metadataTypes = useStore(metadataTypesStore);
  const effectiveDescriptions = descriptions ?? metadataDescriptions;
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  useEffect(() => {
    if (descriptions === undefined) loadMetadata();
  }, [descriptions]);

  const suggestions = useMemo(() => {
    const needle = draftKey.trim().toLowerCase();
    if (!needle) return [];
    return Object.keys(effectiveDescriptions)
      .filter((key) => !key.includes("<") && key.toLowerCase().includes(needle) && key !== draftKey)
      .sort((a, b) => {
        const aPrefix = a.toLowerCase().startsWith(needle) ? 0 : 1;
        const bPrefix = b.toLowerCase().startsWith(needle) ? 0 : 1;
        return aPrefix - bPrefix || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [draftKey, effectiveDescriptions]);

  // Open the suggestion dropdown upward when there is no room below the row.
  const [suggestionsUp, setSuggestionsUp] = useState(false);
  useEffect(() => {
    if (suggestions.length === 0) {
      setSuggestionsUp(false);
      return;
    }
    const input = document.querySelector<HTMLInputElement>("[data-kv-edit-row]");
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const needed = suggestions.length * 44 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    setSuggestionsUp(spaceBelow < needed && rect.top > needed);
  }, [suggestions, draftKey]);

  const selectSuggestion = (rowKey: string, key: string) => {
    setDraftKey(key);
    setSuggestionIndex(-1);
    const type = metadataTypes[key];
    if (type === "bool" && draftValue === "") setDraftValue("true");
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-testid="kv-value-edit-${rowKey}"]`)?.focus();
    });
  };

  const selectedKeys = controlledSelected ?? internalSelected;
  const setSelectedKeys: (keys: string[] | ((prev: string[]) => string[])) => void = controlledSelected !== undefined && onControlledSelection
    ? (updater) => onControlledSelection(typeof updater === "function" ? updater(selectedKeys) : updater)
    : setInternalSelected;

  useEffect(() => {
    setDisplayValues(values);
  }, [values]);

  const entries = Object.entries(displayValues);
  const selectableKeys = [...entries.map(([key]) => key), ...(description !== undefined ? [DESCRIPTION_ROW] : [])];
  const allSelected = selectableKeys.length > 0 && selectedKeys.length === selectableKeys.length;

  const toggle = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleAll = () => {
    setSelectedKeys(allSelected ? [] : selectableKeys);
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

  const keyInput = (rowKey: string) => {
    const knownDesc = configDescription(effectiveDescriptions, draftKey);
    const knownType = metadataTypes[draftKey];
    const showSuggestions = suggestions.length > 0 && !effectiveDescriptions[draftKey];
    return (
      <div className="relative">
        <input
          data-testid={`kv-key-edit-${rowKey}`}
          data-kv-edit-row={rowKey}
          className="w-full rounded border border-border bg-surface-500 px-1.5 font-mono text-xs text-text-primary focus:border-accent-500 focus:outline-none"
          value={draftKey}
          onChange={(e) => {
            setDraftKey(e.target.value);
            setSuggestionIndex(-1);
          }}
          onKeyDown={(e) => {
            if (showSuggestions && e.key === "ArrowDown") {
              e.preventDefault();
              setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
              return;
            }
            if (showSuggestions && e.key === "ArrowUp") {
              e.preventDefault();
              setSuggestionIndex((i) => Math.max(i - 1, -1));
              return;
            }
            if (showSuggestions && e.key === "Enter" && suggestionIndex >= 0 && suggestionIndex < suggestions.length) {
              e.preventDefault();
              const key = suggestions[suggestionIndex];
              if (key) selectSuggestion(rowKey, key);
              return;
            }
            if (e.key === "Enter") commitEdit(rowKey, draftKey, draftValue);
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={(e) => {
            if (editingRef.current !== rowKey) return;
            const next = e.relatedTarget;
            if (next instanceof HTMLElement && next.closest(`[data-kv-edit-row="${rowKey}"]`)) return;
            commitEdit(rowKey, draftKey, draftValue);
          }}
          aria-label={`Edit key ${rowKey}`}
        />
        {knownDesc && (
          <div className="mt-0.5 text-[11px] text-text-tertiary" data-testid="kv-key-hint">
            {knownDesc}
            {knownType && <span className="ml-1 rounded bg-surface-600 px-1 text-[10px]">{knownType}</span>}
          </div>
        )}
        {showSuggestions && (
          <div
            className={`absolute left-0 z-20 w-80 overflow-hidden rounded border border-border bg-surface-700 shadow-xl ${suggestionsUp ? "bottom-full mb-1" : "top-full mt-1"}`}
            data-testid="kv-suggestions"
          >
            {suggestions.map((key, i) => (
              <button
                type="button"
                key={key}
                data-testid={`kv-suggest-${key}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(rowKey, key);
                }}
                className={`flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left ${i === suggestionIndex ? "bg-surface-600" : "hover:bg-surface-600"}`}
              >
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-primary">
                  {key}
                  {metadataTypes[key] && <span className="rounded bg-surface-500 px-1 text-[10px] text-text-tertiary">{metadataTypes[key]}</span>}
                </span>
                <span className="w-full truncate text-[11px] text-text-tertiary">{effectiveDescriptions[key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDisplayValue = (key: string, value: string) => {
    const type = metadataTypes[key];
    if (type === "bool") {
      return <Badge tone={value === "true" ? "success" : "neutral"}>{value}</Badge>;
    }
    if (type === "integer") return <span className="font-mono text-xs">{value}</span>;
    return value;
  };

  const valueInput = (rowKey: string) => {
    const valueType = metadataTypes[draftKey];
    if (valueType === "bool") {
      return (
        <div className="flex items-center gap-2" data-kv-edit-row={rowKey}>
          <Switch
            checked={draftValue === "true"}
            onChange={(checked) => setDraftValue(checked ? "true" : "false")}
            label={draftValue === "true" ? "true" : "false"}
            dataTestId="kv-bool-switch"
          />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <input
          data-testid={`kv-value-edit-${rowKey}`}
          data-kv-edit-row={rowKey}
          inputMode={valueType === "integer" ? "numeric" : undefined}
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
            if (next instanceof HTMLElement && next.closest(`[data-kv-edit-row="${rowKey}"]`)) return;
            commitEdit(rowKey, draftKey, draftValue);
          }}
          aria-label={`Edit value ${rowKey}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-2" data-testid={dataTestId}>
      {showToolbar && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" data-testid="kv-add" onClick={addEntry}><Plus size={13} /> Add</Button>
          <Button variant="secondary" size="sm" data-testid="kv-edit" onClick={() => { if (selectedKeys[0]) startEditing(selectedKeys[0]); }} disabled={selectedKeys.length === 0}><Pencil size={13} /> Edit</Button>
          <Button variant="secondary" size="sm" data-testid="kv-remove" onClick={removeSelected} disabled={selectedKeys.length === 0}><Trash2 size={13} /> Remove</Button>
        </div>
      )}
      <table className={`w-full text-[13px] ${stickyHeader ? "border-separate border-spacing-0" : "border-collapse"}`}>
        <thead className={`bg-surface-700 text-left text-xs text-text-secondary ${stickyHeader ? "" : "border-b border-border"}`}>
          <tr>
            <th style={stickyHeader ? { top: stickyHeaderOffset } : undefined} className={`w-8 px-2 py-1 ${stickyHeader ? "sticky top-0 z-[5] border-b border-border bg-surface-700" : ""}`}>
              <Checkbox data-testid="kv-select-all" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
            </th>
            <th style={stickyHeader ? { top: stickyHeaderOffset } : undefined} className={`px-2 py-1 ${stickyHeader ? "sticky top-0 z-[5] border-b border-border bg-surface-700" : ""}`}>Key</th>
            <th style={stickyHeader ? { top: stickyHeaderOffset } : undefined} className={`px-2 py-1 ${stickyHeader ? "sticky top-0 z-[5] border-b border-border bg-surface-700" : ""}`}>Value</th>
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
                <Checkbox data-testid="kv-check-Description" checked={selectedKeys.includes(DESCRIPTION_ROW)} onChange={() => toggle(DESCRIPTION_ROW)} aria-label="Select Description" />
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
                <Checkbox data-testid={`kv-check-${key}`} checked={selectedKeys.includes(key)} onChange={() => toggle(key)} aria-label={`Select ${key}`} />
              </td>
              <td data-testid={`kv-key-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 font-mono text-xs text-text-primary">
                {editing === key ? keyInput(key) : (
                  <>
                    <div>{key}</div>
                    {configDescription(effectiveDescriptions, key) && (
                      <div className="mt-0.5 text-[11px] font-sans text-text-tertiary" data-testid={`kv-desc-${key}`}>
                        {configDescription(effectiveDescriptions, key)}
                      </div>
                    )}
                  </>
                )}
              </td>
              <td data-testid={`kv-value-${key}`} onDoubleClick={() => startEditing(key)} className="px-2 py-1 text-sm text-text-primary">
                {editing === key ? valueInput(key) : (
                  <span className="inline-flex items-center gap-1.5">
                    {renderDisplayValue(key, value)}
                    <span className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); startEditing(key); }}>
                      <button data-testid={`kv-edit-${key}`} aria-label={`Edit ${key}`} type="button" className="text-text-tertiary hover:text-text-primary"><Pencil size={13} /></button>
                    </span>
                  </span>
                )}
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
