import { initRealtime } from "./realtime";
import { instancesStore } from "./instances";
import { operationsStore } from "./operations";
import { instancesApi } from "../api";
import {
  ALL_PROJECTS,
  projectFor,
  registerInstanceProject,
  resetInstanceProjects,
  setProjectProvider,
} from "../api/client";
import type { EventStream } from "../api/events";
import type { Instance, Operation } from "../api/types";

vi.mock("../api", () => ({
  instancesApi: { get: vi.fn() },
}));

type StreamListener = (e: { type: string; timestamp: string; metadata: unknown }) => void;

function fakeStream(): { stream: EventStream; emit: StreamListener } {
  let listener: StreamListener | null = null;
  const stream = {
    onEvent: (fn: StreamListener) => {
      listener = fn;
      return () => {
        listener = null;
      };
    },
  } as unknown as EventStream;
  return {
    stream,
    emit: (e) => {
      listener?.(e);
    },
  };
}

const instance = (name: string, project: string, status: string): Instance =>
  ({ name, project, status }) as Instance;

const operation = (id: string, status: Operation["status"], resources?: Operation["resources"]): Operation =>
  ({
    id,
    class: "task",
    description: "test",
    status,
    status_code: 100,
    created_at: "x",
    updated_at: "x",
    may_cancel: false,
    resources,
  }) as Operation;

describe("initRealtime", () => {
  beforeEach(() => {
    instancesStore.setState({});
    operationsStore.setState([]);
    resetInstanceProjects();
    setProjectProvider(() => ALL_PROJECTS);
  });

  it("adds operation events to the operations store", () => {
    const { stream, emit } = fakeStream();
    initRealtime(stream);
    emit({ type: "operation", timestamp: "t", metadata: operation("op1", "Running") });
    expect(operationsStore.getState().map((o) => o.id)).toEqual(["op1"]);
  });

  it("applies lifecycle status updates and registers the project", () => {
    const { stream, emit } = fakeStream();
    instancesStore.setState({ "dev/web1": instance("web1", "dev", "Stopped") });
    initRealtime(stream);
    emit({
      type: "lifecycle",
      timestamp: "t",
      metadata: { action: "instance-started", source: "/1.0/instances/web1?project=dev" },
    });
    expect(instancesStore.getState()["dev/web1"]?.status).toBe("Started");
    expect(projectFor("web1")).toBe("dev");
  });

  it("unregisters the project on instance-deleted", () => {
    const { stream, emit } = fakeStream();
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "prod");
    instancesStore.setState({
      "dev/web1": instance("web1", "dev", "Stopped"),
      "prod/web1": instance("web1", "prod", "Stopped"),
    });
    initRealtime(stream);
    emit({
      type: "lifecycle",
      timestamp: "t",
      metadata: { action: "instance-deleted", source: "/1.0/instances/web1?project=dev" },
    });
    expect(projectFor("web1")).toBe("prod");
    expect(Object.keys(instancesStore.getState())).toEqual(["prod/web1"]);
  });

  it("rekeys the store and project registry on instance-renamed", () => {
    const { stream, emit } = fakeStream();
    registerInstanceProject("web1", "dev");
    instancesStore.setState({ "dev/web1": instance("web1", "dev", "Stopped") });
    initRealtime(stream);
    emit({
      type: "lifecycle",
      timestamp: "t",
      metadata: { action: "instance-renamed", source: "/1.0/instances/web2?project=dev", context: { old_name: "web1" } },
    });
    expect(Object.keys(instancesStore.getState())).toEqual(["dev/web2"]);
    expect(instancesStore.getState()["dev/web2"]?.name).toBe("web2");
    expect(projectFor("web2")).toBe("dev");
    expect(projectFor("web1")).not.toBe("dev");
  });

  it("refreshes every project entry with the operation's instance name", async () => {
    const { stream, emit } = fakeStream();
    instancesStore.setState({
      "dev/web1": instance("web1", "dev", "Stopped"),
      "prod/web1": instance("web1", "prod", "Stopped"),
    });
    vi.mocked(instancesApi.get).mockImplementation((name: string, project?: string) =>
      Promise.resolve(instance(name, project ?? "default", "Started"))
    );
    initRealtime(stream);
    emit({
      type: "operation",
      timestamp: "t",
      metadata: operation("op1", "Success", { instances: ["/1.0/instances/web1"] }),
    });
    await vi.waitFor(() => {
      expect(instancesApi.get).toHaveBeenCalledWith("web1", "dev");
      expect(instancesApi.get).toHaveBeenCalledWith("web1", "prod");
    });
    expect(instancesStore.getState()["dev/web1"]?.status).toBe("Started");
    expect(instancesStore.getState()["prod/web1"]?.status).toBe("Started");
  });

  it("removes store entries when the refresh 404s", async () => {
    const { stream, emit } = fakeStream();
    instancesStore.setState({ "dev/web1": instance("web1", "dev", "Stopped") });
    vi.mocked(instancesApi.get).mockRejectedValue(new Error("not found"));
    initRealtime(stream);
    emit({
      type: "operation",
      timestamp: "t",
      metadata: operation("op1", "Success", { instances: ["/1.0/instances/web1"] }),
    });
    await vi.waitFor(() => {
      expect(instancesStore.getState()).toEqual({});
    });
  });
});
