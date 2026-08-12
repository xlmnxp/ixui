# P0-2: Image Prefill Picker + Alias CRUD + Direct Create

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Replace the create wizard's local-images grid with a distro-grouped picker backed by the simplestreams live catalog (CORS-verified), a bundled offline fallback, direct-from-remote create, and alias CRUD on the Images page.

## Decisions

| Topic | Decision |
|---|---|
| Catalog | `fetchCatalog("https://images.linuxcontainers.org")` from `simplestreams.ts`; cache in memory + `localStorage` keyed by ETag |
| Fallback | Bundled curated list (Ubuntu 24.04/22.04, Debian 13/12, Alpine 3.22/3.21, Rocky 9/10, Alma 9/10, Fedora 42, CentOS 9-Stream, Arch, openSUSE 15.6, Kali, NixOS; default + cloud variants) — instant render, offline/air-gap |
| Picker UX | Wizard stage 2: search input; distro group → release → variant (default/cloud) → arch; VM products filtered by stage-1 type (qcow2/kvm vs container tarballs); shows size + build date; "cached" badge when a local fingerprint matches |
| Create | Direct: `instancesApi.create({ source: { type: "image", server, protocol: "simplestreams", alias } })` — no pre-pull; the existing Pull dialog stays for pre-seeding |
| Cloud-init smart | If user-data or SSH keys are set and variant is `default`, auto-switch to `cloud` with a toast |
| OCI tab | Second picker tab: image name against `docker.io` with `protocol: "oci"` |
| Aliases | Images page: alias list + create/delete (`infraApi`-adjacent or new `imagesApi.aliases` — implement via `client` on /images/aliases) |
| Custom remotes | Manageable list in localStorage, exportable; picker remote selector |

## Testing

- Picker: search filters, variant switch, type filter, cached badge, direct-create body uses alias+server+simplestreams
- Fallback list renders when catalog fetch fails
- Alias create/delete calls + refresh
