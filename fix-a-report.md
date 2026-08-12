# fix-a: API-layer contract corrections

Branch: feat/ixui-roadmap · Commit: `ca2a07c` — "fix: correct api contracts (copy, move, iso, warnings, patch semantics, member resources)"

## Changes

1. **`instances.ts` `copy()`** (CRITICAL) — now `POST /1.0/instances?project=<current>` with body `{ name: target, source: { type: "copy", source, project? }, live?, pool? }`. No longer posts to `/instances/{name}` (that was rename). A source project, if passed, goes inside `source.project`.
2. **`instances.ts` `move()`** (CRITICAL) — cluster target moved to the query: `POST /instances/{name}?project=…&target=<member>`; body is `{ migration: true, live?, pool?, project? }` (target removed from body).
3. **`volumes.ts` `uploadIso()`** (CRITICAL) — `POST /1.0/storage-pools/{pool}/volumes?project=<p>` with `Content-Type: application/octet-stream`, `X-Incus-type: iso`, `X-Incus-name: <name>`, body = file bytes. `ApiClient.postRaw` now takes `headers?: Record<string, string>` (defaults to octet-stream).
4. **`warnings.ts` `ack()`** (CRITICAL) — body is `{ status: "acknowledged" }`.
5. **`auth.ts` deleted** — no `/1.0/auth/*` routes exist in incusd; module, index.ts singleton, and endpoint tests removed. The auth page/route/sidebar link were removed as well (required to keep the build green once the module was gone; Fix-B's page removal is now a no-op).
6. **`getExpanded()` removed** — `?expansion=true` isn't an incusd param. The instance config tab now computes the "effective" table client-side from `instancesApi.get()` (provenance shown as local; Fix-B may rework further).
7. **PATCH semantics** — `ApiClient.patch()` added; `cluster.ts updateGroup` and `network-extras.ts updateAcl` now PATCH partial bodies (PUT stripped membership).
8. **`files.ts`** — `projectQuery()` added to get/put/remove paths (`…?project=…&path=…`); `put()` goes through `client.postRaw(path + projectQuery(), body, { "Content-Type": "text/plain" })` so it gets the forbidden handler + `markAuthenticated`.
9. **`backups.ts` `list()`** — project-scoped like `instances.listBackups`. `create()` body key corrected to `compression_algorithm`.
10. **Member resources** — single method `ResourcesApi.getMemberResources(member)` → `GET /1.0/resources?target=<member>`; duplicate removed from `cluster.ts`. `ResourcesApi.get()` is now `GET /1.0/resources` (no project/recursion params — only `target` is valid).
11. **`ClusterGroup.nodes` → `members`** in types.ts, plus cluster-groups page/tests.
12. **Minor** — volume `restoreSnapshot` → `PUT /storage-pools/{pool}/volumes/{type}/{name}` with `{ restore: "snapname" }`; `stateful` dropped from volume `createSnapshot`; duplicate `StorageVolumeDetail` removed (types.ts is canonical).

All endpoint tests were re-verified against the corrected contracts (copy URL/body, move query, iso URL/headers, ack body, PATCH methods, files project query, member resources target, backups list scoping, group members key).

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean (max-warnings 0)
- `npx vitest run` — 52 files, 346 tests, all green

## Concerns

- **Concurrent agent interference**: another agent shares this worktree and its file operations twice reverted my in-progress edits mid-task (all changes were re-applied; a reverted `exportUrl` change from that agent landed in my commit via a broad `git add` — it matches the contract their UI expects: `/1.0/instances/…/export?project=…`). Recommend the coordinator warn agents against `git checkout/restore` while others have uncommitted work in the shared worktree.
- **Auth page removed here** (route, sidebar link, page files) — Fix-B's planned auth removal is redundant; expect a no-op/conflict there.
- **Instance config provenance** is now a client-side shim (source always "local"); Fix-B's rework should replace it.
