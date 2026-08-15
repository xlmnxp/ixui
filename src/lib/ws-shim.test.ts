import { createSubprotocolShim } from "./ws-shim";

describe("createSubprotocolShim", () => {
  class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    static lastProtocols: unknown = "unset";
    url: string;
    binaryType = "blob";
    constructor(url: string | URL, protocols?: string | string[]) {
      this.url = String(url);
      FakeWebSocket.instances.push(this);
      FakeWebSocket.lastProtocols = protocols;
    }
  }

  afterEach(() => vi.unstubAllGlobals());

  it("drops subprotocol arguments while installed", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const shim = createSubprotocolShim();
    shim.install();
    const ws = new WebSocket("ws://x/console", "binary");
    expect(ws.url).toBe("ws://x/console");
    expect(FakeWebSocket.lastProtocols).toBeUndefined();
    expect(FakeWebSocket.instances).toHaveLength(1);
    shim.restore();
  });

  it("restores the native WebSocket", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const shim = createSubprotocolShim();
    shim.install();
    shim.restore();
    expect(window.WebSocket).toBe(FakeWebSocket);
  });

  it("is idempotent when installed repeatedly", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const shim = createSubprotocolShim();
    shim.install();
    shim.install();
    new WebSocket("ws://x", "binary");
    expect(FakeWebSocket.lastProtocols).toBeUndefined();
    shim.restore();
    shim.restore();
    expect(window.WebSocket).toBe(FakeWebSocket);
  });
});
