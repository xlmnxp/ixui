# u8 Report — P0-2: Image Prefill Picker + Alias CRUD + Direct Create

**Branch:** feat/ixui-w2-u8
**Commit:** dc47086 — `feat: image prefill picker, direct remote create, and alias management`

## Status: Complete

All verification passes:

- `npx vitest run` — 300/300 tests pass (50 files), including 19 new prefill/picker tests
- `npm run typecheck` — clean
- `npm run lint` — clean (max-warnings 0)
- `npx vite build` — succeeds

## What was implemented

1. **`src/lib/image-prefill.ts`** (new)
   - `PREFILL_IMAGES`: curated offline fallback for Ubuntu 24.04/22.04, Debian 13/12, Alpine 3.22/3.21, Rocky 9/10, AlmaLinux 9/10, Fedora 42, CentOS 9-Stream, Arch, openSUSE 15.6, Kali, NixOS — each with default + cloud variants, amd64/arm64.
   - `SIMPLESTREAMS_PREFILL_ALIAS(entry, arch)` → e.g. `ubuntu/24.04/cloud/amd64`.
   - `loadCatalog(server)`: in-memory + localStorage cache of the live catalog (fallback → null when unavailable); `normalizeFingerprint`; `loadRemotes`/`saveRemotes` (localStorage custom remote list).

2. **`src/components/image-picker.tsx`** (new) — props `{ type, cloudInitEnabled, onSelect(alias | null) }`.
   - Distro tab: `picker-search` filter; distro-grouped rows (release · variant · arch) with size + build version when known; `picker-cached-*` badge when a local fingerprint matches product fingerprints (fingerprint passed in selection so create can use the local copy).
   - Auto-switches to `cloud` variant with a warning toast when `cloudInitEnabled` and a `default` row is picked (warns if no cloud variant exists).
   - OCI tab `picker-oci` + `oci-image` input → `{ server: "docker.io", protocol: "oci" }`.
   - `picker-remote` selector + manage dialog (add `picker-remote-add`/`picker-remote-save`, remove per-index).
   - Pull-from-remote expander retained (same testids: `wizard-pull-toggle/alias/server/submit`), refreshes cached badges.

3. **Wizard** (`create-instance-wizard.tsx`) — stage 2 replaced with the picker; stores `{ server, alias, protocol, fingerprint? }`; `create()` sends `source: { type: "image", server, protocol, alias }` for remote or `{ type: "image", fingerprint }` for cached-local; summary shows the alias (with `(cached local image)` suffix when local). `cloudInitEnabled` is derived from selected profiles carrying `cloud-init.*` config keys.

4. **Images page** (`images.tsx`) — `aliases-open` toggle, aliases table (name/target/description), create dialog (`alias-name`, `alias-target`, `alias-create-submit`), delete with confirm. Refresh-on-open.

5. **API** — `infra.ts`: `listAliases()` (GET /images/aliases?recursion=1), `createAlias()` (POST /images/aliases), `deleteAlias()` (DELETE /images/aliases/{name}); `types.ts`: `ImageAlias`; `instances.ts`: `InstanceImageSource` with `protocol`.

## Tests

New: `image-prefill.test.ts` (11), `image-picker.test.tsx` (8: search filters, fallback rendering, cloud-variant preference + warning, cached badge + local fingerprint, OCI, remote management). Updated: wizard tests (remote create body with server/protocol/alias, cached fingerprint create body, summary alias) and images tests (alias list/create/delete).

## Concerns / deviations

- **ETag revalidation not implemented:** `loadCatalog` caches in memory + localStorage, but conditional `If-None-Match` requests were skipped to avoid touching `simplestreams.ts` (shared "DONE" API; other wave-2 agents may edit it). Cache freshness relies on the background refresh-on-stale-cache path.
- **Fallback entries expose both types** (container/VM) since the offline list cannot know real item types; live catalog rows are filtered by `itemTypes` (squashfs/tar vs qcow2/disk-*).
- `onSelect` payload extends the spec's `{ server, alias, protocol }` with an optional `fingerprint` so the wizard can create from the local copy when the row is cached.
