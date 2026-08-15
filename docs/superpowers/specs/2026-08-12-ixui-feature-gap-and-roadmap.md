# ixui Feature Gap Analysis & Enterprise Roadmap

**Date:** 2026-08-12 (updated 2026-08-16)
**Status:** P0 shipped — P1/P2 proposed

## Current status (2026-08-16 update)

The entire P0 block (section 7) is implemented and merged on `feat/ixui-roadmap`:

| P0 | Item | Status |
|---|---|---|
| 1 | Instance devices editor + expanded-config provenance | ✅ `src/pages/instance/devices.tsx` |
| 2 | Image prefill picker + alias CRUD + direct create (incl. OCI tab) | ✅ `src/components/image-picker.tsx`, `src/lib/image-prefill.ts` |
| 3 | Instance copy / rename / move / export + bulk actions | ✅ `src/components/instance-dialogs.tsx` |
| 4 | Project config editor + quota bars | ✅ `src/components/project-editor.tsx` |
| 5 | RBAC identities/groups/permissions + trust tokens + logout | ✅ `src/pages/certificates.tsx` (auth module removed — incusd has no `/1.0/auth/*` routes) |
| 6 | Storage volumes CRUD + snapshots + attach + ISO import | ✅ `src/pages/storage.tsx` |
| 7 | Network config editor + DHCP leases + forwards | ✅ `src/pages/networks.tsx` |
| 8 | Operations + warnings + server settings pages | ✅ `src/pages/{operations,warnings,settings}.tsx` |
| 9 | Cluster groups, evacuate/restore, join tokens, capacity | ✅ `src/pages/cluster-groups.tsx` |

Some P1 items also landed early: freeze/unfreeze buttons, live-migration
checkbox, OCI picker tab, network forwards + leases, logout.

The gaps table in section 2 was written before P0 implementation; treat the
✅ items above as the source of truth.

**Audit/activity trail (enterprise §4.3) landed 2026-08-16:** lifecycle events
from the existing websocket are persisted into a localStorage ring buffer
(500 entries, `ixui.activity.v1`) via `src/state/activity.ts`; a global
Activity page (`src/pages/activity.tsx`, route `/activity`, sidebar
"Administration → Activity") and a per-instance Activity tab
(`src/pages/instance/activity.tsx`) surface time/action/instance/project/
user/address with filtering and clearing.

**Instance file browser landed 2026-08-16:** a Files tab
(`src/pages/instance/files.tsx`) over the expanded `FilesApi`
(`src/api/files.ts`: read/put/create/mkdir/remove/downloadUrl, PUT for
overwrite, POST with `X-Incus-Type`/`X-Incus-Name` for creation) with
breadcrumb-style navigation, edit-in-dialog, download, upload, new-file and
new-folder actions.

Remaining P1 work: snapshot schedules, network ACLs/zones/address-sets UI
(API module `src/api/network-extras.ts` exists), storage buckets UI (API in
`src/api/volumes.ts`), per-instance metrics history, cloud-init status
surfacing, VM console log, Prometheus kit.

## Overview

Deep-research comparison of ixui against the Incus 7.0 LTS API surface, the
Canonical LXD UI (and its Incus rebrand `zabbly/incus-ui-canonical`, which ships
as the de-facto official Incus web UI), VMware vSphere Client, and OpenStack
Horizon. Goal: identify everything missing to (a) cover the full Incus feature
set and (b) make ixui sellable to medium/large organizations. Includes a
concrete design for image prefill in the create wizard and UX improvements
across create → edit → view.

Baseline: Incus 7.0 LTS (released 2026-05-05, supported to June 2031). The
current daemon adds OCI/Docker-Hub containers, a built-in S3 listener, an NBD
backup API, network address sets, placement-scriptlet rebalancing, and
dependent storage volumes — none of which any UI fully covers yet, which is a
differentiation opportunity.

## 1. What ixui implements today (code inventory)

| Area | Implemented |
|---|---|
| Auth | Browser TLS client cert (implicit), OIDC redirect login. No logout, no trust-token flow, no session view |
| Instances | List, create (4-stage wizard), start/stop/restart, delete, config key/value editor (with `/1.0/metadata` descriptions), snapshots (create/stateful/restore/delete), logs (list/read), terminal popup (exec shell + VGA console for VMs), state (CPU/mem/IPs) |
| Images | Local list, single/bulk delete, pull by typed alias from a typed server URL |
| Profiles | List, create/edit (config only — **devices not editable**), delete |
| Networks | List, create (name/type/description only), edit description only, delete |
| Storage | Pool list/create (name/driver/description)/delete; volume list/delete only |
| Projects | List, create (name/description), delete, switcher dropdown |
| Cluster | Member list, member view (overview + instances tab), tree sidebar with per-member create |
| Ops/events | Events websocket → task log + realtime refresh; operation wait |
| Shell | ESXi-style tree + vertical tabs, project overview hosting tab action bars, component gallery |

Everything else in the sections below is missing or partial.

## 2. Gap vs the Incus API (full coverage matrix)

### 2.1 Instances — the biggest gap block

| Feature | API | Status in ixui |
|---|---|---|
| Device editing (disks, NICs, proxy, GPU, USB, PCI, TPM, shared paths) | `PUT /instances/{name}` `devices` | **Missing** — update() sends config/description only; devices are set once at create (eth0) and never editable |
| Copy / clone | `POST /instances` `source:{type:copy}` | Missing |
| Rename | `POST /instances/{name}` | Missing |
| Move between pools/projects/members (migration incl. live) | `POST /instances/{name}` (`migration`, `live`, `pool`, `project`, `target`) | Missing |
| Export / import (backups) | `/instances/{name}/backups`, `POST /instances` from backup | Missing |
| File browser (pull/push/edit/delete files) | `/instances/{name}/files` + SFTP endpoint | Missing (LXD UI shipped a file explorer in 0.22) |
| Rebuild (reinstall image, keep config) | `POST /instances/{name}/rebuild` | Missing |
| Freeze / unfreeze in UI | `PUT /instances/{name}/state` | API supports it; no button anywhere |
| Console log (VM boot output) | `GET /instances/{name}/console` | Missing |
| Attach ISO / boot media | custom volume + `boot.priority` | Missing |
| Cloud-init (user-data, vendor-data, network-config) + status | config keys + agent | Missing — no editor, no `cloud-init status` surfacing |
| Snapshot scheduling & expiry | `snapshots.schedule`, `snapshots.expiry` | Missing (manual snapshots only) |
| Bulk operations (start/stop/delete N selected) | n/a (client-side fanout) | Missing on instances table (images/profiles have bulk delete) |
| Effective config view | `expanded_config` / `expanded_devices` | Missing — user can't see what profiles contribute |
| OCI app containers (Docker Hub) | `source.protocol: oci` (Incus 6.5+/7.0) | Missing |
| Per-instance metrics/graphs | `/1.0/instances/{name}/state` polling, `/1.0/metrics` | Partial — one-shot numbers on overview, no history/sparklines |

### 2.2 Images

- No remote catalog browser (see §5 — the prefill design).
- No alias management (`/1.0/images/aliases`), no edit (public flag, expiry,
  auto-update), no export/download, no upload of a local tarball/qcow2, no
  copy-to-project, no showing which instances were created from an image.

### 2.3 Networking

- Network config editor missing (`bridge.*`, `ipv4/ipv6.*`, MTU…) — only the
  description is editable today.
- Missing entirely: network **state/leases** (DHCP leases table), **ACLs**,
  **forwards**, **load balancers**, **peers** (OVN), **zones** (DNS),
  **integrations**, physical/OVN network creation flows, and Incus 7.0
  **address sets**.

### 2.4 Storage

- Volume create/edit/resize/rename missing; volume **snapshots** missing;
  attach custom volume to instance missing (critical for VM data disks).
- Pool config editing missing (per-member config in clusters).
- **Buckets** (S3, now first-class in 7.0 with the built-in listener) missing.
- ISO import (for VM installs) missing.

### 2.5 Projects, cluster, server, auth — the enterprise block

| Feature | API | Notes |
|---|---|---|
| Project config editor | `PUT /projects/{name}` | `features.*` (isolate images/networks/profiles/volumes), `limits.*` (quotas), `restricted.*` — the whole multi-tenancy story; ixui can only create name+description |
| Fine-grained RBAC UI | `/1.0/auth/identities`, `/1.0/auth/groups`, `/1.0/auth/identity-provider-groups`, permissions | Incus has built-in fine-grained authz since 6.x; LXD UI ships a Permissions section. Nothing in ixui |
| Certificates / trust store | `/1.0/certificates`, token flow | No UI to add clients or issue join/trust tokens — today onboarding requires the CLI |
| Server settings editor | `PUT /1.0` | Missing (LXD UI has a Settings page) |
| Warnings | `/1.0/warnings` | Missing |
| Operations page | `/1.0/operations` | Missing — task log exists but no full list, no cancel |
| Cluster groups | `/1.0/cluster/groups` | Missing |
| Evacuate / restore member (maintenance mode) | `POST /cluster/members/{name}/state` | Missing — this is vSphere "enter maintenance mode", table stakes for cluster ops |
| Join tokens / add member | `POST /cluster/members` | Missing |
| Server resources / capacity | `/1.0/resources`, per-member | Missing — no CPU/RAM/disk/GPU inventory anywhere |
| Prometheus metrics | `/1.0/metrics` | Missing |
| Placement rules / scriptlets, cluster rebalancing | 7.0 | Missing |

## 3. Competitive comparison

### 3.1 vs LXD UI / incus-ui-canonical (direct competitor)

Features it has that ixui lacks (from 2025–2026 releases): remote image catalog
with search on create, ISO upload, instance file explorer, form↔YAML toggle
with CodeMirror on every entity, full profile/device editing, network ACL +
forwards + load-balancer UIs, storage volume CRUD + snapshots + attach, project
config/limits editor, Permissions section (identities, groups, OIDC-linked
IdP groups), operations + warnings pages, cluster groups & evacuate, server
settings editor, instance rename/copy/migrate/export, bulk instance actions,
upload instance from file.

Where ixui is already ahead: cluster-member tree with per-member create, tab
actions lifted into one bar, popup terminal windows, tighter table-first
design, no vendor UI-kit dependency, project overview layout.

### 3.2 vs VMware vSphere Client (what a VMware-refugee buyer expects)

Missing equivalents: maintenance mode (= evacuate), vMotion UX (= live
migrate with target picker), templates & clone-from-template (= image publish
from instance + copy), performance charts with history, events/alarms/audit
trail (Incus lifecycle events are there — nothing persists or displays them),
roles & permissions admin, host capacity dashboards, content library (= image
catalog + custom remotes), OVF import (= instance import/migration tooling),
scheduled tasks (= snapshot schedules), tags/custom attributes (=
`user.*` config keys surfaced as first-class labels), resource pools (=
projects with limits — needs the editor).

### 3.3 vs OpenStack Horizon

Missing equivalents: per-project quota admin (= `limits.*` editor), flavors (=
instance-type presets — Incus supports `instance_type: t2.micro`-style; a
curated "size" picker (S/M/L/XL) in the wizard maps cleanly), key pairs (= SSH
key injection via cloud-init), security groups (= network ACLs UI), floating
IP/port views (= network forwards + leases), usage summaries per project,
admin-vs-member view separation driven by RBAC.

## 4. Enterprise-readiness requirements (to sell to medium/large orgs)

Priority-ordered; the first block is what procurement/security teams ask for
in the first meeting:

1. **RBAC UI** on Incus fine-grained auth: identities list, groups CRUD,
   permission assignment per project/entity, IdP-group → Incus-group mapping
   for OIDC SSO. UI must also degrade gracefully (hide what the caller can't
   do based on `access_entitlements`).
2. **Multi-tenancy hardening**: full project editor — `features.*`,
   `limits.*` quotas with usage-vs-quota bars, `restricted.*` toggles
   explained in plain language.
3. **Audit trail**: persist lifecycle events (who did what, when, from where)
   into a searchable Activity page; per-instance activity tab. Incus emits
   `lifecycle` events with `requestor` — currently discarded by ixui.
4. **Onboarding without CLI**: certificate trust-token issuance flow in the
   UI (create token → QR/copy → pending joins), OIDC session management,
   logout.
5. **Observability**: capacity dashboard per member (from `/1.0/resources` +
   instance usage), Prometheus `/1.0/metrics` scrape docs + Grafana dashboard
   shipped in-repo, per-instance historical sparklines.
6. **Cluster operations**: evacuate/restore with progress, cluster groups,
   join-token member add, per-member health from events + warnings surfaced
   as a notification bell.
7. **Backup/DR story**: instance export/import UI, snapshot schedules,
   volume snapshots, and (differentiator) surface the 7.0 NBD backup API and
   dependent volumes for third-party backup vendors.
8. **Air-gap support**: custom image remotes (internal simplestreams mirror),
   no hard dependency on external hosts (prefill list bundled, live catalog
   optional).
9. **Operational polish**: operations page with cancel, warnings page, server
   settings editor, error surfaces that include the operation error text.
10. **Product hygiene**: versioned releases + packaging for `/opt/incus/ui`
    (deb/rpm and tarball), browser support matrix, a11y pass (keyboard nav,
    focus, contrast), security posture (CSP, no third-party requests by
    default), admin docs.

## 5. Images prefill — design

**Verified:** `https://images.linuxcontainers.org/streams/v1/index.json` is
served with `access-control-allow-origin: *` (checked 2026-08-12), so the
browser can fetch the full simplestreams catalog directly. No proxy needed.

### Decisions

| Topic | Decision |
|---|---|
| Default remote | `images.linuxcontainers.org` (simplestreams) — containers + VMs, all major distros |
| Live catalog | Fetch `streams/v1/index.json` → `streams/v1/images.json` client-side; cache in memory + `localStorage` keyed by ETag (the server sends one) |
| Bundled fallback | Ship a curated static list (see below) so the picker works offline/air-gapped and renders instantly while the live catalog loads |
| Curated prefill | Ubuntu 24.04/22.04, Debian 13/12, Alpine 3.22/3.21, Rocky 9/10, AlmaLinux 9/10, Fedora 42, CentOS 9-Stream, Arch, openSUSE 15.6, Kali, NixOS — each with `default` and `cloud` variants |
| Picker UX | Distro-grouped searchable list: OS (with logo) → release → variant (`default`/`cloud`/`desktop`) → arch. Type filter follows wizard stage-1 choice (VM products = have `disk.qcow2`/`disk-kvm.img` items; containers = `incus.tar.xz` + squashfs). Show image size + build date. Badge "cached" when a local image fingerprint matches |
| No pre-pull step | Create directly with `source: { type: "image", server, protocol: "simplestreams", alias }` — the daemon downloads on demand; wizard shows the download via the existing operation websocket progress. Keep the manual "Pull image" dialog for pre-seeding only |
| Variant smarts | Auto-prefer the `cloud` variant when the user adds cloud-init content or SSH keys (cloud-init requires it); warn if they pick `default` with cloud-init set |
| OCI registries | Second tab in the picker: type `nginx:latest` etc. against `docker.io` with `protocol: oci` (Incus 7.0 app containers) |
| Custom remotes | Manageable remotes list (add/remove simplestreams or incus servers) persisted in `localStorage`, exportable; enables internal mirrors for air-gapped orgs |
| Aliases | Image page gains alias CRUD (`/1.0/images/aliases`) so pulled images stay addressable |

## 6. UX improvements: create → edit → view

### Create wizard

- **Image-first flow with prefill** (§5) replacing the local-images-only grid.
- **Name autogeneration** (`ubuntu-01`-style, editable) + real Incus name
  validation (1–63 chars, alnum+hyphen, no leading digit/hyphen, no trailing
  hyphen) with inline errors — the current `^[a-zA-Z0-9-]+$` accepts invalid
  names.
- **Size presets** (S/M/L/XL → `limits.cpu`/`limits.memory`) alongside free
  text; root-disk size and storage-pool pickers (currently absent — root disk
  is silently profile-default).
- **Network picker from managed networks** with the profile's NIC shown as
  default; SSH-key injection and a cloud-init user-data editor (YAML-checked)
  behind an "Advanced" disclosure.
- **Form ↔ YAML toggle** showing the exact request body before create; "Create
  another" checkbox; create-and-start default-on with a toggle.
- **Member capacity hints** next to the target-member picker (from
  `/1.0/resources`).

### Edit

- **Devices editor** (disks, NICs, proxy ports, GPU, shared folders) as a new
  instance tab — richest single gap vs every competitor.
- **Layered config view**: show `expanded_config` with per-key provenance
  (which profile, or local) and an override affordance, instead of the flat
  local-config table.
- **YAML editor with diff-before-save** for instance/profile/network/project;
  rename/copy/move actions in the instance bar behind a "⋯ More" menu.
- **Profile editing parity**: devices + YAML, plus "used by" lists.

### View

- **Live sparklines** (CPU/mem/disk/net) on the instance overview from state
  polling, with a details drawer per NIC/disk.
- **Snapshot timeline** + schedule editor (`snapshots.schedule` cron +
  expiry) on the Snapshots tab.
- **Activity tab** per instance from persisted lifecycle events (requestor,
  action, time).
- **File browser tab**; **console-log viewer** for VMs.
- **Instances table**: bulk start/stop/delete, status filter chips, saved
  filters, column chooser, IP column with copy, freeze action where valid.
- **Global**: command palette (Ctrl/⌘-K: jump to instance, run action),
  notification bell fed by warnings + failed operations, breadcrumb deep
  links, empty states that link to the exact create flow.

## 7. Implementation roadmap (full Incus coverage)

### P0 — sellability blockers ✅ DONE (2026-08)

1. Instance devices editor + expanded-config provenance view
2. Image prefill picker + direct-from-remote create (§5) + alias CRUD
3. Instance copy/rename/move/export-import; bulk actions on the table
4. Project config editor (features/limits/restrictions) with quota-usage bars
5. RBAC: identities/groups/permissions pages + trust-token onboarding + logout
6. Storage volumes CRUD + snapshots + attach-to-instance; ISO import
7. Network config editor + DHCP leases; forwards
8. Operations page (list/cancel) + warnings page + server settings editor
9. Cluster evacuate/restore, groups, join tokens; member resources/capacity

### P1 — competitive parity+ (next up)

Instance file browser; snapshot schedules; cloud-init editor + agent status;
console log; VM live-migration UX; network ACLs, zones, peers, load
balancers; storage buckets (S3); Prometheus/Grafana kit; activity/audit page;
OCI image tab; freeze/unfreeze; per-instance metrics history.

### P2 — differentiators

Placement rules + cluster rebalancing UI (7.0 scriptlets); network address
sets; NBD backup integration surface; dependent-volumes awareness in
migration flows; capacity planning ("what fits where"); instance-type
(flavor) presets admin; multi-remote single pane (manage several Incus
clusters from one ixui).

### API client work implied

New modules: `auth.ts` (identities/groups/permissions), `certificates.ts`,
`backups.ts`, `files.ts` (SFTP-over-websocket or files endpoint),
`network-extras.ts` (acls/forwards/zones/peers/lbs/address-sets),
`volumes.ts` (full CRUD + snapshots + buckets), `resources.ts`, `warnings.ts`,
`operations.ts` (list/cancel), plus `simplestreams.ts` (browser-side catalog,
no daemon involvement). Extend `instances.ts` with post-rename/copy/move,
rebuild, backups, files; extend `infra.ts` volumes/pool config; extend
`cluster.ts` with groups/state/tokens.

## Sources

- Incus 7.0 LTS release notes — https://discuss.linuxcontainers.org/t/incus-7-0-lts-has-been-released/26641
- Incus REST API docs — https://linuxcontainers.org/incus/docs/main/rest-api/
- LXD UI repo & releases — https://github.com/canonical/lxd-ui / https://github.com/canonical/lxd-ui/releases
- Incus rebrand of LXD UI — https://github.com/zabbly/incus-ui-canonical
- Canonical LXD UI announcement — https://ubuntu.com/blog/lxd_ui
- Simplestreams catalog (CORS verified 2026-08-12) — https://images.linuxcontainers.org/streams/v1/index.json
