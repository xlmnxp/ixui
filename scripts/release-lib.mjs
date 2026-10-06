// Pure helpers for the release script; kept free of I/O so they can be unit tested.

const STABLE_TAG = /^v(\d{2})\.(\d{1,2})\.(\d+)$/;
const BETA_TAG = /^v(\d{2}\.\d{1,2}\.\d+)-beta\.(\d+)$/;
const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;

export const SECTIONS = [
  ["breaking", "Breaking changes"],
  ["feat", "Features"],
  ["fix", "Bug fixes"],
  ["perf", "Performance"],
];

/** Parse "type(scope)!: subject" plus body into a commit record, or null for non-conventional messages. */
export function parseCommit(hash, message) {
  const [header = "", ...rest] = message.trim().split("\n");
  const m = HEADER.exec(header);
  if (!m) return null;
  const body = rest.join("\n");
  return {
    hash,
    type: m[1].toLowerCase(),
    scope: m[2] || "",
    subject: m[4],
    breaking: Boolean(m[3]) || /^BREAKING[ -]CHANGE:/m.test(body),
  };
}

/** feat, fix, perf and anything marked breaking trigger a release; docs/chore/test/etc. don't. */
export function isReleasable(commit) {
  if (!commit || (commit.type === "chore" && commit.scope === "release")) return false;
  return commit.breaking || ["feat", "fix", "perf"].includes(commit.type);
}

/**
 * Year-month version: YY.M.N (two-digit year) where N counts releases within the month (from 0),
 * e.g. 26.10.0 then 26.10.1. Nothing is zero padded because semver forbids leading zeros.
 * Pre-releases append -beta.N to the version the next stable release would have.
 */
export function nextVersion({ tags, now, prerelease = false }) {
  const year = now.getUTCFullYear() % 100;
  const month = now.getUTCMonth() + 1;
  let maxPatch = -1;
  for (const tag of tags) {
    const m = STABLE_TAG.exec(tag);
    if (m && Number(m[1]) === year && Number(m[2]) === month) maxPatch = Math.max(maxPatch, Number(m[3]));
  }
  const base = `${year}.${month}.${maxPatch + 1}`;
  if (!prerelease) return base;
  let maxBeta = 0;
  for (const tag of tags) {
    const m = BETA_TAG.exec(tag);
    if (m && m[1] === base) maxBeta = Math.max(maxBeta, Number(m[2]));
  }
  return `${base}-beta.${maxBeta + 1}`;
}

export function renderNotes(version, date, commits) {
  const lines = [`## ${version} (${date.toISOString().slice(0, 10)})`, ""];
  for (const [key, title] of SECTIONS) {
    const items = commits.filter((c) => (key === "breaking" ? c.breaking : !c.breaking && c.type === key));
    if (items.length === 0) continue;
    lines.push(`### ${title}`, "");
    for (const c of items) {
      lines.push(`- ${c.scope ? `**${c.scope}:** ` : ""}${c.subject} (${c.hash.slice(0, 7)})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Insert a release's notes at the top of an existing changelog (creating the header if needed). */
export function prependChangelog(existing, notes) {
  const header = "# Changelog\n\n";
  const body = existing.startsWith(header) ? existing.slice(header.length) : existing;
  return `${header}${notes}\n${body}`.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}
