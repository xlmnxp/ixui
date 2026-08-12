import { instancesApi, infraApi, serverApi, operationsApi, clusterApi, authApi, certificatesApi, backupsApi, filesApi, resourcesApi, warningsApi } from "./index";
import { setProjectProvider } from "./client";
import { fetchCatalog, type SimplestreamsCatalog } from "./simplestreams";

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

  it("auth groups list hits recursion=1", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "admins", description: "", permissions: [] }])));
    vi.stubGlobal("fetch", fetchMock);
    await authApi.listGroups();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/auth/groups?recursion=1", expect.anything());
  });

  it("certificates token posts type client with description and expiry", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
    vi.stubGlobal("fetch", fetchMock);
    await certificatesApi.createToken("laptop", "2026-12-31T23:59:59Z");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/certificates");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ type: "client", description: "laptop", expiry: "2026-12-31T23:59:59Z" });
  });

  it("backups create posts name and options", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
    vi.stubGlobal("fetch", fetchMock);
    await backupsApi.create("web1", "snap-before-deploy", { compression: "gzip" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/web1/backups?project=default");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "snap-before-deploy", compression: "gzip" });
  });

  it("files get URL encodes the path", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, "file contents")));
    vi.stubGlobal("fetch", fetchMock);
    await filesApi.get("web1", "/etc/nginx/conf.d/default.conf");
    expect(fetchMock).toHaveBeenCalledWith("/1.0/instances/web1/files?path=%2Fetc%2Fnginx%2Fconf.d%2Fdefault.conf", expect.anything());
  });

  it("files put posts raw body with text/plain header", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
    vi.stubGlobal("fetch", fetchMock);
    await filesApi.put("web1", "/etc/motd", "hello world");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/instances/web1/files?path=%2Fetc%2Fmotd");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "text/plain" });
    expect(init?.body).toBe("hello world");
  });

  it("files put throws ApiError on failure", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(404, { error: "not found", error_code: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(filesApi.put("web1", "/missing", "x")).rejects.toMatchObject({ status: 404, message: "not found" });
  });

  it("resources get is global and skips the project query", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, { cpu: { total: 8 }, memory: { total: 16000, used: 8000 } })));
    vi.stubGlobal("fetch", fetchMock);
    await resourcesApi.get();
    expect(fetchMock).toHaveBeenCalledWith("/1.0/resources?recursion=1", expect.anything());
  });

  it("warnings ack PUTs acknowledged flag", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
    vi.stubGlobal("fetch", fetchMock);
    await warningsApi.ack("w-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/1.0/warnings/w-1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ acknowledged: true });
  });

  it("operations list and cancel", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchMock);
    await operationsApi.list();
    expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/operations?recursion=1");
    await operationsApi.cancel("op1");
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe("/1.0/operations/op1");
    expect(init?.method).toBe("DELETE");
  });

  it("backups exportUrl returns the download path", () => {
    expect(backupsApi.exportUrl("web1", "backup-1")).toBe("/instances/web1/backups/backup-1/export");
  });

  it("simplestreams catalog follows index path and parses products", async () => {
    const indexJson = {
      format: "index:1.0",
      index: {
        images: {
          path: "streams/v1/images.json",
          products: ["ubuntu-24.04-default-amd64"],
        },
      },
    };
    const imagesJson = {
      format: "products:1.0",
      products: {
        "ubuntu-24.04-default-amd64": {
          os: "ubuntu",
          release: "24.04",
          version: "24.04",
          arch: "amd64",
          variants: {
            default: {
              items: {
                "rootfs.tar.xz": { path: "ubuntu/24.04/default/amd64/rootfs.tar.xz", size: 123456, fingerprint: "fpr1" },
                "disk1.img": { path: "ubuntu/24.04/default/amd64/disk1.img", size: 654321, fingerprint: "fpr2" },
              },
            },
          },
        },
      },
    };
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith("index.json")) return Promise.resolve(jsonResponse(200, indexJson));
      return Promise.resolve(jsonResponse(200, imagesJson));
    });
    vi.stubGlobal("fetch", fetchMock);
    const catalog: SimplestreamsCatalog = await fetchCatalog("https://images.example");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://images.example/streams/v1/index.json");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://images.example/streams/v1/images.json");
    const product = catalog.products["ubuntu-24.04-default-amd64"]!;
    expect(product.os).toBe("ubuntu");
    expect(product.release).toBe("24.04");
    expect(product.variant).toBe("default");
    expect(product.arch).toBe("amd64");
    expect(product.itemTypes).toEqual(["rootfs.tar.xz", "disk1.img"]);
    expect(product.size).toBe(123456);
    expect(product.path).toBe("ubuntu/24.04/default/amd64/rootfs.tar.xz");
    expect(product.fingerprints).toEqual(["fpr1", "fpr2"]);
  });
});
