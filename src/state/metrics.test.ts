import { metricsStore, startMetricsPolling, stopMetricsPolling } from "./metrics";

vi.mock("../api", () => ({
  instancesApi: {
    state: vi.fn().mockResolvedValue({
      status: "Running",
      cpu: { usage: 2_500_000_000 },
      memory: { usage: 536870912 },
    }),
  },
}));

describe("metrics polling", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    stopMetricsPolling("web1", "default");
    metricsStore.setState({});
  });

  it("samples instance state into the ring buffer", async () => {
    startMetricsPolling("web1", "default");
    await vi.waitFor(() => {
      expect(metricsStore.getState()["default/web1"]?.cpu.length).toBeGreaterThan(0);
    });
    const m = metricsStore.getState()["default/web1"]!;
    expect(m.cpu[0]!.value).toBeCloseTo(250);
    expect(m.memory[0]!.value).toBe(536870912);
  });

  it("does not double-poll for the same instance", async () => {
    const { instancesApi } = await import("../api");
    startMetricsPolling("web1", "default");
    startMetricsPolling("web1", "default");
    await vi.waitFor(() => {
      expect(metricsStore.getState()["default/web1"]?.cpu.length).toBeGreaterThan(0);
    });
    expect(instancesApi.state).toHaveBeenCalledTimes(1);
  });
});
