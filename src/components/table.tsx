import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "./checkbox";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right";
  width?: string;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  emptyMessage?: string;
  dataTestId?: string;
  /** Keep the header row pinned while the surrounding container scrolls (default true). */
  stickyHeader?: boolean;
  /** Distance in px from the scroll container's top for the pinned header (default 0). */
  stickyHeaderOffset?: number;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKeys,
  onSelectionChange,
  emptyMessage = "No data",
  dataTestId = "table",
  stickyHeader = true,
  stickyHeaderOffset = 0,
}: TableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...rows];
  if (sortCol) {
    const col = columns.find((c) => c.key === sortCol);
    if (col?.sortValue) {
      const sv = col.sortValue;
      sorted.sort((a, b) => {
        const av = sv(a);
        const bv = sv(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  const allSelected = rows.length > 0 && (selectedKeys?.length ?? 0) === rows.length;
  const toggleAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    onSelectionChange(allSelected ? [] : rows.map(rowKey));
  };
  const toggle = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    onSelectionChange(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]
    );
  };
  const headerClick = (col: Column<T>) => {
    if (!col.sortValue) return;
    if (sortCol === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col.key);
      setSortDir("asc");
    }
  };

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid={dataTestId}>
        <thead className="border-b border-border bg-surface-700 text-left text-xs text-text-secondary">
          <tr>
            {onSelectionChange ? (
              <th
                className={`w-8 px-3 py-2 ${stickyHeader ? "sticky z-[5] border-b border-border bg-surface-700" : ""}`}
                style={stickyHeader ? { top: stickyHeaderOffset } : undefined}
              >
                <Checkbox data-testid="select-all" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                key={col.key}
                data-testid={`th-${col.key}`}
                onClick={() => headerClick(col)}
                className={`px-2 py-1 ${stickyHeader ? "sticky z-[5] border-b border-border bg-surface-700" : ""} ${col.align === "right" ? "text-right" : ""} ${col.sortValue ? "cursor-pointer select-none hover:text-text-primary" : ""}`}
                style={stickyHeader ? { top: stickyHeaderOffset, width: col.width } : { width: col.width }}
              >
                {col.header}
                {sortCol === col.key ? (sortDir === "asc" ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-800">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="px-2 py-8 text-center text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = rowKey(row);
              const selected = selectedKeys?.includes(key) ?? false;
              return (
                <tr
                  key={key}
                  data-testid="row"
                  data-selected={selected}
                  onClick={() => onRowClick?.(row)}
                  className={`text-text-primary ${onRowClick ? "cursor-pointer" : ""} ${selected ? "bg-accent-600/10" : "hover:bg-surface-700"}`}
                >
                  {onSelectionChange ? (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox data-testid="row-select" checked={selected} onChange={() => toggle(key)} aria-label={`Select ${key}`} />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.key} className={`px-2 py-1 ${col.align === "right" ? "text-right" : ""}`} style={{ width: col.width }}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
  );
}
