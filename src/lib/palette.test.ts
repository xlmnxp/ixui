import { buildCommands, filterCommands, fuzzyScore } from "./palette";
import type { Instance, Project } from "../api/types";

const inst = (name: string, status: string): Instance =>
  ({ name, status, project: "default", type: "container" }) as unknown as Instance;

const deps = (instances: Instance[] = []) => ({
  instances,
  projects: [{ name: "dev" }] as Project[],
  navigate: vi.fn(),
  setProject: vi.fn(),
  instanceAction: vi.fn(),
  openTerminal: vi.fn(),
  createInstance: vi.fn(),
});

describe("fuzzyScore", () => {
  it("matches subsequences and rejects non-matches", () => {
    expect(fuzzyScore("wb", "web1")).not.toBeNull();
    expect(fuzzyScore("xyz", "web1")).toBeNull();
    expect(fuzzyScore("", "anything")).toBe(0);
  });
  it("ranks prefix matches above scattered ones", () => {
    expect(fuzzyScore("web", "web1")!).toBeGreaterThan(fuzzyScore("web", "my-old-web")!);
  });
});

describe("buildCommands / filterCommands", () => {
  it("offers start for stopped and stop/restart for running instances", () => {
    const cmds = buildCommands(deps([inst("a", "Stopped"), inst("b", "Running")]));
    const ids = cmds.map((c) => c.id);
    expect(ids).toContain("start-default/a");
    expect(ids).not.toContain("stop-default/a");
    expect(ids).toContain("stop-default/b");
    expect(ids).toContain("restart-default/b");
    expect(ids).not.toContain("start-default/b");
  });

  it("filters, ranks, and runs commands", () => {
    const d = deps([inst("web1", "Running"), inst("db1", "Stopped")]);
    const results = filterCommands(buildCommands(d), "web1");
    expect(results[0]!.id).toBe("instance-default/web1");
    results[0]!.run();
    expect(d.navigate).toHaveBeenCalledWith("/instances/web1");
    expect(filterCommands(buildCommands(d), "settings")[0]!.label).toBe("Settings");
    expect(filterCommands(buildCommands(d), "qqqq")).toEqual([]);
  });
});
