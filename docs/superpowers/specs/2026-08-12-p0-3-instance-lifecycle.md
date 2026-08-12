# P0-3: Instance Copy / Rename / Move / Export + Bulk Actions

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Instance lifecycle actions beyond start/stop: copy, rename, move (incl. live and cross-project/pool/member), export/import backups, and bulk start/stop/delete on the instances table.

## Decisions

| Topic | Decision |
|---|---|
| Entry | "⋯ More" menu in the instance detail bar (rename, copy, move, export) + row actions on the table (copy) |
| Rename | Dialog (name validation: 1–63 alnum+hyphen, no leading digit/hyphen, no trailing hyphen) → `instancesApi.rename` → navigate to new name |
| Copy | Dialog: new name, live? checkbox, pool picker (default current) → `instancesApi.copy` |
| Move | Dialog: project select + member select + live checkbox → `instancesApi.move` (POST with migration) |
| Export | `backupsApi.create(name, "export")` then download via `backupsApi.exportUrl` (window.open); import: file picker → upload to `/1.0/instances` from backup (via `filesApi`-style raw POST with `source: { type: "backup", file }`) |
| Bulk actions | Instances table already has selection: add bulk Start/Stop/Delete (already has Delete) — Start/Stop buttons disabled without selection, fan out via `instancesApi.setState` |
| Validation | Shared name validator in `src/lib/instance-name.ts` (`validateInstanceName`) used by wizard, rename, copy |

## Testing

- Rename dialog validation + call + navigation
- Copy dialog body (live, pool, name)
- Move body (project/member/live)
- Export URL + backup create
- Bulk start/stop calls fan out for selected
