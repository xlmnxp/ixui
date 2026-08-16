import { createStore } from "./store";
import { serverApi } from "../api";

/** Config-key → description map from GET /1.0/metadata/configuration (shared, fetched once). */
export const metadataStore = createStore<Record<string, string>>({});

/** Config-key → long description map (the detailed text behind the short hints). */
export const metadataLongStore = createStore<Record<string, string>>({});

/** Config-key → value type map ("string", "bool", "integer", …). */
export const metadataTypesStore = createStore<Record<string, string>>({});

/** Client-side fallbacks for keys the daemon does not document (e.g. image.*). */
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  "image.architecture": "CPU architecture of the image",
  "image.description": "Human-readable description of the image",
  "image.os": "Operating system name",
  "image.release": "Operating system release",
  "image.serial": "Image build serial (build date)",
  "image.variant": "Image variant (default, cloud, desktop, …)",
  "image.secureboot": "Whether the image supports secure boot (VMs)",
  "image.requirements.*": "Image requirement flag (e.g. nesting, secureboot)",
  // The daemon documents these with an underscore (volatile.cloud_init.*),
  // but the actual keys use a hyphen.
  "volatile.cloud-init.instance-id": "instance-id (UUID) exposed to cloud-init",
  "volatile.cloud-init.ready": "Whether cloud-init has finished running",
};

let started = false;

/** Collect every key description and type from the nested group/entity/keys shape.
    The keys listed inside each "keys" array are full config-key names. First definitions
    win because the same key is often repeated across storage drivers, and the earliest
    (instance-level) entries carry the real text. */
function collectKeys(
  node: unknown,
  descriptions: Record<string, string>,
  types: Record<string, string>,
  longs: Record<string, string>
): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, descriptions, types, longs);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.keys)) {
    for (const item of obj.keys) {
      if (typeof item !== "object" || item === null) continue;
      for (const [key, value] of Object.entries(item)) {
        const entry = value as { shortdesc?: string; longdesc?: string; type?: string } | null;
        if (entry?.shortdesc && !(key in descriptions)) descriptions[key] = entry.shortdesc;
        if (entry?.longdesc && !(key in longs)) longs[key] = entry.longdesc;
        if (entry?.type && !(key in types)) types[key] = entry.type;
      }
    }
  }
  for (const [, child] of Object.entries(obj)) collectKeys(child, descriptions, types, longs);
}

/** Matches placeholder patterns like "volatile.<name>.hwaddr" against a real key. */
function patternMatches(pattern: string, key: string): boolean {
  const p = pattern.split(".");
  const k = key.split(".");
  if (p.length !== k.length) return false;
  return p.every((seg, i) => (seg.startsWith("<") && seg.endsWith(">")) || seg === k[i]);
}

/** Look up a description, falling back to wildcard and placeholder entries. */
function lookup(map: Record<string, string>, key: string): string | undefined {
  if (map[key]) return map[key];
  const parts = key.split(".");
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(0, i).join(".") + ".*";
    if (map[candidate]) return map[candidate];
  }
  for (const pattern of Object.keys(map)) {
    if (pattern.includes("<") && patternMatches(pattern, key)) return map[pattern];
  }
  return undefined;
}

const TOKEN = /\{\{([a-z0-9_.-]+)\}\}/g;

/** Replace {{cross-reference}} tokens with the text of the referenced metadata entry. */
function resolveTokens(text: string, map: Record<string, string>, longs: Record<string, string>, depth = 0): string {
  if (!text.includes("{{") || depth > 4) return text;
  return text.replace(TOKEN, (_match, name: string) => {
    const refShort = map[name];
    if (refShort && refShort !== text) return resolveTokens(refShort, map, longs, depth + 1);
    const refLong = longs[name];
    if (refLong && refLong !== text) return resolveTokens(refLong, map, longs, depth + 1);
    return "";
  });
}

/**
 * Look up a description, falling back to wildcard and placeholder entries.
 * Cross-reference tokens like {{snapshot_expiry_format}} are resolved against the
 * metadata maps; when the referenced entry is missing (common), the key's own long
 * description is used instead, so hints never show raw {{tokens}}.
 */
export function configDescription(map: Record<string, string>, key: string, longMap?: Record<string, string>): string | undefined {
  const desc = lookup(map, key);
  if (!desc) return undefined;
  const resolved = resolveTokens(desc, map, longMap ?? {}).trim();
  if (resolved) return resolved;
  const long = longMap ? lookup(longMap, key) : undefined;
  if (!long) return undefined;
  const longResolved = resolveTokens(long, map, longMap ?? {}).trim();
  return longResolved || undefined;
}

export function loadMetadata(): void {
  if (started) return;
  started = true;
  try {
    void serverApi
      .metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        const types: Record<string, string> = {};
        const longs: Record<string, string> = {};
        collectKeys(m.configs, map, types, longs);
        metadataStore.setState({ ...FALLBACK_DESCRIPTIONS, ...map });
        metadataTypesStore.setState(types);
        metadataLongStore.setState(longs);
      })
      .catch(() => {
        // Metadata may be unavailable; descriptions just stay empty.
      });
  } catch {
    // serverApi.metadata may be absent in some environments; keep descriptions empty.
  }
}
