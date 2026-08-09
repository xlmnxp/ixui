import { render, screen } from "@testing-library/react";
import { DashboardPage } from "./dashboard";
import { operationsStore } from "../state/operations";

vi.mock("../api", () => ({
  serverApi: { info: vi.fn().mockResolvedValue({ environment: { server: "host1", server_version: "6.0.0", project: "default" }, api_extensions: [], api_status: "stable", auth: "trusted" }) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([{ fingerprint: "abc", filename: "x.img", description: "", public: true, created_at: "t", size: 100, type: "container", properties: {} }]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    operationsStore.setState([]);
  });

  it("shows server info and resource counts", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("host1")).toBeInTheDocument();
    expect(screen.getByText("Version 6.0.0")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();
  });

  it("shows server info and resource counts as tables", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("host1")).toBeInTheDocument();
    expect(screen.getByText("Version 6.0.0")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-server-table")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-summary-table")).toBeInTheDocument();
    expect(screen.getByText("Storage pools")).toBeInTheDocument();
  });

  it("shows recent operations", () => {
    operationsStore.setState([{ id: "op1", class: "task", description: "Starting db1", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false }]);
    render(<DashboardPage />);
    expect(screen.getByText("Starting db1")).toBeInTheDocument();
  });
});
