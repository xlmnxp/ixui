export interface ResourceUsage {
  usage: number;
  /** -1 when the resource has no limit. */
  limit: number;
}

/** Project resource usage keyed by config key, e.g. "limits.instances". */
export type ProjectUsage = Record<string, ResourceUsage>;

/** Resources whose values are byte counts. */
export const BYTE_RESOURCES = new Set(["limits.memory", "limits.disk"]);

/**
 * Convert the body of GET /1.0/projects/{name}/state into config-key form.
 * Incus reports `resources: { instances: { Limit, Usage } }`; per-pool disk
 * entries ("disk-pool") are ignored in favour of the project-wide "disk".
 */
export function parseProjectState(raw: unknown): ProjectUsage {
  const out: ProjectUsage = {};
  const resources = (raw as { resources?: Record<string, Record<string, unknown>> } | null)?.resources;
  if (!resources) return out;
  for (const [name, entry] of Object.entries(resources)) {
    if (name.startsWith("disk-")) continue;
    const usage = entry.Usage ?? entry.usage;
    const limit = entry.Limit ?? entry.limit;
    if (typeof usage === "number" && typeof limit === "number") out[`limits.${name}`] = { usage, limit };
  }
  return out;
}

/** Percent used (0-100), or null when there is no limit or no data. */
export function usagePercent(u: ResourceUsage | undefined): number | null {
  if (!u || u.limit <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((u.usage / u.limit) * 100)));
}

/** The most-utilised limited resource, for a one-glance summary. */
export function tightestResource(usage: ProjectUsage): { key: string; percent: number } | null {
  let best: { key: string; percent: number } | null = null;
  for (const [key, u] of Object.entries(usage)) {
    const percent = usagePercent(u);
    if (percent !== null && (best === null || percent > best.percent)) best = { key, percent };
  }
  return best;
}
