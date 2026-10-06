#!/usr/bin/env node
// Year-month releases (YY.M.N): decides whether to release from conventional commits since the
// last tag, bumps package.json, updates CHANGELOG.md, builds, tags, and publishes a
// GitHub release with the zipped dist/ output.
//
//   node scripts/release.mjs [--dry-run]
//
// Env: GITHUB_REF_NAME (branch; "main" releases stable, anything else a beta),
//      GH_TOKEN (for the gh CLI when publishing).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isReleasable, nextVersion, parseCommit, prependChangelog, renderNotes } from "./release-lib.mjs";

const dryRun = process.argv.includes("--dry-run");
// execFileSync returns null when stdio is inherited, so guard the trim.
const run = (cmd, args, opts = {}) => (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts }) ?? "").trim();
const git = (...args) => run("git", args);

const branch = process.env.GITHUB_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD");
const prerelease = branch !== "main";

let lastTag = "";
try {
  lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
} catch {
  // No tags yet: every commit counts.
}

const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
const raw = git("log", range, "--format=%H%x1f%B%x1e");
const commits = raw
  .split("\x1e")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [hash, message] = entry.split("\x1f");
    return parseCommit(hash, message ?? "");
  })
  .filter(Boolean);

const releasable = commits.filter(isReleasable);
console.log(`Branch ${branch}; last tag ${lastTag || "(none)"}; ${commits.length} conventional commit(s), ${releasable.length} releasable.`);
if (releasable.length === 0) {
  console.log("Nothing to release.");
  process.exit(0);
}

const now = new Date();
const version = nextVersion({ tags: git("tag", "--list", "v*").split("\n").filter(Boolean), now, prerelease });
const tag = `v${version}`;
const notes = renderNotes(version, now, releasable);

console.log(`\nNext version: ${version}${prerelease ? " (pre-release)" : ""}\n\n${notes}`);
if (dryRun) {
  console.log("Dry run: nothing was changed or published.");
  process.exit(0);
}

// The version must be in package.json before the build so it is baked into the bundle.
run("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"]);
const changelog = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : "";
writeFileSync("CHANGELOG.md", prependChangelog(changelog, notes));
run("npm", ["run", "build"], { stdio: "inherit" });

const asset = `ixui-${version}.zip`;
run("zip", ["-r", "-q", `../${asset}`, "."], { cwd: "dist" });
writeFileSync(`${asset}.sha256`, run("sha256sum", [asset]) + "\n");
writeFileSync("release-notes.md", notes);

git("add", "package.json", "package-lock.json", "CHANGELOG.md");
git("commit", "-m", `chore(release): ${tag} [skip ci]`);
git("tag", "-a", tag, "-m", tag);
git("push", "origin", `HEAD:${branch}`);
git("push", "origin", tag);

run("gh", [
  "release", "create", tag, asset, `${asset}.sha256`,
  "--title", tag, "--notes-file", "release-notes.md", "--verify-tag",
  ...(prerelease ? ["--prerelease"] : []),
], { stdio: "inherit" });
console.log(`Released ${tag}`);
