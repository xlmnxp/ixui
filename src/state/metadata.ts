import { createStore } from "./store";
import { serverApi } from "../api";

/** Config-key → description map from GET /1.0/metadata/configuration (shared, fetched once). */
export const metadataStore = createStore<Record<string, string>>({});

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
    The keys listed inside each "keys" array are full config-key names. */
function collectKeys(node: unknown, descriptions: Record<string, string>, types: Record<string, string>): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, descriptions, types);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.keys)) {
    for (const item of obj.keys) {
      if (typeof item !== "object" || item === null) continue;
      for (const [key, value] of Object.entries(item)) {
        const entry = value as { shortdesc?: string; type?: string } | null;
        if (entry?.shortdesc) descriptions[key] = entry.shortdesc;
        if (entry?.type) types[key] = entry.type;
      }
    }
  }
  for (const [, child] of Object.entries(obj)) collectKeys(child, descriptions, types);
}

/** Matches placeholder patterns like "volatile.<name>.hwaddr" against a real key. */
function patternMatches(pattern: string, key: string): boolean {
  const p = pattern.split(".");
  const k = key.split(".");
  if (p.length !== k.length) return false;
  return p.every((seg, i) => (seg.startsWith("<") && seg.endsWith(">")) || seg === k[i]);
}

/** Look up a description, falling back to wildcard and placeholder entries. */
export function configDescription(map: Record<string, string>, key: string): string | undefined {
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

export function loadMetadata(): void {
  if (started) return;
  started = true;
  try {
    void serverApi
      .metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        const types: Record<string, string> = {};
        collectKeys(m.configs, map, types);
        metadataStore.setState({ ...FALLBACK_DESCRIPTIONS, ...map });
        metadataTypesStore.setState(types);
      })
      .catch(() => {
        // Metadata may be unavailable; descriptions just stay empty.
      });
  } catch {
    // serverApi.metadata may be absent in some environments; keep descriptions empty.
  }
}
