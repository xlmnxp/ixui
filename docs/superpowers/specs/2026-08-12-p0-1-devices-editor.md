# P0-1: Instance Devices Editor + Expanded Config Provenance

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Add a Devices tab to instance detail (the richest single gap) and replace the flat config table with a provenance-aware layered view.

## Decisions

| Topic | Decision |
|---|---|
| Tab | New **Devices** tab in instance detail (`/instances/:name/devices`), beside Config |
| Editing | Devices table (Name / Type / Properties k-v) with add/edit/delete; properties edited inline (KeyValueEditor pattern); save via `instancesApi.update(name, { devices })` |
| Validation | `nictype` required for NICs, `pool`+`path` for disks, `source` for proxy; server-side errors surface via toast |
| Provenance | Config tab gains an "Effective config" toggle: table of `expanded_config` + `expanded_devices` with a source badge per key (`local` vs profile names) and an "override" affordance writing the key locally |
| Data | `instancesApi.get(name)` already returns `devices`; `expanded_config`/`expanded_devices` come from `?recursion=1`? — verify: fetch instance with `?expansion=true` (Incus supports `?expansion=true` on GET instance) |
| Types | `ExpandedInstance = Instance & { expanded_config?: Record<string, { value?: unknown; source?: string }>; expanded_devices?: Record<string, Record<string, { value?: unknown; source?: string }>> }` — pragmatic subset |

## Testing

- Devices tab: add/edit/remove rows, save calls update with devices, validation errors
- Provenance: toggle shows sources; override adds a local key and marks it
- API: GET instance with `?expansion=true` asserted
