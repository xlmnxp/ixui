# P0-9: Cluster Operations — Groups, Evacuate/Restore, Join Tokens, Capacity

**Date:** 2026-08-12
**Status:** Approved for implementation

## Overview

Cluster administration: cluster groups CRUD, member evacuate/restore (maintenance mode), member join tokens for onboarding, and per-member capacity from /resources.

## Decisions

| Topic | Decision |
|---|---|
| Member bar actions | Member view bar gains: **Evacuate** (danger, ConfirmDialog) / **Restore** (when evacuated) via `clusterApi.setMemberState`; **Join token** (dialog: server name + groups → `clusterApi.createJoinToken` → token copy); capacity shown on the Overview tab: `resourcesApi.getMemberResources` → CPU/RAM/disk cards or a KeyValueTable |
| Cluster groups | New `/cluster/groups` page (or a tab on the members area): table + create/edit/delete via `clusterApi.listGroups/createGroup/deleteGroup` |
| Tree | The cluster member tree nodes show an evacuation badge when a member's status is not Online |
| Routes/sidebar | Cluster groups page joins the Administration node; member actions live in the existing member view |

## Testing

- Evacuate confirm → setMemberState("evacuate"); Restore when needed
- Join token dialog posts and shows the token
- Groups CRUD flows
- Capacity table renders from resources mock; member tree badge for non-Online
