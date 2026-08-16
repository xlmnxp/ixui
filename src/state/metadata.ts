import { createStore } from "./store";
import { serverApi } from "../api";

/** Config-key → description map from GET /1.0/metadata (shared, fetched once). */
export const metadataStore = createStore<Record<string, string>>({});

let started = false;

export function loadMetadata(): void {
  if (started) return;
  started = true;
  try {
    void serverApi
      .metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        for (const c of m.configs ?? []) {
          if (c.key && c.description) map[c.key] = c.description;
        }
        metadataStore.setState(map);
      })
      .catch(() => {
        // Metadata is optional (server-side feature); descriptions just stay empty.
      });
  } catch {
    // serverApi.metadata may be absent in some environments; keep descriptions empty.
  }
}
