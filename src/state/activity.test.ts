import {
  activityStore,
  applyActivityEvent,
  clearActivity,
  loadActivity,
  MAX_ACTIVITY_EVENTS,
  recordActivity,
} from "./activity";
import type { ActivityEvent } from "./activity";

const event = (id: string, overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id,
  timestamp: "2026-01-01T00:00:00Z",
  receivedAt: 1_700_000_000_000,
  action: "instance-started",
  source: "/1.0/instances/web1",
  instance: "web1",
  project: null,
  username: null,
  address: null,
  ...overrides,
});

describe("activity store", () => {
  beforeEach(() => {
    localStorage.clear();
    activityStore.setState([]);
  });

  it("loads persisted events on init", () => {
    localStorage.setItem("ixui.activity.v1", JSON.stringify([event("a")]));
    expect(loadActivity()).toHaveLength(1);
  });

  it("ignores malformed persisted payloads", () => {
    localStorage.setItem("ixui.activity.v1", "not json");
    expect(loadActivity()).toEqual([]);
    localStorage.setItem("ixui.activity.v1", JSON.stringify([{ id: 1 }]));
    expect(loadActivity()).toEqual([]);
  });

  it("prepends new events and caps the buffer", () => {
    const base = Array.from({ length: MAX_ACTIVITY_EVENTS }, (_, i) => event(`old-${i}`));
    const next = applyActivityEvent(base, event("new"));
    expect(next).toHaveLength(MAX_ACTIVITY_EVENTS);
    expect(next[0]?.id).toBe("new");
    expect(next.at(-1)?.id).toBe("old-498");
  });

  it("records lifecycle events with parsed instance, project, and requestor", () => {
    recordActivity(
      {
        action: "instance-started",
        source: "/1.0/instances/web1?project=dev",
        requestor: { username: "alice", address: "192.168.1.10" },
      },
      "2026-01-01T00:00:00Z"
    );
    const [recorded] = activityStore.getState();
    expect(recorded?.action).toBe("instance-started");
    expect(recorded?.instance).toBe("web1");
    expect(recorded?.project).toBe("dev");
    expect(recorded?.username).toBe("alice");
    expect(recorded?.address).toBe("192.168.1.10");
    expect(loadActivity()).toHaveLength(1);
  });

  it("persists events to localStorage", () => {
    recordActivity({ action: "instance-stopped", source: "/1.0/instances/web1" }, "t");
    const raw = localStorage.getItem("ixui.activity.v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw ?? "[]")).toHaveLength(1);
  });

  it("clears in-memory and persisted events", () => {
    recordActivity({ action: "instance-stopped", source: "/1.0/instances/web1" }, "t");
    clearActivity();
    expect(activityStore.getState()).toEqual([]);
    expect(localStorage.getItem("ixui.activity.v1")).toBeNull();
  });
});
