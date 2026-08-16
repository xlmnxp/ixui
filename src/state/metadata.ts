import { createStore } from "./store";
import { serverApi } from "../api";

/** Config-key → description map from GET /1.0/metadata/configuration (shared, fetched once). */
export const metadataStore = createStore<Record<string, string>>({});

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
};

let started = false;

/** Collect every key description from the nested group/entity/keys shape.
    The keys listed inside each "keys" array are full config-key names. */
function collectKeys(node: unknown, map: Record<string, string>): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, map);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.keys)) {
    for (const item of obj.keys) {
      if (typeof item !== "object" || item === null) continue;
      for (const [key, value] of Object.entries(item)) {
        const desc = (value as { shortdesc?: string } | null)?.shortdesc;
        if (desc) map[key] = desc;
      }
    }
  }
  for (const [, child] of Object.entries(obj)) collectKeys(child, map);
}

/** Look up a description, falling back to wildcard entries like user.* or volatile.*. */
export function configDescription(map: Record<string, string>, key: string): string | undefined {
  if (map[key]) return map[key];
  const parts = key.split(".");
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(0, i).join(".") + ".*";
    if (map[candidate]) return map[candidate];
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
        collectKeys(m.configs, map);
        metadataStore.setState({ ...FALLBACK_DESCRIPTIONS, ...map });
      })
      .catch(() => {
        // Metadata may be unavailable; descriptions just stay empty.
      });
  } catch {
    // serverApi.metadata may be absent in some environments; keep descriptions empty.
  }
}
