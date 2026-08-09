# ixui — Incus Web UI Design

**Date:** 2026-08-09
**Status:** Approved

## Overview

A web UI for Incus (the container/VM management daemon) built from scratch — no reuse of any existing Incus UI and no pre-built UI component library. The look blends Proxmox's dark theme and density with ESXi's layout clarity, using Incus brand colors. Every component is hand-built on top of a React + Tailwind v4 stack with a custom design-token system.

In production the built static assets are served by incusd itself at the `/ui/` path (same-origin with the API). In development a Vite proxy plugin authenticates to a local incusd using the user's existing client certificate.

## Decisions

| Topic | Decision |
|---|---|
| Framework | React 19 + TypeScript, Vite |
| Styling | Tailwind v4, design tokens as CSS custom properties |
| Components | Hand-built primitives, zero external UI libraries |
| Architecture | Approach A: SPA + dev proxy plugin; static export for prod |
| Dev auth | Vite plugin proxies `/1.0` → `https://127.0.0.1:8443` with cert from `~/.config/incus` (env-overridable) |
| Prod auth | Same-origin requests; browser TLS client cert or OIDC via an auth seam in the API client |
| Shell | Proxmox-style: collapsible sidebar tree + top bar + bottom operations log |
| Testing | Vitest unit + React Testing Library component tests; no E2E in V1 |

## 1. Project Structure & Tooling

```
ixui/
├── vite.config.ts            # dev proxy plugin (client cert → local incusd)
├── tailwind/                 # theme tokens → incus palette
├── src/
│   ├── components/           # primitives (Button, Table, Tree, Dialog, …)
│   ├── pages/                # route-level views
│   ├── shell/                # sidebar tree, top bar, task log
│   ├── api/                  # typed Incus API client + event stream
│   ├── state/                # stores (instances, operations, projects)
│   └── gallery/              # component gallery route
└── tests/
```

- **Stack:** Vite, React 19, TypeScript, Tailwind v4.
- **Routing:** react-router. Routes: `/` dashboard, `/instances/:name`, `/images`, `/profiles`, `/networks`, `/storage`, `/projects`, `/gallery`.
- **Vite plugin:** in dev, mounts `/1.0` → `https://127.0.0.1:8443` with `rejectUnauthorized: false` (self-signed local cert), reading cert/key from `INCUS_CERT_DIR` (default `~/.config/incus`).
- **Production:** static export with base path `/ui/` so incusd serves it at `/ui/`. Same-origin calls mean the proxy plugin is dev-only code.
- **Lint/typecheck:** eslint + `tsc --noEmit`, run in CI.

## 2. Design Tokens & Component System

### Tokens (Tailwind v4 `@theme`)

- **Incus palette:** teal/cyan accent family derived from the Incus brand blue.
- **Surfaces:** dark slate theme — sidebar `#1a1d21`, content `#22262b`, raised `#2b3036`.
- **Neutrals:** ESXi-style grays.
- **Semantic tokens:** success / warning / danger / info, mapped to CSS custom properties so a future light theme is a token swap.
- Spacing scale, typography (system UI stack, ~13px base for dense admin feel), radii, borders, shadows.

### Primitives (hand-built, zero external UI deps)

`Button`, `Input`, `Select`, `Checkbox`, `Switch`, `Textarea`, `Badge`, `Tooltip`, `Dialog`, `Tabs`, `Table` (sortable, selectable rows, sticky header), `Tree`, `Toast`, `Progress`, `Spinner`, `EmptyState`, `Breadcrumbs`, `ConfirmDialog`, `SplitPane`, `ResizablePanel`, `StatusDot`.

Each primitive: typed props, `data-testid` hooks, an example in the gallery, unit + RTL component tests.

### Gallery

A route listing every component with variants and a small props playground — the dogfood for the system.

## 3. Shell Layout & Navigation

Three-zone shell:

- **Left sidebar (collapsible):** resource tree — `Dashboard` at top, then projects (switcher, default project). Under each project: `Instances`, `Images`, `Profiles`, `Networks`, `Storage pools`. Each node expands into a list with counts and status badges; active route highlighted; ESXi-style object counts in the tree.
- **Top bar:** sidebar toggle, breadcrumb / current project, global search (instances/images/profiles), auth status chip (user, "TLS cert", or "OIDC"), theme placeholder.
- **Content area:** route views. Instance detail pages use tabbed layout (Overview, Console, Snapshots, Config, Logs) — ESXi-style tabs, Proxmox density.
- **Bottom operations bar:** collapsible strip — live operation entries fed by the `/1.0/events` WebSocket: type icon, resource, status (Running → Success/Error with progress), expandable detail, clear button. Clicking a task navigates to its resource.

## 4. API Client & Realtime Layer

- **Typed client** (`src/api/`): TypeScript interfaces mirroring Incus API types (Instance, Image, Profile, Network, StoragePool, Operation, Server) with thin wrappers over `fetch`: list/create/update/delete, using `/1.0/<resource>?recursion=1` list form. ETag support for update-after-read races.
- **Base path:** `/1.0` in prod (same-origin) and in dev (via the Vite proxy) — one code path.
- **Auth seam:** client checks `403` responses; an `auth` module decides the flow — if the browser has a TLS client cert installed it just works; otherwise a login screen triggers the OIDC redirect (`/oidc/login`) and resumes on return. Auth status shown in the top bar.
- **Event stream:** one WebSocket (`/1.0/events?type=operation,lifecycle,logging`) with auto-reconnect + backoff. Three consumers:
  1. operations store → task log bar
  2. lifecycle events → instant instance state/status updates in lists & detail pages
  3. resource usage → dashboard charts (bandwidth/disk via `state` counters)
- **Stores:** hand-rolled stores using `useSyncExternalStore` to stay dependency-light, matching the custom-system ethos.

## 5. Pages & Features

- **Dashboard:** server info (hostname, version, project), resource summary cards (instances by state, images, profiles, networks, storage), live CPU/disk/memory gauges, recent operations.
- **Instances:** list with multi-select row actions (start/stop/restart/freeze, delete), state badges, resource column; bulk actions via ConfirmDialog. Create wizard (container vs VM, image, profile, limits) via `POST /1.0/instances`.
- **Instance detail (tabbed):**
  - Overview: state, config summary, usage graphs.
  - Console: terminal via `POST /1.0/instances/{n}/exec` → operation WebSocket with xterm.js; VM console via `PUT /1.0/instances/{n}/console`.
  - Snapshots: list/create/restore/delete.
  - Config: full key/value editor with validation.
  - Logs: `GET /1.0/instances/{n}/logs/{file}`.
- **Infrastructure pages:**
  - Images: remote pull + local list + delete.
  - Profiles: list, form editor with YAML + key/value views.
  - Networks: list, create/edit.
  - Storage pools: list, pool volumes per pool.
  - Projects: list, create, set default.
- **Error handling:** per-page error states, toast on operation failure, empty states with call-to-action.

## 6. Testing

- **Unit (Vitest):** API client (fetch mocking), stores, event reducer, auth flow, utility helpers.
- **Component (Vitest + React Testing Library):** every primitive — render variants, interactions (sort, select rows, dialog open/close, tree expand), `data-testid` hooks.
- **Page-level:** light integration tests for the shell (tree renders from mocked client, task log updates on fake events, routing) with mocked API client.
- **No E2E in V1** — manual verification against local incusd via the dev proxy.
