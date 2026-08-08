import { EventStream } from "./events";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((msg: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  static emit(instance: FakeWebSocket, data: unknown) {
    instance.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("EventStream", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("connects to the url", () => {
    const stream = new EventStream("wss://x/1.0/events");
    stream.connect();
    expect(FakeWebSocket.instances[0]?.url).toBe("wss://x/1.0/events");
    stream.close();
  });

  it("delivers parsed events to listeners", () => {
    const stream = new EventStream("ws://x");
    const listener = vi.fn();
    stream.connect();
    stream.onEvent(listener);
    FakeWebSocket.emit(FakeWebSocket.instances[0]!, { type: "operation", timestamp: "t", metadata: { id: "op1" } });
    expect(listener).toHaveBeenCalledWith({ type: "operation", timestamp: "t", metadata: { id: "op1" } });
    stream.close();
  });

  it("unsubscribes", () => {
    const stream = new EventStream("ws://x");
    const listener = vi.fn();
    stream.connect();
    const unsubscribe = stream.onEvent(listener);
    unsubscribe();
    FakeWebSocket.emit(FakeWebSocket.instances[0]!, { type: "operation", timestamp: "t", metadata: {} });
    expect(listener).not.toHaveBeenCalled();
    stream.close();
  });

  it("reconnects after unexpected close", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    const ws = FakeWebSocket.instances[0]!;
    ws.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances.length).toBe(2);
    stream.close();
  });

  it("does not reconnect after close()", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    stream.close();
    const ws = FakeWebSocket.instances[0]!;
    ws.onclose?.();
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances.length).toBe(1);
  });
});
