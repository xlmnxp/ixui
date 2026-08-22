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
