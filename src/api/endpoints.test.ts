import { instancesApi, infraApi, serverApi, operationsApi, clusterApi } from "./index";
import { setProjectProvider } from "./client";

describe("API endpoints", () => {
  beforeEach(() => setProjectProvider(() => "default"));
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("instances list hits recursion=1", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ name: "web1", status: "Started" }]));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.list();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/instances?project=default&recursion=1", expect.anything());
  });

  it("instance setState posts action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.setState("web1", "stop", true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ action: "stop", force: true });
  });

  it("exec posts command, TERM env and wait-for-websocket", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.exec("web1", ["/bin/sh"], true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({ command: ["/bin/sh"], interactive: true, environment: { TERM: "xterm" }, "wait-for-websocket": true });
  });

  it("vga console posts with type vga and force", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.console("Win11", 80, 24);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/Win11/console?project=default");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ width: 80, height: 24, type: "vga", force: true });
  });

  it("snapshot restore posts restore flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.restoreSnapshot("web1", "snap1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/web1/snapshots/snap1?project=default");
    expect(JSON.parse(init?.body as string)).toEqual({ restore: true });
  });

  it("image pull posts simplestreams source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.pullImage({ alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/images?project=default");
    const body = JSON.parse(init?.body as string);
    expect(body.source).toEqual({ type: "image", alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org", protocol: "simplestreams" });
  });

  it("projects list and pool volumes list", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "default" }])));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.listProjects();
    await infraApi.listPoolVolumes("default");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/volumes?project=default&recursion=1");
  });

  it("server info and operation wait", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal("fetch", fetchMock);
    await serverApi.info();
    await operationsApi.wait("op1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/operations/op1/wait");
  });

  it("scopes requests to the current project", async () => {
    setProjectProvider(() => "prod");
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.list();
    await infraApi.listImages();
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/instances?project=prod&recursion=1");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/images?project=prod&recursion=1");
  });

  it("scopes instance create, update, and state to the current project", async () => {
    setProjectProvider(() => "prod");
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.create({ name: "web1", type: "container" });
    await instancesApi.update("web1", { description: "x" });
    await instancesApi.state("web1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/instances?project=prod");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/instances/web1?project=prod");
    expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/instances/web1/state?project=prod");
  });

  it("create appends target and keeps project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.create({ name: "web1", type: "container" }, "incus-1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/instances?project=default&target=incus-1");
  });

  it("cluster members list is not project-scoped", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ server_name: "incus-1", url: "https://x", database: true, status: "Online", message: "", architecture: "x86_64" }]));
    vi.stubGlobal("fetch", fetchMock);
    await clusterApi.listMembers();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/cluster/members?recursion=1", expect.anything());
  });

  it("server metadata is not project-scoped", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { configs: [{ key: "limits.memory", description: "Memory limit" }] }));
    vi.stubGlobal("fetch", fetchMock);
    await serverApi.metadata();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/metadata", expect.anything());
  });
});
