import { parseProjectState, tightestResource, usagePercent } from "./project-usage";

describe("project usage", () => {
  const raw = {
    resources: {
      instances: { Limit: 4, Usage: 3 },
      memory: { Limit: 1000, Usage: 100 },
      disk: { Limit: -1, Usage: 50 },
      "disk-default": { Limit: 10, Usage: 1 },
    },
  };

  it("maps resources to limit keys and skips per-pool disk", () => {
    const u = parseProjectState(raw);
    expect(Object.keys(u).sort()).toEqual(["limits.disk", "limits.instances", "limits.memory"]);
    expect(u["limits.instances"]).toEqual({ usage: 3, limit: 4 });
  });

  it("tolerates missing or malformed state", () => {
    expect(parseProjectState(null)).toEqual({});
    expect(parseProjectState({ resources: { cpu: { Limit: "x" } } })).toEqual({});
  });

  it("computes percent only for limited resources, clamped", () => {
    expect(usagePercent({ usage: 3, limit: 4 })).toBe(75);
    expect(usagePercent({ usage: 9, limit: 4 })).toBe(100);
    expect(usagePercent({ usage: 9, limit: -1 })).toBeNull();
    expect(usagePercent(undefined)).toBeNull();
  });

  it("finds the tightest limited resource", () => {
    expect(tightestResource(parseProjectState(raw))).toEqual({ key: "limits.instances", percent: 75 });
    expect(tightestResource({})).toBeNull();
  });
});
