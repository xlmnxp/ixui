import { instancesApi, infraApi, serverApi, operationsApi, clusterApi, networkExtrasApi, volumesApi } from "./index";
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

  describe("network extras", () => {
    it("ACL list is project-scoped with recursion=1", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "acl1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await networkExtrasApi.listAcls();
      expect(fetchMock).toHaveBeenCalledWith("/1.0/network-acls?project=default&recursion=1", expect.anything());
    });

    it("ACL get, create, delete, and update hit the right endpoints", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
      vi.stubGlobal("fetch", fetchMock);
      await networkExtrasApi.getAcl("acl1");
      await networkExtrasApi.createAcl({ name: "acl1", description: "web" });
      await networkExtrasApi.deleteAcl("acl1");
      await networkExtrasApi.updateAcl("acl1", { egress: [], ingress: [] });
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/network-acls/acl1?project=default");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/network-acls?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "acl1", description: "web" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/network-acls/acl1?project=default");
      expect(fetchMock.mock.calls[2]![1]!.method).toBe("DELETE");
      expect(fetchMock.mock.calls[3]![0]).toBe("/1.0/network-acls/acl1?project=default");
      expect(fetchMock.mock.calls[3]![1]!.method).toBe("PUT");
    });

    it("forwards list, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ listen_address: "10.0.0.1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await networkExtrasApi.listForwards("net1");
      await networkExtrasApi.createForward("net1", { listen_address: "10.0.0.1", description: "fwd" });
      await networkExtrasApi.deleteForward("net1", "10.0.0.1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/networks/net1/forwards?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/networks/net1/forwards?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ listen_address: "10.0.0.1", description: "fwd" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/networks/net1/forwards/10.0.0.1?project=default");
    });

    it("zones list, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "zone1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await networkExtrasApi.listZones();
      await networkExtrasApi.createZone({ name: "zone1", description: "internal" });
      await networkExtrasApi.deleteZone("zone1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/network-zones?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/network-zones?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "zone1", description: "internal" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/network-zones/zone1?project=default");
    });

    it("address sets list, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "set1", addresses: [] }])));
      vi.stubGlobal("fetch", fetchMock);
      await networkExtrasApi.listAddressSets();
      await networkExtrasApi.createAddressSet({ name: "set1", addresses: ["10.0.0.0/24"] });
      await networkExtrasApi.deleteAddressSet("set1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/network-address-sets?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/network-address-sets?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "set1", addresses: ["10.0.0.0/24"] });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/network-address-sets/set1?project=default");
    });
  });

  describe("volumes", () => {
    it("volume list and get URLs", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "vol1", type: "custom" }])));
      vi.stubGlobal("fetch", fetchMock);
      await volumesApi.list("default");
      await volumesApi.get("default", "custom", "vol1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/storage-pools/default/volumes?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1?project=default");
    });

    it("volume create posts body with project", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await volumesApi.create("default", { name: "vol1", type: "custom", content_type: "filesystem", config: { size: "10GB" } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/storage-pools/default/volumes?project=default");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ name: "vol1", type: "custom", content_type: "filesystem", config: { size: "10GB" } });
    });

    it("volume update, resize, rename, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
      vi.stubGlobal("fetch", fetchMock);
      await volumesApi.update("default", "custom", "vol1", { config: { size: "20GB" } });
      await volumesApi.resize("default", "custom", "vol1", "30GB");
      await volumesApi.rename("default", "custom", "vol1", "vol2");
      await volumesApi.delete("default", "custom", "vol1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1?project=default");
      expect(fetchMock.mock.calls[0]![1]!.method).toBe("PUT");
      expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ config: { size: "20GB" } });
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ size: "30GB" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1?project=default");
      expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string)).toEqual({ name: "vol2" });
      expect(fetchMock.mock.calls[3]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1?project=default");
      expect(fetchMock.mock.calls[3]![1]!.method).toBe("DELETE");
    });

    it("volume snapshot list URL, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "snap1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await volumesApi.listSnapshots("default", "custom", "vol1");
      await volumesApi.createSnapshot("default", "custom", "vol1", "snap1", true);
      await volumesApi.deleteSnapshot("default", "custom", "vol1", "snap1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1/snapshots?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1/snapshots?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "snap1", stateful: true });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/storage-pools/default/volumes/custom/vol1/snapshots/snap1?project=default");
    });

    it("bucket list, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "bkt1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await volumesApi.listBuckets("default");
      await volumesApi.createBucket("default", { name: "bkt1", description: "backup" });
      await volumesApi.deleteBucket("default", "bkt1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/storage-pools/default/buckets?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/storage-pools/default/buckets?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "bkt1", description: "backup" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/storage-pools/default/buckets/bkt1?project=default");
    });
  });

  describe("instance extras", () => {
    it("copy posts source type copy with target name in body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.copy("web1", "web2", { live: true, pool: "default" });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/instances/web1?project=default");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ source: { type: "copy", source: "web1" }, name: "web2", live: true, pool: "default" });
    });

    it("rename posts the new name", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.rename("web1", "web2");
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/instances/web1?project=default");
      expect(JSON.parse(init?.body as string)).toEqual({ name: "web2" });
    });

    it("move posts migration flag with options", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.move("web1", { target: "incus-2", live: true });
      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(init?.body as string)).toEqual({ migration: true, target: "incus-2", live: true });
    });

    it("rebuild posts image source to rebuild URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.rebuild("web1", { source: { type: "image", alias: "ubuntu/24.04" } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/instances/web1/rebuild?project=default");
      expect(JSON.parse(init?.body as string)).toEqual({ source: { type: "image", alias: "ubuntu/24.04" } });
    });

    it("freeze and unfreeze wrap setState", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, null)));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.freeze("web1");
      await instancesApi.unfreeze("web1");
      expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ action: "freeze", force: false });
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ action: "unfreeze", force: false });
    });

    it("backups list, create, and delete", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "b1" }])));
      vi.stubGlobal("fetch", fetchMock);
      await instancesApi.listBackups("web1");
      await instancesApi.createBackup("web1", "b1");
      await instancesApi.deleteBackup("web1", "b1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/instances/web1/backups?project=default&recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/instances/web1/backups?project=default");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "b1" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/instances/web1/backups/b1?project=default");
    });
  });

  describe("infra extras", () => {
    it("project update is PUT with body and not project-scoped", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await infraApi.updateProject("default", { description: "prod", config: { "features.images": "true" } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/projects/default");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ description: "prod", config: { "features.images": "true" } });
    });

    it("network config update is PUT", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await infraApi.updateNetworkConfig("net1", { config: { "ipv4.address": "10.0.0.1/24" } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/networks/net1?project=default");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ config: { "ipv4.address": "10.0.0.1/24" } });
    });

    it("pool config update is PUT", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await infraApi.updatePoolConfig("default", { config: { "volume.size": "30GB" } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/storage-pools/default?project=default");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ config: { "volume.size": "30GB" } });
    });
  });

  describe("cluster extras", () => {
    it("groups list, create, and delete are not project-scoped", async () => {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(200, [{ name: "g1", nodes: [] }])));
      vi.stubGlobal("fetch", fetchMock);
      await clusterApi.listGroups();
      await clusterApi.createGroup({ name: "g1", description: "web" });
      await clusterApi.deleteGroup("g1");
      expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/cluster/groups?recursion=1");
      expect(fetchMock.mock.calls[1]![0]).toBe("/1.0/cluster/groups");
      expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: "g1", description: "web" });
      expect(fetchMock.mock.calls[2]![0]).toBe("/1.0/cluster/groups/g1");
    });

    it("setMemberState posts the action", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
      vi.stubGlobal("fetch", fetchMock);
      await clusterApi.setMemberState("incus-1", "evacuate");
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/cluster/members/incus-1/state");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ action: "evacuate" });
    });

    it("join token posts server_name and groups", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { type: "sync", metadata: { token: "t" } }));
      vi.stubGlobal("fetch", fetchMock);
      await clusterApi.createJoinToken("new-node", ["g1"]);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("/1.0/cluster/members");
      expect(JSON.parse(init?.body as string)).toEqual({ server_name: "new-node", groups: ["g1"] });
    });

    it("join token defaults to empty groups", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { type: "sync", metadata: { token: "t" } }));
      vi.stubGlobal("fetch", fetchMock);
      await clusterApi.createJoinToken("new-node");
      expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ server_name: "new-node", groups: [] });
    });

    it("member resources GET is not project-scoped", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { resources: { cpu: {} } }));
      vi.stubGlobal("fetch", fetchMock);
      await clusterApi.getMemberResources("incus-1");
      expect(fetchMock).toHaveBeenCalledWith("/1.0/cluster/members/incus-1/resources", expect.anything());
    });
  });
});
