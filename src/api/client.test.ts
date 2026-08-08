import { ApiClient, ApiError } from "./client";

describe("ApiClient", () => {
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

  it("calls the forbidden handler on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "denied", error_code: 403 })));
    const client = new ApiClient("/1.0");
    const onForbidden = vi.fn();
    client.setForbiddenHandler(onForbidden);
    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it("DELETE sends no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    const client = new ApiClient("/1.0");
    await client.delete("/instances/web1");
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("DELETE");
  });
});
