# Contributing

## Commit messages and versions

Versions are decided automatically from commit messages
([Conventional Commits](https://www.conventionalcommits.org/)). There is nothing
to bump by hand: every push to a release branch is analysed, and if it contains
a releasable commit, the release job updates `package.json` and `CHANGELOG.md`,
tags the version, and publishes a GitHub release with the zipped `dist/` build.

Format: `type(optional scope): short summary`

| Type | Meaning | Release |
| --- | --- | --- |
| `fix` | Bug fix | patch (0.1.0 → 0.1.1) |
| `perf` | Performance improvement | patch |
| `feat` | New feature | minor (0.1.0 → 0.2.0) |
| `feat!`, `fix!`, or a `BREAKING CHANGE:` footer | Incompatible change | major (0.1.0 → 1.0.0) |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` | No user-visible change | none |

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
| `main` | Stable versions, e.g. `0.2.0` |
| `feat/ixui-ui` | Pre-releases on the `beta` channel, e.g. `0.2.0-beta.1` |

The release job commits `chore(release): x.y.z [skip ci]` back to the branch, so
the branch must allow pushes from GitHub Actions (or bypass for the bot).

You can preview the next version without publishing from the Actions tab:
**Release → Run workflow** (dry run is on by default).

## Before you push

```
npm run typecheck && npm run lint && npm test
```
