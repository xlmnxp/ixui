# P0-4: Project Config Editor + Quota Bars

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Full project editor: `features.*`, `limits.*` quotas with usage-vs-quota bars, and `restricted.*` toggles explained in plain language.

## Decisions

| Topic | Decision |
|---|---|
| Entry | Projects page: edit action opens the editor (dialog or page) |
| Layout | Sections: Features (checkboxes: images/networks/profiles/volumes isolation), Limits (key/value quota inputs with usage bars where computable: count instances/networks/volumes per project), Restricted (toggles with plain-language explanations) |
| Usage bars | Computed client-side from current project resource lists (instances/networks/volumes counts) vs `limits.*` values |
| Save | `infraApi.updateProject(name, { config })`; key descriptions via `/1.0/metadata` where present |
| Keys | `features.images/networks/profiles/storage.volumes`, `limits.cpu/memory/disk/instances/containers/virtual-machines/networks/processes`, `restricted.*` curated set with labels |
| Type | `PROJECT_KEY_META: Record<string, { label: string; type: "checkbox" | "number" | "text"; description: string }>` in the page module |

## Testing

- Sections render per meta; toggles flip config keys; save posts config
- Usage bar computes percent and clamps
- Restricted toggles show plain-language descriptions
