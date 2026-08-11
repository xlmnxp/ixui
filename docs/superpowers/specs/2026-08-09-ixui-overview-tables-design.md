# ixui Overviews as Key/Value Tables Design

**Date:** 2026-08-09
**Status:** Approved

## Overview

Convert all three "overview" views — instance detail, member (node) view, and the global dashboard — from card/panel layouts into read-only key/value tables, matching the table-first look of the rest of the UI.

## Decisions

| Topic | Decision |
|---|---|
| Shared component | `KeyValueTable` — read-only two-column table (Property \| Value) built on the existing `Table` primitive |
| Checkbox column | Present in EVERY table — functional with selection, inert (disabled) otherwise |
| Descriptions | Field help — muted helper text under the value in the Value cell, NOT a column |
| IP rows | One row per IP address; IPv4 + IPv6 |
| Instance overview | `OverviewTab` renders a `KeyValueTable` (Status, Type, Created, Last used, Profiles, one IP row per address, Memory limit, CPU limit) + description below |
| Member view | Gains `VerticalTabs` — **Overview \| Instances**; Overview = member `KeyValueTable` (Member, Status, Architecture, Database, URL, Message); Instances = the existing location-filtered table; header strip stays above |
| Global overview | `/dashboard` becomes the global overview: server `KeyValueTable` (Hostname, Version, Project) + resource-summary `KeyValueTable` (Instances by state, Images, Profiles, Networks, Storage pools) + recent operations list below |
| Gauges | Dropped (CPU/memory gauges and per-instance state aggregation superseded by the summary tables) |
| Routing | Member tabs use `?tab=` (default `overview`) like the project overview; no other route changes |
| API | No new surface — all data already fetched |
| Non-table content | Content that is not a table after vertical tabs (e.g. the Logs tab) gets padding (`p-3`) so it doesn't butt against the tab bar |

## 1. KeyValueTable Component

`src/components/key-value-table.tsx`:

- `KeyValueTable({ rows, dataTestId? }: { rows: { key: string; value: ReactNode }[]; dataTestId?: string })`
- Built on the existing `Table` primitive with two fixed columns (Property, Value), no selection/sorting/row-click.
- **Table-parity design (user directive):** renders the standard thead header row (`Property | Value`); the checkbox column is present in EVERY table (functional when selection is wired, inert disabled checkboxes otherwise — handled by the `Table` primitive itself).
- Value cells render arbitrary ReactNode (Badges, formatted text).
- `data-testid="kv-table"` default.
- Unit + RTL tests: renders rows, header, inert checkboxes (disabled), custom testid, empty rows render the table's empty message.

## 1b. Config Editor Table Parity

The shared `KeyValueEditor` (instance Config tab + Profiles dialog) matches the real `Table` design exactly:

- **Header row:** thead with a checkbox header (select-all) + `Key | Value`. NO description column — descriptions are field help, rendered as muted helper text under the value inside the Value cell.
- **Checkbox column:** per-row checkboxes drive selection — **multi-select** like the real Table (checking a row no longer clears others; row-click no longer selects). `Edit` acts on the first selected row; `Remove` removes all selected rows; both stay disabled with no selection.
- **Visual parity:** same `text-[13px]` sizing, `divide-y` row separation, `bg-surface-800` tbody, and row hover as the regular Table.
- Hover pencil (`kv-edit-<key>`, next to the VALUE) and double-click value editing unchanged.
- Tests updated: selection via checkboxes (multi-select, select-all), Edit on first selected, Remove-all-selected, description-as-helper-text.

## 1c. Config Page Layout (directives)

- **Full-width table:** the Config tab has no max-width/padding — the editor table spans the full content width like the overview tables.
- **Description as a nullable first row:** the instance description is a first table row ("Description") in the editor — editable inline like any row, nullable (empty allowed), wired via `description`/`onDescriptionChange` props. Not a top input, not a column.
- **No Add button — in-table placeholder:** the toolbar Add button is gone; a ghost "+ Add row" row at the bottom of the table (`kv-add-row`) appends an EMPTY row (no `custom_N` prefill), enters edit mode with the key input focused and preselected. **Escape removes the freshly created row** (existing rows: Escape just cancels).
- **Save/Cancel/Delete in the instance bar (Config tab only):** the config editor lifts its actions up via `registerActions` (save, cancel, removeSelected, dirty, selectedCount); the instance action strip shows **Save (disabled unless dirty) | Cancel | Delete (enabled when rows are selected)** on the Config tab, grouped before the lifecycle buttons.

## 1c. IP Rows and IPv6

- The instance overview shows **each IP on its own row** (key "IP address", one row per address).
- Both IPv4 (`inet`) and IPv6 (`inet6`) addresses are included.

## 2. Instance Overview

`src/pages/instance-overview.tsx` (`OverviewTab({ instance })`):

- Replaces the `Detail` card grid with a `KeyValueTable`:
  - Name, Status (Badge with `instanceStatusTone`), Type ("Container"/"Virtual machine"), Created, Last used ("Never" when empty), Profiles (joined), IP addresses (from `instancesApi.state()` network addresses filtered to `inet`, "—" when none or state unavailable), Memory limit (`config["limits.memory"] ?? "—"`), CPU limit (`config["limits.cpu"] ?? "—"`)
- The description renders as a bordered block below the table when present.
- State fetch stays best-effort (`catch → null`).

## 3. Member View Tabs

`src/pages/member-view.tsx`:

- Layout: member header strip (unchanged) → `VerticalTabs` (Overview `Gauge` icon | Instances `Boxes` icon) → content.
- Tab state via `?tab=` (useSearchParams), default `overview`, invalid → `overview`.
- Overview tab: `KeyValueTable` rows — Member (`server_name`), Status (`Badge` success/neutral by `Online`), Architecture, Database (Yes/No), URL, Message ("—" when empty).
- Instances tab: existing `<InstancesPage location={name} />`.
- Existing tests updated: the default tab now shows the overview table (not the instances table); add a tab-switch test.

## 4. Global Dashboard

`src/pages/dashboard.tsx` (`DashboardPage`):

- Server block: `KeyValueTable` — Hostname, Version, Project (from `serverApi.info()`; "—" fallbacks on failure).
- Resource summary: `KeyValueTable` — Instances by state (counts per status, joined), Images, Profiles, Networks, Storage pools (from `infraApi` lists).
- Recent operations list (from `operationsStore`) stays below, unchanged.
- REMOVED: the CPU/Memory gauge cards, the per-instance `instancesApi.state()` aggregation effect, the `HostResources` type usage, and `formatBytes` usage from this page (formatBytes stays in `src/lib/format.ts` for other consumers).

## 5. Testing

- `KeyValueTable`: rows render, custom testid, empty rows.
- `instance-overview`: update existing tests to assert table rows (Name/Status/Memory limit etc.) instead of the old `Detail` blocks.
- `member-view`: default tab = overview table with member rows; switch to Instances tab; `?tab=` handling.
- `dashboard`: rewrite tests — server table (hostname/version), resource summary (counts), recent operations; delete the gauge assertions ("8 cores · N running", "X GiB / Y GiB").
- Gates: `npx vitest run && npm run typecheck && npm run lint && npm run build`.
- Manual Playwright pass at the end: instance overview table, member tabs, global dashboard tables against the live cluster.
