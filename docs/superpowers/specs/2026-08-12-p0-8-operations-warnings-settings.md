# P0-8: Operations + Warnings + Server Settings Pages

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Operational pages: a full operations list with cancel, a warnings page with acknowledge, and a server settings editor.

## Decisions

| Topic | Decision |
|---|---|
| Operations page | `/operations`: table (description, class, status, created, error text when failed) from `operationsApi.list()`; Cancel action when `may_cancel`; the task log remains the live bottom bar — the page is the persistent list |
| Warnings page | `/warnings`: table (message, severity badge, entity, first/last seen, status); Ack action (`warningsApi.ack`); severity color coding |
| Settings editor | `/settings`: key/value table of server config (`serverApi.info()` → `metadata.config` — GET /1.0 returns the config; save via PUT /1.0 with `{ config }` — add `ServerApi.updateConfig`); sensitive keys (core.*_token etc.) masked |
| Routes/sidebar | These three join an "Administration" node in the sidebar tree |
| Data | `warningsApi`, `operationsApi.list/cancel` (created in the API wave); `ServerApi.updateConfig` added here |

## Testing

- Operations table renders + cancel calls DELETE
- Warnings ack posts and updates row
- Settings editor loads config, masks sensitive keys, save PUTs { config }
