import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OverviewTab } from "./instance-overview";
import type { Instance } from "../api/types";
import { metricsStore } from "../state/metrics";

const instance = (type: Instance["type"]): Instance => ({
  name: "web1",
  status: "Running",
  type,
  description: "",
  created_at: "t",
  last_used_at: "t",
  config: {},
  devices: {},
  profiles: ["default"],
  project: "default",
  ephemeral: false,
});

vi.mock("../api", () => ({
  instancesApi: {
    state: vi.fn().mockResolvedValue({
      status: "Running",
      cpu: { usage: 1_000_000_000 },
      memory: { usage: 536870912 },
      network: {
        eth0: {
          addresses: [
            { family: "inet", address: "10.0.0.5", netmask: "24", scope: "global" },
          ],
        },
      },
    }),
  },
  resourcesApi: {
    get: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } }),
    getMemberResources: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } }),
  },
}));

describe("OverviewTab IP addresses", () => {
  it("offers a copy button for each address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<OverviewTab instance={instance("container")} />);
    const copy = await screen.findByTestId("copy-ip-10.0.0.5");
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("10.0.0.5"));
  });
});

describe("OverviewTab chart loading", () => {
  it("renders a placeholder for every chart row before the first sample", () => {
    metricsStore.setState({});
    render(<OverviewTab instance={instance("container")} />);
    // Rows exist immediately instead of popping in later.
    for (const id of ["cpu", "memory", "net-rx", "net-tx", "disk"]) {
      expect(screen.getByTestId("chart-loading-" + id)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Collecting…").length).toBe(5);
  });

  it("stops pulsing and shows a dash when a series never arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      metricsStore.setState({});
      render(<OverviewTab instance={instance("container")} />);
      expect(screen.getByTestId("chart-loading-cpu")).toBeInTheDocument();
      // Network counters and disk usage may never be reported by an instance.
      await act(async () => {
        vi.advanceTimersByTime(16_000);
      });
      expect(screen.queryByTestId("chart-loading-cpu")).not.toBeInTheDocument();
      expect(screen.getByTestId("chart-unavailable-net-rx")).toHaveTextContent("—");
      expect(screen.getByTestId("chart-unavailable-disk")).toHaveTextContent("—");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows dashes immediately for a stopped instance", () => {
    metricsStore.setState({});
    render(<OverviewTab instance={{ ...instance("container"), status: "Stopped" }} />);
    expect(screen.queryByText("Collecting…")).not.toBeInTheDocument();
    expect(screen.getByTestId("chart-unavailable-cpu")).toBeInTheDocument();
  });

  it("replaces the placeholders once samples arrive", async () => {
    metricsStore.setState({
      "default/web1": {
        cpu: [{ at: 1, value: 12.5 }],
        memory: [{ at: 1, value: 1024 }],
        netRx: [{ at: 1, value: 10 }],
        netTx: [{ at: 1, value: 20 }],
        disk: { usage: 1024, total: 4096 },
      },
    } as unknown as Parameters<typeof metricsStore.setState>[0]);
    render(<OverviewTab instance={instance("container")} />);
    await waitFor(() => expect(screen.queryByTestId("chart-loading-cpu")).not.toBeInTheDocument());
    expect(screen.getByTestId("overview-tab")).toHaveTextContent("12.5%");
    metricsStore.setState({});
  });
});

describe("OverviewTab", () => {
  beforeEach(() => metricsStore.setState({}));

  it("renders status and type rows for containers", () => {
    render(<OverviewTab instance={instance("container")} />);
    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
  });

  it("labels virtual machines", () => {
    render(<OverviewTab instance={instance("virtual-machine")} />);
    expect(screen.getByText("Virtual machine")).toBeInTheDocument();
  });

  it("shows disk usage as plain text when no total is known", async () => {
    metricsStore.setState({
      "default/web1": { cpu: [], memory: [], netRx: [], netTx: [], disk: { usage: 1073741824 } },
    });
    render(<OverviewTab instance={instance("container")} />);
    expect(await screen.findByText("1 GiB used")).toBeInTheDocument();
  });

  it("shows live CPU and memory sparklines from the polling buffer", async () => {
    metricsStore.setState({
      "default/web1": {
        cpu: [{ t: 1, value: 20.5 }, { t: 2, value: 40 }],
        memory: [{ t: 1, value: 536870912 }],
        netRx: [{ t: 1, value: 2048 }, { t: 2, value: 4096 }],
        netTx: [{ t: 1, value: 1024 }, { t: 2, value: 1024 }],
        disk: { usage: 1073741824, total: 4294967296 },
      },
    });
    render(<OverviewTab instance={instance("container")} />);
    expect(await screen.findByText("CPU usage")).toBeInTheDocument();
    expect(await screen.findByText("Memory usage")).toBeInTheDocument();
    expect(screen.getAllByTestId("sparkline")).toHaveLength(4);
    expect(screen.getByText("↓ 4 KiB/s")).toBeInTheDocument();
    expect(screen.getByText("1 GiB / 4 GiB")).toBeInTheDocument();
    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("512 MiB / 16 GiB")).toBeInTheDocument();
  });
});
