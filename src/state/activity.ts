import { createStore } from "./store";
import { instanceNameFromSource, projectFromSource } from "./instances";

export interface ActivityEvent {
  id: string;
  /** Timestamp carried by the daemon event (ISO string). */
  timestamp: string;
  /** Client receipt time, for stable ordering. */
  receivedAt: number;
  action: string;
  source: string;
  instance: string | null;
  project: string | null;
  username: string | null;
  address: string | null;
}

export interface LifecycleMeta {
  action: string;
  source: string;
  requestor?: { username?: string; address?: string } | null;
}

const STORAGE_KEY = "ixui.activity.v1";
export const MAX_ACTIVITY_EVENTS = 500;

function isActivityEvent(value: unknown): value is ActivityEvent {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.timestamp === "string" &&
    typeof e.receivedAt === "number" &&
    typeof e.action === "string" &&
    typeof e.source === "string"
  );
}

export function loadActivity(): ActivityEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivityEvent).slice(0, MAX_ACTIVITY_EVENTS);
  } catch {
    return [];
  }
}

function persist(events: ActivityEvent[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Quota exceeded — keep only the newest half.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, Math.max(1, events.length / 2))));
    } catch {
      // Give up; in-memory state still works for this session.
    }
  }
}

export const activityStore = createStore<ActivityEvent[]>(loadActivity());

export function applyActivityEvent(state: ActivityEvent[], event: ActivityEvent): ActivityEvent[] {
  return [event, ...state].slice(0, MAX_ACTIVITY_EVENTS);
}

export function recordActivity(meta: LifecycleMeta, timestamp: string): void {
  const requestor = meta.requestor ?? {};
  const event: ActivityEvent = {
    id: `${timestamp}-${meta.action}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    receivedAt: Date.now(),
    action: meta.action,
    source: meta.source,
    instance: instanceNameFromSource(meta.source),
    project: projectFromSource(meta.source),
    username: requestor.username ?? null,
    address: requestor.address ?? null,
  };
  activityStore.setState((prev) => {
    const next = applyActivityEvent(prev, event);
    persist(next);
    return next;
  });
}

export function clearActivity(): void {
  activityStore.setState([]);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
