# ixui Full-Screen Layout + Terminal Popup Design

**Date:** 2026-08-09
**Status:** Approved

## Overview

Three changes to ixui: (1) full-screen layout — remove page paddings, flush the vertical-tabs shell, and make tables edge-to-edge; (2) move the instance terminal out of the detail tabs into a dedicated browser-popup window (`/terminal/:name`), opened from an all-in-one action strip on the instance page; (3) tree hover create buttons (project + member nodes) that open the create wizard, with member-targeted creation via `?target=`.

## Decisions

| Topic | Decision |
|---|---|
| Approach | A: Extract + parallelize — terminal extraction and the CSS pass are independent tracks |
| Top bar | No global bar — an all-in-one action strip on the instance detail page (name + status icon + Start/Stop/Restart/Delete + Terminal) |
| Terminal popup | `window.open('/ui/terminal/<name>')` — standalone route OUTSIDE the Shell; shell + VGA toggle inside |
| ConsoleTab | Deleted (logic extracted into `InstanceTerminal`) |
| Tree hover + | Project node → wizard (current project); member node → wizard with `targetMember` → `POST /1.0/instances?target=<member>` |
| Button icons | lucide icons (size 14) on all action buttons app-wide |
| Sidebar/task log | Unchanged (already flush) |

## 1. Full-Screen Layout Pass

- **Page padding removed:** `p-6` on project overview content, instance detail, member view, and dashboard content → flush (0 padding) to the shell edges.
- **Flush tabs + content:** `VerticalTabs` keeps its `border-r`; the outer gaps between tabs column and content are removed; content areas are borderless and fill the region.
- **Tables full-width:** the `Table` primitive drops the `rounded border` wrapper div (row separation stays via `divide-y`); cell padding tightens to `px-2 py-1`; sticky header stays. The empty-state row keeps centered text.
- **Sidebar + task log:** unchanged.

## 2. Terminal Popup

- **`InstanceTerminal`** (`src/pages/instance-terminal.tsx`): full-screen terminal reusing the verified exec/websocket logic from `ConsoleTab` (binary frames, control socket, window-resize, session guard, disconnect on unmount). No buttons or chrome. A small **shell / VGA toggle** (exec vs `PUT /instances/{name}/console`), defaulting to shell.
- **Route `/terminal/:name`** registered OUTSIDE the `Shell` element (bare page, popup-friendly): full-viewport terminal on the app background, slim instance-name label top-left.
- **`ConsoleTab` deleted** (`src/pages/instance/console.tsx` + `console.test.tsx`); the Console tab is removed from the instance detail `VerticalTabs`.
- **All-in-one action strip** on instance detail (replaces the header block, above the side tabs, compact h-10, full-width, flush): instance name + `InstanceStatusIcon`, `Start`, `Stop`, `Restart`, `Delete` (existing action logic), then `Terminal` → `window.open(\`/ui/terminal/${name}\`, \`terminal-${name}\`, \`width=1000,height=640\`)`.

## 3. Tree Hover Create Buttons

- **`TreeNode` gains `action?: ReactNode`** in the Tree primitive — rendered at the row's right edge, visible on row hover (group-hover); the action's click stops propagation so it doesn't toggle expand/select.
- **Tree model:** project node + each member node get an action: small `+` button `data-testid="tree-create-<node>"`.
  - Project `+` → opens the wizard (current project).
  - Member `+` → opens the wizard with `targetMember` set.
- **Wizard `targetMember?: string`:** read-only line in the stage-4 summary ("Target member: <name>"); create call appends `?target=` when set.
- **API:** `InstancesApi.create` gains optional `target?: string` — appended as `?target=` on the URL; body unchanged.
- **Sidebar state:** `wizardOpen` + `wizardTarget` in the Sidebar; one wizard instance mounted in the sidebar alongside the tree (the overview's wizard instance stays independent).

## 4. Button Icons Pass

All action buttons app-wide get a lucide icon (size 14, before the label):

| Button | Icon |
|---|---|
| Start | `Play` |
| Stop | `Square` |
| Restart | `RotateCw` |
| Freeze | `Snowflake` |
| Delete | `Trash2` |
| Create instance (toolbar + tree +) | `Plus` |
| Wizard Create (final stage) | `Check` |
| Pull image / Pull (dialog) | `Download` |
| Terminal / Open shell | `Terminal` |
| Disconnect | `X` |
| Back / Next | `ChevronLeft` / `ChevronRight` |
| Cancel | `X` |
| Save | `Check` |
| Reset | `RotateCcw` |
| Volumes | `Database` |
| Set default | `Star` |
| Task-log dismiss | `X` |
| Table row Overview action | `Eye` |

- **Overview action in instance tables:** every instance row in the instances tables (project overview Instances tab + member view) gains an Overview action — lucide `Eye` icon, `data-testid="row-overview-<name>"`, navigates to `/instances/<name>` (detail opens on the Overview tab). The action click stops propagation (row click already navigates there too; the action makes it explicit). The instance detail's Overview tab stays (display, not disable).
- Icon-only buttons keep `aria-label` (already present where needed).
- `Button` primitive needs no change (icons render as children with the existing `gap-2`).
- Plain navigational text links (tree labels) get no icons.

## 6. Table-Style Config Editor

The shared `KeyValueEditor` (instance Config tab + Profiles edit dialog) matches the regular `Table` design — columns **Key | Value** (no description column):

- **Descriptions are field help:** fed from `GET /1.0/metadata` (`configs[]` → `key`/`description`) into a `descriptions?: Record<string, string>` prop; rendered as muted helper text under the value inside the Value cell (absent when the server lacks `metadata.enabled`). The metadata fetch is global (not project-scoped).
- **Three edit paths into the same inline row-edit mode** (Enter/blur commits, Esc cancels):
  1. Double-click a **value** cell → inline input
  2. Select a row + **Edit** button (`kv-edit`, `Pencil`, enabled with a selection) → key + value both editable
  3. Hover the row → **Pencil icon** (`kv-edit-<key>`) → key + value both editable
- **Checkbox column:** per-row multi-select checkboxes + select-all in the header; `Edit` acts on the first selected row; `Remove` removes all selected.
- **Add / Remove** buttons above the table (`kv-add` `Plus`, `kv-remove` `Trash2`).
- Key-collision no-op rule preserved; edit-mode inputs use `kv-key-edit-<key>` / `kv-value-edit-<key>` testids.

## 6b. VGA Console (SPICE)

The VGA console works via the Incus console websocket carrying the SPICE protocol:

- **API:** the console endpoint requires **POST** (PUT returns 501); `InstancesApi.console()` posts `{ width, height, type: "vga", force: true }`.
- **Rendering:** the vendored spice-html5 library (`lib/spice/src`, LGPL) renders the VGA mode into a canvas via `SpiceMainConn` fed by the operation websocket, with a control websocket alongside. The connection instance is exposed as `window.spice_connection` (required by the library's resize helpers).
- **Fit:** the canvas scales to fit the terminal window (`#spice-screen` flex + `max-width/height` + `object-fit: contain`); the guest-side resolution change (SPICE monitors-config) only applies when the guest runs the SPICE guest agent.
- **Input mapping:** mouse coordinates are scaled from CSS pixels back to framebuffer pixels (`canvas.width / rect.width`) so the pointer aligns on scaled canvases.
- Shell mode keeps xterm (unchanged).
- jsdom shims: legacy `crypto.random` polyfill and the module mock for tests.

## 6c. Table/Key-Value Design Unification (directives)

- The config editor (`KeyValueEditor`) and the overview tables (`KeyValueTable`) share the regular `Table`'s visual design: same `text-[13px]` sizing, `border-collapse`, thead styling, `divide-y` rows, `bg-surface-800` tbody, and row hover.
- The checkbox column is present in every table — functional when selection is wired, inert (disabled) checkboxes otherwise.
- Rounded corners removed from `VerticalTabs` tab buttons, `Tree` rows, and tree action buttons (flush layout).
- Content that is not a table after vertical tabs gets padding (`p-3`) so it doesn't butt against the tab bar (e.g. the Logs tab).

## 7. Testing (updated)

- **Tree action:** unit test — node with `action` renders the action only on hover (assert presence + stopPropagation on click); tree-model test — project/member nodes carry `tree-create-*` actions.
- **Wizard target:** test — `targetMember` prop flows into the create call URL (`?target=`); summary shows the target line.
- **API:** test — `create` with `target` appends `?target=` and keeps `?project=`.
- **Terminal page:** extraction keeps the existing console tests' coverage (exec + console flows) — port the meaningful assertions from `console.test.tsx` to `instance-terminal.test.tsx`; shell/VGA toggle test.
- **Action strip:** instance-detail test — strip renders name/status/actions/Terminal; Terminal button calls `window.open` with the right URL (stub `window.open`).
- **Layout pass:** no new tests (visual); existing tests must stay green (they assert testids/text, not paddings).
- **Icons pass:** existing tests stay green (class/testid assertions unaffected); no icon-specific tests.
- **Config editor:** unit tests for the editor (double-click opens inline value input; select+Edit enables and edits key+value; hover pencil edits; Enter commits / Esc cancels; Add/Remove; description column renders from the prop and "—" fallback); ConfigTab test mocks `/1.0/metadata` and asserts descriptions render.
- Manual Playwright verification at the end: popup opens a real terminal against the live cluster; tree hover + creates with target; full-screen tables; config editor interactions.
