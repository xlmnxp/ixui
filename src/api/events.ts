export type StreamEvent = {
  type: "operation" | "lifecycle" | "logging" | "error";
  timestamp: string;
  metadata: unknown;
};

export class EventStream {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: StreamEvent) => void>();
  private closed = false;

  constructor(private url: string) {}

  connect(): void {
    this.closed = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(String(msg.data)) as StreamEvent;
        this.listeners.forEach((fn) => fn(event));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.ws = null;
      window.setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = () => ws.close();
  }

  onEvent(fn: (e: StreamEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}
