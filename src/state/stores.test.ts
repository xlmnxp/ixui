import { operationsStore, applyOperationEvent, dismissOperation } from "./operations";
import { instancesStore, applyInstanceLifecycle, instanceNameFromSource, projectFromSource } from "./instances";
import { currentProjectStore, setCurrentProject } from "./projects";
import type { Operation } from "../api/types";

const op = (id: string, status: Operation["status"]): Operation => ({
  id,
  class: "task",
  description: "test",
  status,
  status_code: 100,
  created_at: "x",
  updated_at: "x",
  may_cancel: false,
});

describe("operations store", () => {
  beforeEach(() => operationsStore.setState([]));

  it("adds running operations", () => {
    const next = applyOperationEvent([], { id: "op1", operation: op("op1", "Running") });
    expect(next.map((o) => o.id)).toEqual(["op1"]);
  });

  it("updates by id and keeps newest first", () => {
    let state = applyOperationEvent([], { id: "op1", operation: op("op1", "Running") });
    state = applyOperationEvent(state, { id: "op2", operation: op("op2", "Running") });
    expect(state.map((o) => o.id)).toEqual(["op2", "op1"]);
    state = applyOperationEvent(state, { id: "op1", operation: op("op1", "Success") });
    expect(state.find((o) => o.id === "op1")?.status).toBe("Success");
  });

  it("dismisses an operation", () => {
    operationsStore.setState([op("op1", "Success")]);
    dismissOperation("op1");
    expect(operationsStore.getState()).toEqual([]);
  });
});

describe("instances store", () => {
  beforeEach(() => instancesStore.setState({}));

  it("removes on instance-deleted", () => {
    const state = { "default/web1": { name: "web1", project: "default" } } as never;
    const next = applyInstanceLifecycle(state, { action: "instance-deleted", source: "/1.0/instances/web1" });
    expect(next).toEqual({});
  });

  it("updates status on started/stopped", () => {
    const state = { "default/web1": { name: "web1", project: "default", status: "Stopped" } } as never;
    const started = applyInstanceLifecycle(state, { action: "instance-started", source: "/1.0/instances/web1" });
    expect((started as unknown as { "default/web1": { status: string } })["default/web1"].status).toBe("Started");
    const stopped = applyInstanceLifecycle(started, { action: "instance-stopped", source: "/1.0/instances/web1" });
    expect((stopped as unknown as { "default/web1": { status: string } })["default/web1"].status).toBe("Stopped");
  });

  it("matches sources that carry a project query", () => {
    const state = { "dev/web1": { name: "web1", project: "dev", status: "Stopped" } } as never;
    const next = applyInstanceLifecycle(state, { action: "instance-started", source: "/1.0/instances/web1?project=dev" });
    expect((next as unknown as { "dev/web1": { status: string } })["dev/web1"].status).toBe("Started");
  });

  it("updates every project entry with a duplicate name", () => {
    const state = {
      "dev/web1": { name: "web1", project: "dev", status: "Stopped" },
      "prod/web1": { name: "web1", project: "prod", status: "Stopped" },
    } as never;
    const next = applyInstanceLifecycle(state, { action: "instance-stopped", source: "/1.0/instances/web1" });
    expect((next as unknown as { "dev/web1": { status: string }; "prod/web1": { status: string } })["dev/web1"].status).toBe("Stopped");
    const del = applyInstanceLifecycle(state, { action: "instance-deleted", source: "/1.0/instances/web1?project=dev" });
    expect(Object.keys(del)).toEqual(["prod/web1"]);
  });

  it("ignores sources it cannot parse", () => {
    const state = { "default/web1": { name: "web1", project: "default", status: "Stopped" } } as never;
    expect(applyInstanceLifecycle(state, { action: "instance-started", source: "" })).toBe(state);
  });

  it("parses instance names and projects from sources", () => {
    expect(instanceNameFromSource("/1.0/instances/web1?project=dev")).toBe("web1");
    expect(instanceNameFromSource("/1.0/instances/web1")).toBe("web1");
    expect(instanceNameFromSource("/1.0/instances/")).toBeNull();
    expect(projectFromSource("/1.0/instances/web1?project=dev")).toBe("dev");
    expect(projectFromSource("/1.0/instances/web1")).toBeNull();
  });
});

describe("currentProjectStore", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to all projects", () => {
    expect(currentProjectStore.getState()).toBe("all");
  });

  it("persists selection", () => {
    setCurrentProject("prod");
    expect(currentProjectStore.getState()).toBe("prod");
    expect(localStorage.getItem("ixui.project.v2")).toBe("prod");
  });
});
