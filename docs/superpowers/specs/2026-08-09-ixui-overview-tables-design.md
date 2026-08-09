# ixui Overviews as Key/Value Tables Design

**Date:** 2026-08-09
**Status:** Approved

## Overview

Convert all three "overview" views — instance detail, member (node) view, and the global dashboard — from card/panel layouts into read-only key/value tables, matching the table-first look of the rest of the UI.

## Decisions

| Topic | Decision |
|---|---|
| Shared component | `KeyValueTable` — read-only two-column table (Property \| Value) built on the existing `Table` primitive |
| Instance overview | `OverviewTab` renders a `KeyValueTable` (Name, Status, Type, Created, Last used, Profiles, IPs, Memory limit, CPU limit) + description below |
| Member view | Gains `VerticalTabs` — **Overview \| Instances**; Overview = member `KeyValueTable` (Member, Status, Architecture, Database, URL, Message); Instances = the existing location-filtered table; header strip stays above |
| Global overview | `/dashboard` becomes the global overview: server `KeyValueTable` (Hostname, Version, Project, API status) + resource-summary `KeyValueTable` (Instances by state, Images, Profiles, Networks, Storage pools) + recent operations list below |
| Gauges | Dropped (CPU/memory gauges and per-instance state aggregation superseded by the summary tables) |
| Routing | Member tabs use `?tab=` (default `overview`) like the project overview; no other route changes |
| API | No new surface — all data already fetched |

## 1. KeyValueTable Component

`src/components/key-value-table.tsx`:

- `KeyValueTable({ rows, dataTestId? }: { rows: { key: string; value: ReactNode }[]; dataTestId?: string })`
- Built on the existing `Table` primitive with two fixed columns (Property, Value), no selection/sorting/row-click.
- **Table-parity design (user directive):** renders the standard thead header row (`Property | Value`) AND an **inert checkbox column** — disabled checkboxes per row, no select-all, no selection state — so it reads identically to the real tables while staying read-only.
- Value cells render arbitrary ReactNode (Badges, formatted text).
- `data-testid="kv-table"` default.
- Unit + RTL tests: renders rows, header, inert checkboxes (disabled), custom testid, empty rows render the table's empty message.

## 1b. Config Editor Table Parity

The shared `KeyValueEditor` (instance Config tab + Profiles dialog) matches the real `Table` design:

- **Header row:** thead with a checkbox header (select-all, like the real Table) + `Key | Value | Description`.
- **Checkbox column:** per-row checkboxes drive selection — **multi-select** like the real Table (checking a row no longer clears others; row-click no longer selects). `Edit` acts on the first selected row; `Remove` removes all selected rows; both stay disabled with no selection.
- Hover pencil (`kv-edit-<key>`) and double-click value editing unchanged.
- Tests updated: selection via checkboxes (multi-select, select-all), Edit on first selected, Remove-all-selected.

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
