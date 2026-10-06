# Contributing

## Commit messages and versions

Versions are year-month based: `YY.M.N`, for example `26.10.0`, then `26.10.1`
for the next release in the same month. The counter restarts at `.0` each month,
and nothing is zero padded (`26.9.0`, not `26.09.0`; semver tooling rejects
leading zeros). There is nothing to bump by hand.

Whether to release is decided from commit messages
([Conventional Commits](https://www.conventionalcommits.org/)). Every push to a
release branch is analysed; if it contains a releasable commit, the release job
updates `package.json` and `CHANGELOG.md`, tags the version, and publishes a
GitHub release with the zipped `dist/` build.

Format: `type(optional scope): short summary`

| Type | Meaning | Releases? |
| --- | --- | --- |
| `feat` | New feature | yes |
| `fix` | Bug fix | yes |
| `perf` | Performance improvement | yes |
| `feat!`, `fix!`, or a `BREAKING CHANGE:` footer | Incompatible change | yes, listed under "Breaking changes" |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | No user-visible change | no |

The type also groups the changelog entries (Breaking changes, Features, Bug fixes,
Performance).

Examples:

```
feat(palette): add Ctrl+K command palette
fix(terminal): keep tab colours readable in light mode
refactor!: rename the project settings route
```

Pull requests are checked with commitlint (`npx commitlint --from origin/main`).
When squash-merging, make sure the squashed commit message follows this format,
because that message is what the release job reads.

## Release branches

| Branch | Releases |
| --- | --- |
| `main` | Stable versions, e.g. `26.10.0` |
| `feat/ixui-ui` | Pre-releases, e.g. `26.10.1-beta.1` (marked as pre-release on GitHub) |

The release job commits `chore(release): x.y.z [skip ci]` back to the branch, so
the branch must allow pushes from GitHub Actions (or bypass for the bot).
The release logic lives in `scripts/release.mjs`; its version rules are unit tested
(`npx vitest run scripts`).

You can preview the next version without publishing from the Actions tab:
**Release → Run workflow** (dry run is on by default).

## Before you push

```
npm run typecheck && npm run lint && npm test
```
