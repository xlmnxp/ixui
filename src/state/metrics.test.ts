import { metricsStore, startMetricsPolling, stopMetricsPolling } from "./metrics";

let calls = 0;

vi.mock("../api", () => ({
  instancesApi: {
    state: vi.fn().mockImplementation(async () => {
      calls += 1;
      return { status: "Running", cpu: { usage: calls * 1_000_000_000 }, memory: { usage: 536870912 } };
    }),
  },
}));

describe("metrics polling", () => {
  beforeEach(() => {
    calls = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopMetricsPolling("web1", "default");
    metricsStore.setState({});
    vi.useRealTimers();
  });

  it("derives cpu percent from counter deltas and samples memory", async () => {
    startMetricsPolling("web1", "default");
    await vi.advanceTimersByTimeAsync(0); // initial tick (baseline)
    await vi.advanceTimersByTimeAsync(5000); // second sample
    const m = metricsStore.getState()["default/web1"]!;
    expect(m.cpu.length).toBe(1);
    expect(m.cpu[0]!.value).toBeCloseTo(20); // 1e9 ns over 5 s = 20%
    expect(m.memory.length).toBe(2);
    expect(m.memory[0]!.value).toBe(536870912);
  });

  it("does not double-poll for the same instance", async () => {
    const { instancesApi } = await import("../api");
    startMetricsPolling("web1", "default");
    startMetricsPolling("web1", "default");
    await vi.advanceTimersByTimeAsync(0);
    expect(instancesApi.state).toHaveBeenCalledTimes(1);
  });
});

describe("metrics network and disk", () => {
  afterEach(() => {
    stopMetricsPolling("net1", "default");
    metricsStore.setState({});
    vi.useRealTimers();
  });

  it("derives throughput from counters (ignoring lo) and records disk usage", async () => {
    vi.useFakeTimers();
    const { instancesApi } = await import("../api");
    let n = 0;
    vi.mocked(instancesApi.state).mockImplementation(async () => {
      n += 1;
      return {
        status: "Running",
        cpu: { usage: 0 },
        memory: { usage: 1 },
        network: {
          lo: { addresses: [], counters: { bytes_received: 9e9, bytes_sent: 9e9 } },
          eth0: { addresses: [], counters: { bytes_received: n * 5000, bytes_sent: n * 1000 } },
        },
        disk: { root: { usage: 100, total: 400 } },
      } as never;
    });
    startMetricsPolling("net1", "default");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    const m = metricsStore.getState()["default/net1"]!;
    expect(m.netRx[0]!.value).toBeCloseTo(1000); // 5000 B over 5 s
    expect(m.netTx[0]!.value).toBeCloseTo(200);
    expect(m.disk).toEqual({ usage: 100, total: 400 });
  });

  it("keeps disk usage when no total is reported and ignores negative usage", async () => {
    vi.useFakeTimers();
    const { instancesApi } = await import("../api");
    vi.mocked(instancesApi.state).mockResolvedValueOnce({ status: "Running", cpu: { usage: 0 }, memory: { usage: 1 }, disk: { root: { usage: 2048, total: 0 } } } as never);
    startMetricsPolling("net1", "default");
    await vi.advanceTimersByTimeAsync(0);
    expect(metricsStore.getState()["default/net1"]!.disk).toEqual({ usage: 2048 });
    vi.mocked(instancesApi.state).mockResolvedValue({ status: "Running", cpu: { usage: 0 }, memory: { usage: 1 }, disk: { root: { usage: -1 } } } as never);
    await vi.advanceTimersByTimeAsync(5000);
    expect(metricsStore.getState()["default/net1"]!.disk).toEqual({ usage: 2048 });
  });
});
