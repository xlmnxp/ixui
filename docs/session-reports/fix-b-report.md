# Fix-B Report — UI-layer roadmap findings

## Status

All 8 items complete. `npx vitest run && npm run typecheck && npm run lint` all green on the committed state (346 tests / 52 files pass, tsc clean, eslint clean).

Note: Fix-A (src/api) landed mid-session as commit `ca2a07c` (force-pushed over `a8689ac`). Their commit swept up my earlier working-tree edits to `src/api/client.ts` (401-only handler), `src/api/backups.ts` (base-qualified exportUrl), and the auth page/route/sidebar removal; those were re-applied and are present in the final tree. `authApi` was fully removed by Fix-A — my usage was removed with the auth page, no exports depended on it.

## Commits

- `2d2d0dd` fix: export blob download, stale tree after rename, usage scoping, 403 handling, auth page removal (17 files, +327/−44)
- (Fix-A, landed on branch: `ca2a07c` fix: correct api contracts)

## What changed

1. **Export blob download** — `backupsApi.exportUrl` now returns `/1.0/instances/{i}/backups/{b}/export?project=…`; `instance-detail.tsx` creates a unique `export-<timestamp>` backup, waits on the operation (`operationsApi.wait`), fetches the blob with `credentials: "include"`, and downloads via `URL.createObjectURL` + anchor click + revoke. Test rewritten to assert create/wait/fetch-URL/blob/click/revoke (URL.createObjectURL stubbed directly — jsdom lacks it).
2. **Stale tree** — `loadInstances(currentProjectStore.getState())` after rename (RenameInstanceDialog), move (MoveInstanceDialog + instance-detail `onMoved`).
3. **Project editor usage** — usage bars only for the active project (compared against `currentProjectStore`); otherwise "—" + "Usage shown for the active project" note; `limits.disk` bar dropped (input kept). Tests updated + new coverage (non-active dash/note, disk bar drop).
4. **Devices** — ConfirmDialog around device removal (cancel + confirm tests); empty-key/empty-value rows filtered before saving (dialog save and inline `updateProps`).
5. **403 vs logout** — `forbiddenHandler` triggers on 401 only (both `request` and `postRaw`); client test updated (403 throws ApiError, handler NOT called). Operations/Warnings/Settings/Certificates catch `ApiError.status === 403` and render a "Permission denied" EmptyState with `data-testid="permission-denied"` (test per page).
6. **Auth page removed** — `src/pages/auth.tsx` + `auth.test.tsx` deleted; route removed from `App.tsx`; `admin-auth` node and sidebar mapping removed; logout button (`auth-logout`) moved to the Certificates page header (kept, with click-through test).
7. **Clipboard** — try/catch around `navigator.clipboard.writeText` in certificates.
8. `src/lib/image-prefill.ts` untouched (offline degradation accepted). Operations/warnings column memoization untouched.

## Test summary

`npx vitest run` → 346 passed (52 files); `tsc --noEmit` and `eslint src --max-warnings 0` clean.

## Concerns

- Fix-A is force-pushing/amending shared history on this branch; one of their intermediate operations (`git restore`-style) silently wiped my earlier uncommitted edits. My changes were re-applied and are now committed, but coordination risk remains until they land their final commit.
- Fix-A's uncommitted `fix-a-report.md` is untracked in the tree (not committed by me).
