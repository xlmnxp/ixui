import { render, screen } from "@testing-library/react";
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
    }),
  },
  resourcesApi: {
    get: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } }),
    getMemberResources: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } }),
  },
}));

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

  it("shows live CPU and memory sparklines from the polling buffer", async () => {
    metricsStore.setState({
      "default/web1": {
        cpu: [{ t: 1, value: 20.5 }, { t: 2, value: 40 }],
        memory: [{ t: 1, value: 536870912 }],
      },
    });
    render(<OverviewTab instance={instance("container")} />);
    expect(await screen.findByText("CPU usage")).toBeInTheDocument();
    expect(await screen.findByText("Memory usage")).toBeInTheDocument();
    expect(screen.getAllByTestId("sparkline")).toHaveLength(2);
    expect(screen.getByText("40.0%")).toBeInTheDocument();
    expect(screen.getByText("512 MiB / 16 GiB")).toBeInTheDocument();
  });
});
