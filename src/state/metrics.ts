import { createStore } from "./store";
import { instancesApi } from "../api";
import type { InstanceStateInfo } from "../api/types";

export interface MetricPoint {
  t: number;
  value: number;
}

export interface InstanceMetrics {
  /** CPU usage percent samples computed from counter deltas (0-100 per core). */
  cpu: MetricPoint[];
  /** Memory usage samples in bytes. */
  memory: MetricPoint[];
  /** Network receive throughput in bytes/s, summed over non-loopback interfaces. */
  netRx: MetricPoint[];
  /** Network transmit throughput in bytes/s, summed over non-loopback interfaces. */
  netTx: MetricPoint[];
  /** Root disk usage in bytes from the latest sample; `total` is absent when Incus reports no size. */
  disk?: { usage: number; total?: number };
  /** Cumulative network byte counters and time of the previous sample. */
  netRaw?: { rx: number; tx: number; t: number };
  /** Raw cumulative cpu.usage (ns) of the previous sample. */
  cpuRaw?: number;
  /** Wall-clock time of the previous sample. */
  cpuT?: number;
}

/** Instance key ("project/name") → sampled usage history (ring buffer). */
export const metricsStore = createStore<Record<string, InstanceMetrics>>({});

const MAX_POINTS = 120;
const POLL_MS = 5000;

const pollers = new Map<string, number>();

const keyFor = (name: string, project?: string) => `${project ?? "default"}/${name}`;

function push(samples: MetricPoint[], point: MetricPoint): MetricPoint[] {
  const next = [...samples, point];
  return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
}

function networkCounters(state: InstanceStateInfo): { rx: number; tx: number } | null {
  let rx = 0;
  let tx = 0;
  let seen = false;
  for (const [name, nic] of Object.entries(state.network ?? {})) {
    if (name === "lo" || !nic.counters) continue;
    rx += nic.counters.bytes_received ?? 0;
    tx += nic.counters.bytes_sent ?? 0;
    seen = true;
  }
  return seen ? { rx, tx } : null;
}

/**
 * Poll the instance state every few seconds. CPU percent is derived from the
 * cumulative cpu.usage counter (ns): delta_usage / delta_wall_clock. Memory is
 * the per-instance cgroup usage reported by the daemon.
 */
export function startMetricsPolling(name: string, project?: string): void {
  const key = keyFor(name, project);
  if (pollers.has(key)) return;

  const tick = async () => {
    try {
      const state = await instancesApi.state(name, project);
      const cpuRaw = typeof state.cpu?.usage === "number" ? state.cpu.usage : null;
      const memory = typeof state.memory?.usage === "number" ? state.memory.usage : null;
      const now = Date.now();
      metricsStore.setState((prev) => {
        const cur = prev[key] ?? { cpu: [], memory: [], netRx: [], netTx: [] };
        const next: InstanceMetrics = { ...cur };
        if (cpuRaw !== null && typeof cur.cpuRaw === "number" && cpuRaw >= cur.cpuRaw && typeof cur.cpuT === "number") {
          const dtMs = Math.max(1, now - cur.cpuT);
          const pct = ((cpuRaw - cur.cpuRaw) / (dtMs * 1e6)) * 100;
          next.cpu = push(cur.cpu, { t: now, value: pct });
        }
        if (cpuRaw !== null) {
          next.cpuRaw = cpuRaw;
          next.cpuT = now;
        }
        if (memory !== null) {
          next.memory = push(cur.memory, { t: now, value: memory });
        }
        const counters = networkCounters(state);
        if (counters) {
          const before = cur.netRaw;
          if (before && counters.rx >= before.rx && counters.tx >= before.tx) {
            const dt = Math.max(1, now - before.t) / 1000;
            next.netRx = push(cur.netRx, { t: now, value: (counters.rx - before.rx) / dt });
            next.netTx = push(cur.netTx, { t: now, value: (counters.tx - before.tx) / dt });
          }
          next.netRaw = { ...counters, t: now };
        }
        const root = state.disk?.root;
        // Incus reports -1 (or omits values) when usage can't be determined.
        if (typeof root?.usage === "number" && root.usage >= 0) {
          next.disk = { usage: root.usage, ...(typeof root.total === "number" && root.total > 0 ? { total: root.total } : {}) };
        }
        return { ...prev, [key]: next };
      });
    } catch {
      // State may be unavailable (stopped instance) — keep the last samples.
    }
  };

  void tick();
  const id = window.setInterval(() => void tick(), POLL_MS);
  pollers.set(key, id);
}

export function stopMetricsPolling(name: string, project?: string): void {
  const key = keyFor(name, project);
  const id = pollers.get(key);
  if (id !== undefined) {
    window.clearInterval(id);
    pollers.delete(key);
  }
}
