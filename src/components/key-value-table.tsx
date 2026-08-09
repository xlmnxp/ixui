import type { ReactNode } from "react";
import { Table } from "./table";
import type { Column } from "./table";

export interface KeyValueRow {
  key: string;
  value: ReactNode;
}

export interface KeyValueTableProps {
  rows: KeyValueRow[];
  dataTestId?: string;
}

export function KeyValueTable({ rows, dataTestId = "kv-table" }: KeyValueTableProps) {
  const columns: Column<KeyValueRow>[] = [
    { key: "property", header: "Property", render: (r) => <span className="text-text-secondary">{r.key}</span> },
    { key: "value", header: "Value", render: (r) => r.value },
  ];
  return <Table columns={columns} rows={rows} rowKey={(r) => r.key} inertCheckboxColumn emptyMessage="No data" dataTestId={dataTestId} />;
}
