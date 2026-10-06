import { useCallback, useState } from "react";

const PREFIX = "ixui.ui.";

export function readPersisted<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writePersisted(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable — non-fatal
  }
}

/** useState backed by localStorage. Without a key it behaves like plain useState. */
export function usePersistedState<T>(
  key: string | undefined,
  initial: T,
  valid: (v: unknown) => v is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => (key ? readPersisted(key, initial, valid) : initial));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (key) writePersisted(key, next);
    },
    [key],
  );
  return [value, set];
}
