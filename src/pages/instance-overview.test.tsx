import { render, screen } from "@testing-library/react";
import { OverviewTab } from "./instance-overview";
import type { Instance } from "../api/types";

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
    state: vi.fn().mockResolvedValue(null),
  },
}));

describe("OverviewTab", () => {
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
});
