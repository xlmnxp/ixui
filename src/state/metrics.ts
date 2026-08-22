import { createStore } from "./store";
import { instancesApi } from "../api";

export interface MetricPoint {
  t: number;
  value: number;
}

export interface InstanceMetrics {
  /** CPU usage percent samples computed from counter deltas (0-100 per core). */
  cpu: MetricPoint[];
  /** Memory usage samples in bytes. */
  memory: MetricPoint[];
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
        const cur = prev[key] ?? { cpu: [], memory: [] };
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
