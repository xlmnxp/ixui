export type StreamEvent = {
  type: "operation" | "lifecycle" | "logging" | "error";
  timestamp: string;
  metadata: unknown;
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export class EventStream {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: StreamEvent) => void>();
  private closed = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(private url: string) {}

  private scheduleReconnect(): void {
    if (this.closed) return;
    const attempt = this.reconnectAttempts++;
    const base = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** attempt);
    // Jitter between 50% and 100% of the base so many tabs don't retry in lockstep.
    const delay = base * (0.5 + Math.random() * 0.5);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  connect(): void {
    if (this.closed) {
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      return;
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };
    ws.onmessage = (msg) => {
      void (async () => {
        try {
          const raw = msg.data instanceof Blob ? await msg.data.text() : String(msg.data);
          const event = JSON.parse(raw) as StreamEvent;
          this.listeners.forEach((fn) => fn(event));
        } catch {
          // ignore malformed frames
        }
      })();
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.ws = null;
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  onEvent(fn: (e: StreamEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
