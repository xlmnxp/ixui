import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InstancesPage } from "./instances";
import type { Instance } from "../api/types";

function instance(name: string, status: string, type = "container"): Instance {
  return {
    name, status, type, description: "", created_at: "t", last_used_at: "t",
    config: {}, devices: {}, profiles: ["default"], project: "default", ephemeral: false,
  } as Instance;
}

vi.mock("../api", () => ({
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      instance("web1", "Started"),
      instance("db1", "Stopped"),
    ]),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(null),
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
    // Each row shows the instance icon with its status dot.
    expect(screen.getAllByTestId("instance-icon").length).toBe(2);
  });

  it("shows the project column in all-projects mode", async () => {
    const { instancesApi } = await import("../api");
    vi.mocked(instancesApi.list).mockResolvedValueOnce([
      instance("web1", "Started"),
      { ...instance("db1", "Stopped"), project: "prod" },
    ]);
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getAllByText("default").length).toBeGreaterThan(0);
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
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start", false, "default"));
  });

  it("bulk start fans out to all selected instances", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getAllByTestId("row-select")[1]!);
    await user.click(screen.getByTestId("action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start", false, "default"));
    expect(instancesApi.setState).toHaveBeenCalledWith("db1", "start", false, "default");
  });

  it("bulk stop fans out to selected instances", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getAllByTestId("row-select")[0]!);
    await user.click(screen.getByTestId("action-stop"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "stop", false, "default"));
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
    await waitFor(() => expect(instancesApi.delete).toHaveBeenCalledWith("web1", "default"));
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

  it("opens the copy dialog from the row action", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("row-copy-web1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Copy web1")).toBeInTheDocument();
  });

  it("copies an instance from the row action", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter>
        <InstancesPage />
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("row-copy-web1"));
    await user.type(screen.getByTestId("copy-name"), "web2");
    await user.click(screen.getByTestId("copy-confirm"));
    await waitFor(() => expect(instancesApi.copy).toHaveBeenCalledWith("web1", "web2", { live: false, sourceProject: "default", targetProject: "default" }));
  });
});
