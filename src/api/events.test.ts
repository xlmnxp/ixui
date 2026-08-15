import { EventStream } from "./events";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
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

  it("does not reconnect when close() happens during pending reconnect", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    const ws = FakeWebSocket.instances[0]!;
    ws.onclose?.();
    stream.close();
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it("backs off between repeated failures and resets on open", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    // First drop: reconnect within ~1s.
    FakeWebSocket.instances[0]!.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances.length).toBe(2);
    // Open the reconnected socket, then drop it: backoff must have reset,
    // so the next reconnect also lands within ~1s.
    FakeWebSocket.instances[1]!.onopen?.();
    FakeWebSocket.instances[1]!.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances.length).toBe(3);
    stream.close();
  });

  it("caps the reconnect delay at 30s", () => {
    const stream = new EventStream("ws://x");
    stream.connect();
    let closed = FakeWebSocket.instances[0]!;
    // Repeated failures with no successful open: delays grow but stay ≤ 30s.
    for (let i = 0; i < 10; i++) {
      closed.onclose?.();
      vi.advanceTimersByTime(31_000);
      closed = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;
      expect(FakeWebSocket.instances.length).toBe(i + 2);
    }
    stream.close();
  });
});
