import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { InstanceDetailPage } from "./instance-detail";

function instance() {
  return {
    name: "web1", status: "Stopped", type: "container", description: "web server",
    created_at: "2026-01-01T00:00:00Z", last_used_at: "2026-01-02T00:00:00Z",
    config: { "limits.memory": "512MiB", "limits.cpu": "2" }, devices: {}, profiles: ["default"],
    project: "default", ephemeral: false,
  };
}

vi.mock("../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue(instance()),
    state: vi.fn().mockResolvedValue({ status: "Stopped", cpu: { usage: 0 }, memory: { usage: 0 }, network: { eth0: { addresses: [] } } }),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  infraApi: { listImages: vi.fn().mockResolvedValue([]), listProfiles: vi.fn().mockResolvedValue([]), listNetworks: vi.fn().mockResolvedValue([]), listPools: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn() },
}));

describe("InstanceDetailPage", () => {
  it("shows instance overview", async () => {
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("web server")).toBeInTheDocument();
    expect(screen.getByText("512MiB")).toBeInTheDocument();
  });

  it("switches tabs", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("vtab-config"));
    expect(screen.getByTestId("config-tab")).toBeInTheDocument();
  });

  it("starts the instance from the header", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start"));
  });
});
