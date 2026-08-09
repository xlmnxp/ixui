# ixui Redesign — Proxmox/ESXi-Style Shell, Cluster Tree, Floating Wizard

**Date:** 2026-08-09
**Status:** Approved

## Overview

Redesign the ixui shell so it visibly matches the Proxmox/ESXi admin aesthetic while using the genuine Incus brand identity. Four workstreams:

1. **Cluster-aware sidebar tree** — project root → cluster member nodes → instances as direct children, each rendered as a type icon (container/VM) with a corner status dot. Infra resources (images/profiles/networks/storage) move out of the sidebar into a vertical-tabbed project overview in the main content.
2. **Project selector** — a dropdown at the top of the sidebar, synced to `currentProjectStore`.
3. **Side tabs** — instance detail switches from top tabs to a vertical labeled strip; the project overview and member view use the same `VerticalTabs` primitive.
4. **Incus-true palette + density** — accent anchored on the official logo color `#dd4814` with warm dark surfaces; denser layout; status color coding; accent header band.
5. **Floating create wizard** — a single draggable floating `Window` with a 4-stage wizard (Type & basics → Image → Profiles & resources → Review & create), replacing the `/instances/new` page.

## Decisions

| Topic | Decision |
|---|---|
| Approach | A: Incremental — primitives first, then wire (green at every step) |
| Icon library | `lucide-react` added as runtime dependency (amends "no external UI libraries" to "no UI libraries except lucide-react") |
| Window system | Single floating wizard (no taskbar/minimize/resize/multi-window) |
| Tree shape | Project root → cluster member nodes → instances (no intermediate branch) |
| Infra resources in tree | Removed — they appear as vertical tabs on the project overview |
| Project selector | Sidebar-top dropdown |
| Detail tabs | Vertical labeled strip (`VerticalTabs`) |
| Instance tree item | Type icon + corner status dot + name (no text badge) |
| Palette | Accent `#dd4814`-family orange, warm dark surfaces (verified from the official logo PNG) |
| Wizard entry | "Create instance" buttons open the floating window; `/instances/new` route removed |
| Clustering | Non-clustered servers report the single local member — same tree works everywhere |

## 1. New Primitives

### Window (`src/components/window.tsx`)

Floating wizard frame:
- Draggable via header (pointer events, clamped to viewport)
- Fixed size 640×520, centered on open
- Backdrop click and Escape close (`onClose`); Escape guarded when mid-wizard by the caller
- `role="dialog"`, title + optional subtitle, footer slot (Back/Next/Create)
- No resize, no taskbar, no minimize, no multi-window (single-window scope)
- `data-testid="window"`, drag handle `data-testid="window-drag"`, close `data-testid="window-close"`

### VerticalTabs (`src/components/vertical-tabs.tsx`)

- Same `TabItem { key: string; label: ReactNode }` contract as the existing `Tabs`
- Rendered as a narrow vertical column (~180px) with icon + label rows
- Active tab: accent border-left + tinted background; inactive: subtle hover
- `data-testid="vtab-<key>"`, container `data-testid="vertical-tabs"`

### ProjectDropdown (`src/components/project-dropdown.tsx`)

- Button showing current project name + chevron
- Popover listing projects from `projectsStore` with a check on the current one
- Selecting calls `setCurrentProject` (persists via localStorage as today)
- Closes on outside click and Escape
- `data-testid="project-selector"`

### Tree model builder (`src/shell/tree-model.ts`)

Pure function `buildTree(project, members, instances, location)` → `TreeNode[]`:
- Dashboard node, project root node, gallery node
- Project root children = cluster member nodes (from `/1.0/cluster/members`), sorted by name
- Member children = instances with `location === member.name`, sorted by name; instances without a location go under an "unassigned" node
- Members with no instances still render (expandable, empty)
- Each instance node carries `{ status, type }` for icon + corner-dot rendering
- Branches with counts: none in the sidebar anymore

## 2. Sidebar Restructure

- Fixed left panel (~240px), no icon-collapse mode
- Project dropdown at the top (above the tree)
- Tree:
  ```
  ▸ Dashboard                   → /dashboard (server info, gauges, recent ops)
  ▾ default                     ← project node → project overview at /
      ▾ incus-1                ← cluster member node → /members/incus-1
          ▶ web1   [Box]       ← type icon with corner status dot + name
          ■ db1    [Monitor]
      ▾ incus-2
  Component Gallery
  ```
- Instance item = lucide type icon (`Box` container / `Monitor` VM) with a small colored status dot overlaid on its corner (green running / gray stopped / blue frozen / red error), then the name. No text badge.
- Selection highlight follows the route (`/instances/:name` → instance child; `/` → project root)
- Instance children update live from the instances store (lifecycle events already flow)

### API/data

- `GET /1.0/cluster/members` — new endpoint in `infraApi` (or a `clusterApi`): `ClusterMember { server_name, url, database, status, message, architecture }`
- `Instance` type gains `location: string` (already in the Incus API)
- Member list + instances loaded in a new `useTreeData` hook (replaces `useResourceCounts`): fetches cluster members + instance lists, returns the member/instance grouping the tree model builder consumes.

## 3. Side Tabs

- **Instance detail**: `instance-detail.tsx` renders `VerticalTabs` instead of top `Tabs` — Overview | Console | Snapshots | Config | Logs, each with a lucide icon. Route stays `/instances/:name/:tab`. Tab content components unchanged.
- **Project overview** (new page at `/`): vertical tabs `Instances | Images | Profiles | Networks | Storage pools` rendering the existing page content. The old `/instances`, `/images`, `/profiles`, `/networks`, `/storage` routes become redirects to `/?tab=<name>` (deep links keep working; the tab state lives in the URL query).
- **Dashboard** moves to `/dashboard` (server info, gauges, recent operations — unchanged content, new route); the tree's Dashboard node links there.
- **Member view** (route `/members/:name`): instances table filtered by `location`, member header (name, architecture, status). Reuses the existing instances table component.

## 4. Palette, Density, Status Coding

### Palette (verified from the official Incus logo PNG — mark color `#dd4814`)

| Token | Value | Role |
|---|---|---|
| `accent-700` | `#B03910` | pressed / hover-dark |
| `accent-600` | `#DD4814` | primary accent (official brand) |
| `accent-500` | `#E85C26` | hover |
| `accent-400` | `#F0763F` | highlights, selected tree items |
| `accent-300` | `#F59B70` | light orange text/icons on dark |
| `surface-950` | `#191817` | page bg — warm dark neutral |
| `surface-900` | `#1F1E1D` | sidebar / panels |
| `surface-800` | `#262524` | content bg |
| `surface-700` | `#2E2D2B` | raised / table headers |
| `surface-600` | `#383634` | hover |
| `surface-500` | `#44413E` | input bg |
| `border` | `#3A3835` | warm-tinted borders |
| `text-primary` | `#EDEBE8` | warm whites |
| `text-secondary` | `#B5B1AB` | |
| `text-tertiary` | `#7E7A74` | |

Token names unchanged → zero test churn. Semantic colors (success/warning/danger) unchanged.

### Density

- Sidebar rows: reduced padding (py-0.5), 13px text
- Table cells: compact padding, 12–13px text
- Toolbar buttons default to `size="sm"` in these views

### Status color coding

- Tree: corner dots (already in §2)
- Tables: existing Badge/StatusDot tone map (supports `Running`)
- Detail header + task log: colored icons alongside text

### Header band

- Top bar gains a slim accent-tinted band behind the breadcrumbs (Incus orange)
- Sidebar header shows the app name with the Incus orange mark

## 5. Floating Create Wizard

- **Entry points**: "Create instance" on the Instances tab toolbar and the project overview header — both open the floating `Window`
- `/instances/new` route and page are removed (and their tests)
- **Stages** (one state object; Back preserves entries):
  1. **Type & basics** — container/VM radio cards (lucide icon + label), name, description
  2. **Image** — local images for the chosen type, searchable list; "Pull from remote" inline expander (alias + server) calling `pullImage` and refreshing
  3. **Profiles & resources** — profile checkboxes, limits (memory/CPU), network device picker (networks from the current project)
  4. **Review & create** — summary card → `instancesApi.create` (project-scoped), `operationsApi.wait`, check final status === "Success", toast, close window
- Validation gates each stage (name regex on stage 1; image required by stage 4)
- Reuses: `instancesApi.create`, `operationsApi.wait`, `infraApi` lists, `toast`, stores

## 6. Testing

- Primitives: Window (drag moves, escape/backdrop close, footer), VerticalTabs (active state, clicks), ProjectDropdown (open/close, selection calls `setCurrentProject`, outside-click), tree model builder (member grouping, state/type mapping, unassigned bucket) — unit + RTL
- Sidebar: mocked API + stores → members with nested instances, corner status dots, route-following selection, dropdown switching
- Project overview + member view: tab switching renders correct content; member view filters by location
- Wizard: per-stage validation, Back preserves state, successful create waits + closes, failure toasts and stays open
- Detail side tabs: existing detail tests updated only where the tab-strip query changes (top `tabs` → `vtab-`)
- No E2E; manual verification against the live cluster via Playwright at the end
