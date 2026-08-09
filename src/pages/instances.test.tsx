import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InstancesPage } from "./instances";

function instance(name: string, status: string, type = "container") {
  return {
    name, status, type, description: "", created_at: "t", last_used_at: "t",
    config: {}, devices: {}, profiles: ["default"], project: "default", ephemeral: false,
  };
}

vi.mock("../api", () => ({
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      instance("web1", "Started"),
      instance("db1", "Stopped"),
    ]),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  infraApi: { listImages: vi.fn().mockResolvedValue([]), listProfiles: vi.fn().mockResolvedValue([]), listNetworks: vi.fn().mockResolvedValue([]), listPools: vi.fn().mockResolvedValue([]) },
  api: { get: vi.fn() },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
}));

describe("InstancesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists instances with status badges", async () => {
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("db1")).toBeInTheDocument();
  });

  it("starts selected instances", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getByTestId("action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start"));
  });

  it("deletes with confirmation", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getByTestId("action-delete"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.delete).toHaveBeenCalledWith("web1"));
  });

  it("navigates to overview from the row action", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances"]}>
        <Routes>
          <Route path="/instances" element={<InstancesPage />} />
          <Route path="/instances/:name" element={<div data-testid="detail-stub" />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("row-overview-web1"));
    expect(await screen.findByTestId("detail-stub")).toBeInTheDocument();
  });
});
