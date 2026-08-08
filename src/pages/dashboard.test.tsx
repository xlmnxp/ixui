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
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 8589934592 } }) },
}));

describe("DashboardPage", () => {
  beforeEach(() => operationsStore.setState([]));

  it("shows server info and resource counts", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("host1")).toBeInTheDocument();
    expect(screen.getByText("Version 6.0.0")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();
  });

  it("shows recent operations", () => {
    operationsStore.setState([{ id: "op1", class: "task", description: "Starting db1", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false }]);
    render(<DashboardPage />);
    expect(screen.getByText("Starting db1")).toBeInTheDocument();
  });
});
