# ixui Overviews-as-Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the instance, member, and global dashboard overviews into read-only key/value tables that visually match the real Table (header + checkbox column), and give the config editor the same table-parity (header + multi-select checkboxes).

**Architecture:** One new shared component (`KeyValueTable`) plus a small `Table` primitive extension (inert checkbox column); the three overview consumers (instance overview, member view tabs, dashboard) each adopt it; the `KeyValueEditor` gets the table-parity rework (header row + checkbox selection replacing row-click). Tasks 1 and 5 are independent (parallel wave 1); tasks 2-4 consume Task 1's `KeyValueTable` (parallel wave 2); task 6 is final verification.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 tokens, lucide-react, Vitest + RTL.

## Global Constraints

- Runtime dependencies are ONLY: react, react-dom, react-router-dom, xterm, @xterm/addon-fit, lucide-react. No other UI libraries.
- TypeScript strict. No `any`.
- All interactive elements get a data-testid.
- Every commit must pass: `npx vitest run`, `npm run typecheck`, `npm run lint`.
- Tests never hit the network.
- Table-parity: overview tables show a thead header row AND an inert checkbox column (disabled checkboxes, no select-all); the config editor gets a real header (Key | Value | Description) with select-all + multi-select per-row checkboxes.
- Member view tabs use `?tab=` (default `overview`); the member header strip stays above the tabs.
- The dashboard's CPU/Memory gauges and per-instance state aggregation are REMOVED (superseded by the summary tables); `formatBytes` stays in `src/lib/format.ts` for its other consumers.

---

### Task 1: KeyValueTable + Table Inert Checkbox Column

**Files:**
- Modify: `src/components/table.tsx` (add `inertCheckboxColumn` prop), `src/components/table.test.tsx`
- Create: `src/components/key-value-table.tsx`, `src/components/key-value-table.test.tsx`

**Interfaces:**
- Consumes: the existing `Table` primitive
- Produces:
  - `Table` gains `inertCheckboxColumn?: boolean` — when true, renders the checkbox `<th>` (no select-all) and a `<td>` per row containing `<input type="checkbox" disabled aria-label="Read-only" data-testid="inert-checkbox">`; no selection state, no `onSelectionChange` interaction; the empty-state colSpan accounts for it
  - `KeyValueRow = { key: string; value: ReactNode }`
  - `KeyValueTable({ rows, dataTestId? }: { rows: KeyValueRow[]; dataTestId?: string })` — `Table` with `inertCheckboxColumn`, columns Property (key, `text-text-secondary`) | Value (value); `rowKey` = `r.key`; default `dataTestId="kv-table"`

- [ ] **Step 1: Write the failing tests**

`src/components/table.test.tsx` — add:
```tsx
it("renders an inert checkbox column when requested", () => {
  render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} inertCheckboxColumn />);
  const boxes = screen.getAllByTestId("inert-checkbox");
  expect(boxes).toHaveLength(rows.length);
  expect(boxes[0]).toBeDisabled();
  expect(screen.queryByTestId("select-all")).not.toBeInTheDocument();
});
```

`src/components/key-value-table.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { KeyValueTable } from "./key-value-table";

describe("KeyValueTable", () => {
  it("renders rows with header and inert checkboxes", () => {
    render(<KeyValueTable rows={[{ key: "Status", value: "Running" }, { key: "Type", value: "Container" }]} />);
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getAllByTestId("inert-checkbox")).toHaveLength(2);
  });

  it("supports a custom testid", () => {
    render(<KeyValueTable rows={[{ key: "a", value: "b" }]} dataTestId="server-table" />);
    expect(screen.getByTestId("server-table")).toBeInTheDocument();
  });

  it("shows the empty message with no rows", () => {
    render(<KeyValueTable rows={[]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/table.test.tsx src/components/key-value-table.test.tsx`
Expected: FAIL — no `inertCheckboxColumn`, no module.

- [ ] **Step 3: Implement the Table extension**

`src/components/table.tsx`:
- `TableProps` gains `inertCheckboxColumn?: boolean;`
- The selection column header cell becomes:
```tsx
{onSelectionChange ? (
  <th className="w-8 px-3 py-2">
    <input type="checkbox" data-testid="select-all" checked={allSelected} onChange={toggleAll} className="accent-accent-600" aria-label="Select all" />
  </th>
) : inertCheckboxColumn ? (
  <th className="w-8 px-3 py-2" aria-hidden="true" />
) : null}
```
- The per-row cell:
```tsx
{onSelectionChange ? (
  <td className="px-3 py-2">
    <input type="checkbox" data-testid="row-select" checked={selected} onChange={() => toggle(key)} onClick={(e) => e.stopPropagation()} className="accent-accent-600" aria-label={`Select ${key}`} />
  </td>
) : inertCheckboxColumn ? (
  <td className="px-3 py-2">
    <input type="checkbox" data-testid="inert-checkbox" disabled aria-label="Read-only" className="accent-accent-600" />
  </td>
) : null}
```
- Empty-state colSpan: `columns.length + (onSelectionChange || inertCheckboxColumn ? 1 : 0)`.

- [ ] **Step 4: Implement KeyValueTable**

`src/components/key-value-table.tsx`:
```tsx
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
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/table.tsx src/components/table.test.tsx src/components/key-value-table.tsx src/components/key-value-table.test.tsx
git commit -m "feat: key-value table with table-parity checkboxes"
```

---

### Task 2: Instance Overview Table

**Files:**
- Modify: `src/pages/instance-overview.tsx`, `src/pages/instance-detail.test.tsx`

**Interfaces:**
- Consumes: `KeyValueTable` (Task 1), existing state fetch
- Produces: `OverviewTab({ instance })` renders a `KeyValueTable` (Name, Status Badge, Type, Created, Last used, Profiles, IP addresses, Memory limit, CPU limit) + the description block below

- [ ] **Step 1: Write the failing test**

`src/pages/instance-detail.test.tsx` — update the "shows instance overview" test:
```tsx
it("shows instance overview", async () => {
  render(
    <MemoryRouter initialEntries={["/instances/web1"]}>
      <Routes>
        <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByText("web1")).toBeInTheDocument();
  expect(screen.getByText("web server")).toBeInTheDocument();
  expect(screen.getByTestId("kv-table")).toBeInTheDocument();
  expect(screen.getByText("512MiB")).toBeInTheDocument();
  expect(screen.getByText("Property")).toBeInTheDocument();
});
```
(The old assertions on the `Detail` blocks — e.g. `getByText("web server")` was in a card — now the description renders as a block below the table; keep the description assertion and add the table assertions. Adjust if "512MiB" appeared in a Detail card before — it now appears as a table value.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/instance-detail.test.tsx`
Expected: FAIL — no `kv-table` in the overview.

- [ ] **Step 3: Rewrite the overview tab**

`src/pages/instance-overview.tsx`:
- Imports: `KeyValueTable` from `../components/key-value-table`, `Badge`, `instanceStatusTone`, `useEffect/useState`, `instancesApi`, `Instance`, `InstanceStateInfo`.
- Replace the `Detail` card grid with:
```tsx
const rows = [
  { key: "Status", value: <Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge> },
  { key: "Type", value: instance.type === "container" ? "Container" : "Virtual machine" },
  { key: "Created", value: new Date(instance.created_at).toLocaleString() },
  { key: "Last used", value: instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never" },
  { key: "Profiles", value: instance.profiles.join(", ") || "—" },
  { key: "IP addresses", value: ips.length > 0 ? ips.join(", ") : "—" },
  { key: "Memory limit", value: instance.config["limits.memory"] ?? "—" },
  { key: "CPU limit", value: instance.config["limits.cpu"] ?? "—" },
];
```
- Render: `<KeyValueTable rows={rows} />` then `{instance.description && <p className="mt-2 border-t border-border px-3 py-2 text-sm text-text-secondary">{instance.description}</p>}`.
- Keep the `ips` extraction from `state?.network` (family `inet`) and the best-effort state fetch.
- Delete the `Detail` helper component.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/instance-overview.tsx src/pages/instance-detail.test.tsx
git commit -m "feat: instance overview as key-value table"
```

---

### Task 3: Member View Tabs + Overview Table

**Files:**
- Modify: `src/pages/member-view.tsx`, `src/pages/member-view.test.tsx`

**Interfaces:**
- Consumes: `KeyValueTable` (Task 1), `VerticalTabs`, `useSearchParams`
- Produces: `MemberView` — header strip unchanged; `VerticalTabs` (Overview `Gauge` | Instances `Boxes`); `?tab=` (default `overview`); Overview tab = `KeyValueTable` (Member, Status Badge, Architecture, Database Yes/No, URL, Message "—" fallback); Instances tab = `<InstancesPage location={name} />`

- [ ] **Step 1: Write the failing tests**

`src/pages/member-view.test.tsx` — update and add:
```tsx
it("shows member info in the overview table", async () => {
  render(
    <MemoryRouter initialEntries={["/members/incus-1"]}>
      <Routes>
        <Route path="/members/:name" element={<MemberView />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByTestId("member-view")).toBeInTheDocument();
  expect(screen.getByText("x86_64")).toBeInTheDocument();
  expect(screen.getByTestId("kv-table")).toBeInTheDocument();
  expect(screen.getByText("incus-1")).toBeInTheDocument();
});

it("switches to the instances tab", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/members/incus-1"]}>
      <Routes>
        <Route path="/members/:name" element={<MemberView />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByTestId("kv-table");
  await user.click(screen.getByTestId("vtab-instances"));
  expect(screen.getByTestId("instances-page")).toBeInTheDocument();
});
```
(The old "shows member info and the instances table" test is replaced — the instances table now lives behind the Instances tab.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/pages/member-view.test.tsx`
Expected: FAIL — no tabs/kv-table.

- [ ] **Step 3: Implement**

`src/pages/member-view.tsx`:
- Imports: `KeyValueTable`, `VerticalTabs` + `VerticalTabItem`, `useSearchParams`, `Gauge`/`Boxes` lucide icons, `Badge` (already), `Server` (already).
- Tab state:
```tsx
const [searchParams, setSearchParams] = useSearchParams();
const tabParam = searchParams.get("tab");
const tab = tabParam === "instances" ? "instances" : "overview";
```
- Tabs array: `[{ key: "overview", label: "Overview", icon: <Gauge size={14} /> }, { key: "instances", label: "Instances", icon: <Boxes size={14} /> }]`
- Layout after the header strip:
```tsx
<div className="flex h-full">
  <VerticalTabs tabs={tabs} active={tab} onChange={(key) => setSearchParams({ tab: key })} />
  <div className="min-w-0 flex-1 overflow-auto">
    {tab === "overview" && (
      <KeyValueTable rows={[
        { key: "Member", value: member?.server_name ?? name },
        { key: "Status", value: member ? <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge> : "—" },
        { key: "Architecture", value: member?.architecture ?? "—" },
        { key: "Database", value: member ? (member.database ? "Yes" : "No") : "—" },
        { key: "URL", value: member?.url ?? "—" },
        { key: "Message", value: member?.message || "—" },
      ]} />
    )}
    {tab === "instances" && <InstancesPage location={name} />}
  </div>
</div>
```
- The not-found branch keeps `data-testid="member-view"` (unchanged).
- Note: `setSearchParams({ tab: key })` — the not-found case doesn't render the tabs.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/member-view.tsx src/pages/member-view.test.tsx
git commit -m "feat: member view tabs with overview table"
```

---

### Task 4: Global Dashboard Overview

**Files:**
- Modify: `src/pages/dashboard.tsx`, `src/pages/dashboard.test.tsx`

**Interfaces:**
- Consumes: `KeyValueTable` (Task 1), `serverApi.info()`, `infraApi` lists, `operationsStore`, `instancesStore`/`currentProjectStore`
- Produces: `DashboardPage` — server `KeyValueTable` (Hostname, Version, Project) + resource-summary `KeyValueTable` (Instances by state, Images, Profiles, Networks, Storage pools) + recent operations list; gauges and per-instance state aggregation REMOVED

- [ ] **Step 1: Rewrite the dashboard tests**

`src/pages/dashboard.test.tsx` — replace the gauge test with table assertions:
```tsx
it("shows server info and resource counts as tables", async () => {
  render(<DashboardPage />);
  expect(await screen.findByText("host1")).toBeInTheDocument();
  expect(screen.getByText("Version 6.0.0")).toBeInTheDocument();
  expect(screen.getByTestId("dashboard-server-table")).toBeInTheDocument();
  expect(screen.getByTestId("dashboard-summary-table")).toBeInTheDocument();
  expect(screen.getByText("Storage pools")).toBeInTheDocument();
});
```
- Delete the "shows real usage gauges from running instance state" test (the gauges are removed). The `instancesApi.state` mock and the `instancesStore` seeding become unnecessary — remove `state` from the `instancesApi` mock if nothing else uses it, and drop the `instancesStore` import if unused.
- Keep the "shows server info and resource counts" and "shows recent operations" tests (adjust the first if it asserted gauge-only things).
- The `api.get` mock for `/resources` is no longer used — remove it from the mock factory if nothing else consumes it.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/pages/dashboard.test.tsx`
Expected: FAIL — no tables yet.

- [ ] **Step 3: Rewrite the dashboard**

`src/pages/dashboard.tsx`:
- Remove: `HostResources` type, `api.get("/resources")` effect, the per-instance `state()` aggregation effect, `formatBytes` usage, the CPU/Memory gauge JSX, `Progress` and `instancesApi` imports if unused.
- Keep: server info fetch, infra counts fetch, recent operations list, `instanceStateCounts`.
- Render:
```tsx
<div className="space-y-4" data-testid="dashboard-page">
  <h1 className="px-3 pt-2 text-sm font-semibold text-text-primary">Dashboard</h1>
  <KeyValueTable
    rows={[
      { key: "Hostname", value: server?.hostname ?? "—" },
      { key: "Version", value: server ? `Version ${server.version}` : "—" },
      { key: "Project", value: project },
      { key: "Instances by state", value: Object.entries(stateCounts).map(([s, n]) => `${s}: ${n}`).join(" · ") || "—" },
      { key: "Images", value: String(counts.images) },
      { key: "Profiles", value: String(counts.profiles) },
      { key: "Networks", value: String(counts.networks) },
      { key: "Storage pools", value: String(counts.storage) },
    ]}
    dataTestId="dashboard-server-table"
  />
  <KeyValueTable
    rows={[
      { key: "Instances by state", value: Object.entries(stateCounts).map(([s, n]) => `${s}: ${n}`).join(" · ") || "—" },
      { key: "Images", value: String(counts.images) },
      { key: "Profiles", value: String(counts.profiles) },
      { key: "Networks", value: String(counts.networks) },
      { key: "Storage pools", value: String(counts.storage) },
    ]}
    dataTestId="dashboard-summary-table"
  />
  <div className="border-t border-border">
    <h2 className="px-3 py-2 text-xs font-semibold text-text-secondary">Recent operations</h2>
    {operations.length === 0 ? (
      <p className="px-3 pb-2 text-xs text-text-tertiary">No operations yet.</p>
    ) : (
      <ul className="divide-y divide-border">
        {operations.slice(0, 10).map((op) => (
          <li key={op.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
            <Badge tone={op.status === "Running" ? "info" : op.status === "Success" ? "success" : op.status === "Failure" ? "danger" : "warning"}>{op.status}</Badge>
            <span className="text-text-primary">{op.description}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
</div>
```
- The server table rows: Hostname, Version, Project. The summary table rows: Instances by state, Images, Profiles, Networks, Storage pools (matching the tests' testids `dashboard-server-table` / `dashboard-summary-table`).

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass. (Fix any stale mock references: `api.get`, `instancesApi.state`.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard.tsx src/pages/dashboard.test.tsx
git commit -m "feat: global dashboard overview as tables"
```

---

### Task 5: Config Editor Table Parity

**Files:**
- Modify: `src/components/key-value-editor.tsx`, `src/components/key-value-editor.test.tsx`

**Interfaces:**
- Consumes: nothing new (self-contained)
- Produces: `KeyValueEditor` with table parity — thead (`Key | Value | Description` + select-all checkbox header), per-row checkbox multi-select replacing row-click selection, `Edit` on the first selected row, `Remove` removing all selected rows, hover pencil + double-click unchanged

- [ ] **Step 1: Write the failing tests**

`src/components/key-value-editor.test.tsx` — update the selection-based tests and add:
```tsx
it("selects rows via checkboxes (multi-select) and removes all selected", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
  await user.click(screen.getByTestId("kv-check-key1"));
  await user.click(screen.getByTestId("kv-check-key2"));
  await user.click(screen.getByTestId("kv-remove"));
  expect(onChange).toHaveBeenCalledWith({});
});

it("edits the first selected row", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
  await user.click(screen.getByTestId("kv-check-key1"));
  await user.click(screen.getByTestId("kv-check-key2"));
  await user.click(screen.getByTestId("kv-edit"));
  expect(screen.getByTestId("kv-key-edit-key1")).toBeInTheDocument();
  await user.clear(screen.getByTestId("kv-key-edit-key1"));
  await user.type(screen.getByTestId("kv-key-edit-key1"), "key3");
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenLastCalledWith({ key3: "a", key2: "b" });
});

it("select-all checks every row", async () => {
  const user = userEvent.setup();
  render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={() => {}} />);
  await user.click(screen.getByTestId("kv-select-all"));
  expect(screen.getByTestId("kv-check-key1")).toBeChecked();
  expect(screen.getByTestId("kv-check-key2")).toBeChecked();
});
```
Existing tests to update: the "edits key and value via select + Edit" test used `kv-row-key1` click for selection → now uses `kv-check-key1`; the "removes the selected row via the Remove button" test → use the checkbox. The header row now renders "Key"/"Value"/"Description" text — check no existing assertion collides.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/key-value-editor.test.tsx`
Expected: FAIL — no `kv-check-*`/`kv-select-all`.

- [ ] **Step 3: Implement**

`src/components/key-value-editor.tsx`:
- Selection state becomes `const [selectedKeys, setSelectedKeys] = useState<string[]>([]);`
- Wrap the table in a real `<table className="w-full border-collapse text-[13px]">` with thead:
```tsx
<thead className="border-b border-border bg-surface-700 text-left text-xs text-text-secondary">
  <tr>
    <th className="w-8 px-2 py-1">
      <input type="checkbox" data-testid="kv-select-all" checked={allSelected} onChange={toggleAll} className="accent-accent-600" aria-label="Select all" />
    </th>
    <th className="px-2 py-1">Key</th>
    <th className="px-2 py-1">Value</th>
    <th className="px-2 py-1">Description</th>
  </tr>
</thead>
```
- Rows: first cell is `<input type="checkbox" data-testid={`kv-check-${key}`} checked={selectedKeys.includes(key)} onChange={() => toggle(key)} className="accent-accent-600" aria-label={`Select ${key}`} />`; the row keeps `data-testid={`kv-row-${key}`}` but selection no longer happens on row click (keep the row testid for the existing hover/dblclick tests; remove the row onClick selection).
- `allSelected = entries.length > 0 && selectedKeys.length === entries.length`; `toggleAll` selects/deselects all keys; `toggle(key)` adds/removes from the array.
- `Edit` (`kv-edit`) disabled when `selectedKeys.length === 0`; acts on `selectedKeys[0]`.
- `Remove` (`kv-remove`) disabled when `selectedKeys.length === 0`; removes all `selectedKeys` (filter the emitted map), then clears selection.
- The rename-commit `setSelected(finalKey)` behavior from the previous fix: `selectedKeys` is now an array — after a rename of the edited row, replace `finalKey` in the array (or clear the selection — pick: replace the old key with `finalKey` if it was selected).
- Hover pencil, double-click value edit, `descriptions` column, key-collision no-op, draft inputs: unchanged.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass. (Check the profiles/config page tests still pass — they render the editor; the row testids are unchanged.)

- [ ] **Step 5: Commit**

```bash
git add src/components/key-value-editor.tsx src/components/key-value-editor.test.tsx
git commit -m "feat: config editor table parity with checkbox selection"
```

---

### Task 6: Final Verification

**Files:**
- None new — full gates + build + manual Playwright pass

**Interfaces:**
- Consumes: everything

- [ ] **Step 1: Full gates + build**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: all pass; `dist/` emits `/ui/assets/` links.

- [ ] **Step 2: Manual Playwright verification against the live cluster**

Run: `INCUS_TARGET=https://192.168.0.101:8443 npm run dev`, then:
1. `/ui/` → project overview with vertical tabs (unchanged)
2. `/ui/instances/<name>` → Overview tab shows the key/value table (header + checkboxes, description below); Config tab shows the table editor with header, checkboxes, select-all; check a row, Remove works
3. `/ui/members/<name>` → tabs Overview | Instances; overview table renders member properties; Instances tab still filters
4. `/ui/dashboard` → server + resource summary tables; no gauges; recent operations list
5. Verify the tables visually match the real tables (header style, checkbox column)

Expected: all flows work against the real cluster. Report what you observed honestly.

- [ ] **Step 3: Commit (if any docs changed)**

```bash
git status --short
```
(Commit only if something changed; otherwise note "no code changes — verification only".)
