import { instancesApi, infraApi, serverApi, operationsApi } from "./index";

describe("API endpoints", () => {
  afterEach(() => vi.unstubAllGlobals());

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("instances list hits recursion=1", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ name: "web1", status: "Started" }]));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.list();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/instances?recursion=1", expect.anything());
  });

  it("instance setState posts action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.setState("web1", "stop", true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ action: "stop", force: true });
  });

  it("exec posts command and TERM env", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.exec("web1", ["/bin/sh"], true);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({ command: ["/bin/sh"], interactive: true, environment: { TERM: "xterm" } });
  });

  it("snapshot restore posts restore flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await instancesApi.restoreSnapshot("web1", "snap1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/web1/snapshots/snap1");
    expect(JSON.parse(init?.body as string)).toEqual({ restore: true });
  });

  it("image pull posts simplestreams source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.pullImage({ alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/images");
    const body = JSON.parse(init?.body as string);
    expect(body.source).toEqual({ type: "image", alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org", protocol: "simplestreams" });
  });

  it("projects list and pool volumes list", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "default" }])));
    vi.stubGlobal("fetch", fetchMock);
    await infraApi.listProjects();
    await infraApi.listPoolVolumes("default");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/volumes?recursion=1");
  });

  it("server info and operation wait", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal("fetch", fetchMock);
    await serverApi.info();
    await operationsApi.wait("op1");
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/");
    expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/operations/op1/wait");
  });
});
