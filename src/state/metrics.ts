import { createStore } from "./store";
import { instancesApi } from "../api";

export interface MetricPoint {
  t: number;
  value: number;
}

export interface InstanceMetrics {
  /** CPU usage percent samples (0-100+). */
  cpu: MetricPoint[];
  /** Memory usage samples in bytes. */
  memory: MetricPoint[];
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

/** Poll the instance state every few seconds and append samples to the ring buffer. */
export function startMetricsPolling(name: string, project?: string): void {
  const key = keyFor(name, project);
  if (pollers.has(key)) return;

  const tick = async () => {
    try {
      const state = await instancesApi.state(name, project);
      const cpuPct = typeof state.cpu?.usage === "number" ? (state.cpu.usage / 1e9) * 100 : null;
      const memory = typeof state.memory?.usage === "number" ? state.memory.usage : null;
      const now = Date.now();
      metricsStore.setState((prev) => {
        const cur = prev[key] ?? { cpu: [], memory: [] };
        return {
          ...prev,
          [key]: {
            cpu: cpuPct !== null ? push(cur.cpu, { t: now, value: cpuPct }) : cur.cpu,
            memory: memory !== null ? push(cur.memory, { t: now, value: memory }) : cur.memory,
          },
        };
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
