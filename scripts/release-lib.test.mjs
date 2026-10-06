import { isReleasable, nextVersion, parseCommit, prependChangelog, renderNotes } from "./release-lib.mjs";

const oct = new Date(Date.UTC(2026, 9, 6));
const nov = new Date(Date.UTC(2026, 10, 1));
const releasable = (msg) => isReleasable(parseCommit("abcdef1234", msg));

describe("parseCommit / isReleasable", () => {
  it("releases on feat, fix, perf and breaking changes only", () => {
    expect(releasable("feat(palette): add palette")).toBe(true);
    expect(releasable("fix: crash")).toBe(true);
    expect(releasable("perf: faster")).toBe(true);
    expect(releasable("refactor!: rename route")).toBe(true);
    expect(releasable("fix: x\n\nBREAKING CHANGE: removes y")).toBe(true);
    expect(releasable("docs: typo")).toBe(false);
    expect(releasable("chore: deps")).toBe(false);
    expect(releasable("test(a11y): add checks")).toBe(false);
  });

  it("ignores non-conventional messages and its own release commits", () => {
    expect(parseCommit("a", "Add stepped dialogs")).toBeNull();
    expect(releasable("Add stepped dialogs")).toBe(false);
    expect(releasable("chore(release): v26.10.0 [skip ci]")).toBe(false);
  });

  it("extracts scope, subject and the breaking flag", () => {
    expect(parseCommit("h", "feat(api)!: drop v1")).toMatchObject({ type: "feat", scope: "api", subject: "drop v1", breaking: true });
  });
});

describe("nextVersion", () => {
  it("starts a month at .0 and counts releases within it", () => {
    expect(nextVersion({ tags: ["v0.1.0"], now: oct })).toBe("26.10.0");
    expect(nextVersion({ tags: ["v0.1.0", "v26.10.0"], now: oct })).toBe("26.10.1");
    expect(nextVersion({ tags: ["v26.10.0", "v26.10.1", "v26.10.2"], now: oct })).toBe("26.10.3");
  });

  it("ignores the old 0.x baseline tag and four-digit lookalikes", () => {
    expect(nextVersion({ tags: ["v0.1.0", "v2026.10.9"], now: oct })).toBe("26.10.0");
  });

  it("resets the counter in a new month and year", () => {
    expect(nextVersion({ tags: ["v26.10.4"], now: nov })).toBe("26.11.0");
    expect(nextVersion({ tags: ["v26.11.2"], now: new Date(Date.UTC(2027, 0, 5)) })).toBe("27.1.0");
  });

  it("uses a two-digit year and does not zero-pad the month (semver forbids leading zeros)", () => {
    expect(nextVersion({ tags: [], now: new Date(Date.UTC(2026, 8, 1)) })).toBe("26.9.0");
  });

  it("does not mistake 26.1.x for 26.10.x or 26.11.x", () => {
    expect(nextVersion({ tags: ["v26.1.5", "v26.11.5"], now: oct })).toBe("26.10.0");
  });

  it("numbers pre-releases against the next stable version", () => {
    expect(nextVersion({ tags: ["v26.10.0"], now: oct, prerelease: true })).toBe("26.10.1-beta.1");
    expect(nextVersion({ tags: ["v26.10.0", "v26.10.1-beta.1", "v26.10.1-beta.2"], now: oct, prerelease: true })).toBe("26.10.1-beta.3");
  });
});

describe("renderNotes / prependChangelog", () => {
  const commits = [
    parseCommit("1111111aaaa", "feat(palette): add palette"),
    parseCommit("2222222bbbb", "fix: stop crash"),
    parseCommit("3333333cccc", "feat(api)!: drop v1"),
  ];

  it("groups by type with breaking changes first and short hashes", () => {
    const notes = renderNotes("26.10.0", oct, commits);
    expect(notes).toContain("## 26.10.0 (2026-10-06)");
    expect(notes.indexOf("Breaking changes")).toBeLessThan(notes.indexOf("Features"));
    expect(notes).toContain("- **palette:** add palette (1111111)");
    expect(notes).toContain("- stop crash (2222222)");
    expect(notes).not.toContain("Performance");
  });

  it("puts the newest release on top of the changelog", () => {
    const first = prependChangelog("", "## 26.10.0\n\n- a\n");
    expect(first.startsWith("# Changelog\n\n## 26.10.0")).toBe(true);
    const second = prependChangelog(first, "## 26.10.1\n\n- b\n");
    expect(second.indexOf("26.10.1")).toBeLessThan(second.indexOf("26.10.0"));
    expect(second.match(/# Changelog/g)).toHaveLength(1);
  });
});
