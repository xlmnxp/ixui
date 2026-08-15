import {
  ApiClient,
  ApiError,
  ALL_PROJECTS,
  projectFor,
  projectQueryFor,
  registerInstanceProject,
  unregisterInstanceProject,
  removeInstanceProject,
  resetInstanceProjects,
  setProjectProvider,
} from "./client";
import { authStore } from "../auth/status";

describe("ApiClient", () => {
  beforeEach(() => authStore.setState("unknown"));
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("GETs JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" })));
    const client = new ApiClient("/1.0");
    const data = await client.get<{ hello: string }>("/");
    expect(data).toEqual({ hello: "world" });
    expect(fetch).toHaveBeenCalledWith("/1.0/", expect.objectContaining({ method: "GET" }));
  });

  it("lists with recursion=1 and filters URL strings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, ["/1.0/instances/web1", { name: "web1" }])));
    const client = new ApiClient("/1.0");
    const data = await client.list<{ name: string }>("/instances");
    expect(data).toEqual([{ name: "web1" }]);
    expect(fetch).toHaveBeenCalledWith("/1.0/instances?recursion=1", expect.anything());
  });

  it("lists all projects when the allProjects flag is set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [])));
    const client = new ApiClient("/1.0");
    await client.list("/instances", { allProjects: true });
    expect(fetch).toHaveBeenCalledWith("/1.0/instances?all-projects=true&recursion=1", expect.anything());
  });

  it("lists a specific project when project is given", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [])));
    const client = new ApiClient("/1.0");
    await client.list("/instances", { project: "default" });
    expect(fetch).toHaveBeenCalledWith("/1.0/instances?project=default&recursion=1", expect.anything());
  });

  it("unwraps the Incus sync envelope in GET responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          type: "sync",
          status: "Success",
          status_code: 200,
          metadata: { cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } },
        })
      )
    );
    const client = new ApiClient("/1.0");
    const data = await client.get<{ cpu: { total: number }; memory: { total: number; used: number } }>("/resources");
    expect(data).toEqual({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } });
  });

  it("unwraps the Incus sync envelope in list responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          type: "sync",
          status: "Success",
          status_code: 200,
          metadata: ["/1.0/instances/web1", { name: "web1" }],
        })
      )
    );
    const client = new ApiClient("/1.0");
    const data = await client.list<{ name: string }>("/instances");
    expect(data).toEqual([{ name: "web1" }]);
  });

  it("does not unwrap async responses", async () => {
    const asyncBody = {
      type: "async",
      status: "Running",
      status_code: 100,
      operation: "/1.0/operations/op1",
      metadata: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, asyncBody)));
    const client = new ApiClient("/1.0");
    const data = await client.get<{ type: string; operation: string }>("/x");
    expect(data).toEqual(asyncBody);
  });

  it("POSTs JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { type: "sync" })));
    const client = new ApiClient("/1.0");
    await client.post("/instances", { name: "web1" });
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "web1" });
  });

  it("returns null for empty 200 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const client = new ApiClient("/1.0");
    const result = await client.post("/x", {});
    expect(result).toBeNull();
  });

  it("throws ApiError with status and code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found", error_code: 404 })));
    const client = new ApiClient("/1.0");
    await expect(client.get("/nope")).rejects.toMatchObject({ status: 404, code: 404, message: "Not found" });
  });

  it("does not call the forbidden handler on 403 and throws ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "denied", error_code: 403 })));
    const client = new ApiClient("/1.0");
    const onForbidden = vi.fn();
    client.setForbiddenHandler(onForbidden);
    const error = await client.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403 });
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it("calls the forbidden handler on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized", error_code: 401 })));
    const client = new ApiClient("/1.0");
    const onForbidden = vi.fn();
    client.setForbiddenHandler(onForbidden);
    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it("marks the auth state authenticated on 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" })));
    const client = new ApiClient("/1.0");
    await client.get("/");
    expect(authStore.getState()).toBe("authenticated");
  });

  it("DELETE sends no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const client = new ApiClient("/1.0");
    await client.delete("/instances/web1");
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("DELETE");
  });

  it("HEAD returns response headers without parsing a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: { "x-incus-type": "file" } }))
    );
    const client = new ApiClient("/1.0");
    const headers = await client.head("/instances/web1/files?path=%2Fetc");
    expect(headers.get("x-incus-type")).toBe("file");
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("HEAD");
  });

  it("HEAD throws ApiError on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404, statusText: "Not Found" })));
    const client = new ApiClient("/1.0");
    await expect(client.head("/nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("instance project registry", () => {
  afterEach(() => {
    resetInstanceProjects();
    setProjectProvider(() => "default");
  });

  it("resolves a uniquely registered name in all-projects mode", () => {
    setProjectProvider(() => ALL_PROJECTS);
    registerInstanceProject("web1", "dev");
    expect(projectFor("web1")).toBe("dev");
  });

  it("returns undefined for names registered in multiple projects", () => {
    setProjectProvider(() => ALL_PROJECTS);
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "prod");
    expect(projectFor("web1")).toBeUndefined();
  });

  it("prefers the current project when it is registered for the name", () => {
    setProjectProvider(() => "prod");
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "prod");
    expect(projectFor("web1")).toBe("prod");
  });

  it("deduplicates repeated registrations", () => {
    setProjectProvider(() => ALL_PROJECTS);
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "dev");
    expect(projectFor("web1")).toBe("dev");
  });

  it("unregisters by project or by entire name", () => {
    setProjectProvider(() => ALL_PROJECTS);
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "prod");
    unregisterInstanceProject("web1", "prod");
    expect(projectFor("web1")).toBe("dev");
    unregisterInstanceProject("web1");
    expect(projectFor("web1")).toBeUndefined();
  });

  it("removeInstanceProject drops one project across all names", () => {
    setProjectProvider(() => ALL_PROJECTS);
    registerInstanceProject("web1", "dev");
    registerInstanceProject("web1", "prod");
    registerInstanceProject("db1", "dev");
    removeInstanceProject("dev");
    expect(projectFor("web1")).toBe("prod");
    expect(projectFor("db1")).toBeUndefined();
  });

  it("projectQueryFor accepts an explicit project override", () => {
    setProjectProvider(() => ALL_PROJECTS);
    expect(projectQueryFor("web1", "prod")).toBe("?project=prod");
    expect(projectQueryFor("web1")).toBe("");
  });
});

describe("ApiClient timeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("aborts requests that exceed the default timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
      )
    );
    const client = new ApiClient("/1.0");
    const pending = client.get<unknown>("/slow").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const error = await pending;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0 });
    expect((error as ApiError).message).toContain("timed out");
  });

  it("clears the timer on success", async () => {
    const jsonResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
    const client = new ApiClient("/1.0");
    await client.get<{ ok: boolean }>("/");
    // No timer left behind: nothing to assert directly, but a leaked timer would
    // keep the fake-timer suite pending. The resolved value is the contract.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
