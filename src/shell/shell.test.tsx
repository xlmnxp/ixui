import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./layout";
import { operationsStore } from "../state/operations";
import { authStore } from "../auth/status";

vi.mock("../api", () => ({
  api: { setForbiddenHandler: vi.fn(), get: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 0 } }) },
  serverApi: { info: vi.fn().mockResolvedValue({ environment: { server: "host1", server_version: "6.0.0", project: "default" }, api_extensions: [], api_status: "stable", auth: "trusted" }) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      { name: "web1", status: "Running", type: "container", description: "", created_at: "t", last_used_at: "t", config: {}, devices: {}, profiles: [], project: "default", location: "incus-1", ephemeral: false },
    ]),
  },
  clusterApi: {
    listMembers: vi.fn().mockResolvedValue([
      { server_name: "incus-1", url: "https://incus-1:8443", database: true, status: "Online", message: "", architecture: "x86_64" },
    ]),
  },
  operationsApi: {
    list: vi.fn().mockResolvedValue([]),
    cancel: vi.fn().mockResolvedValue(undefined),
  },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
  eventsUrl: vi.fn(),
}));

describe("Shell", () => {
  beforeEach(() => {
    operationsStore.setState([]);
    authStore.setState("authenticated");
  });

  it("renders sidebar with project dropdown and tree", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("project-selector")).toBeInTheDocument();
    expect(screen.getByTestId("tree")).toBeInTheDocument();
  });

  it("navigates to instance detail when an instance label is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
            <Route path="instances/:name" element={<div data-testid="instance-detail-page">detail</div>} />
            <Route path="members/:name" element={<div data-testid="member-view">member</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("incus-1")).toBeInTheDocument();
    await user.click(screen.getByTestId("tree-member-incus-1"));
    expect(await screen.findByText("web1")).toBeInTheDocument();
    await user.click(screen.getByText("web1"));
    expect(await screen.findByTestId("instance-detail-page")).toBeInTheDocument();
    await user.click(screen.getByText("incus-1"));
    expect(await screen.findByTestId("member-view")).toBeInTheDocument();
    await act(async () => {});
  });

  it("renders operations in the task log", async () => {
    operationsStore.setState([{ id: "op1", class: "task", description: "Starting web1", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false }]);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Starting web1")).toBeInTheDocument();
    await act(async () => {});
  });

  it("clears finished operations", async () => {
    operationsStore.setState([
      { id: "op1", class: "task", description: "done", status: "Success", status_code: 200, created_at: "t", updated_at: "t", may_cancel: false },
      { id: "op2", class: "task", description: "busy", status: "Running", status_code: 100, created_at: "t", updated_at: "t", may_cancel: false },
    ]);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId("tasklog-clear"));
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("busy")).toBeInTheDocument();
    await act(async () => {});
  });
});

import { App } from "../App";

describe("App", () => {
  it("renders auth screen when forbidden", () => {
    authStore.setState("unauthenticated");
    render(<App />);
    expect(screen.getByTestId("auth-screen")).toBeInTheDocument();
  });

  it("renders shell when authenticated", async () => {
    window.history.pushState({}, "", "/ui/");
    authStore.setState("authenticated");
    render(<App />);
    expect(await screen.findByTestId("shell")).toBeInTheDocument();
    await act(async () => {});
  });

  it("renders the operations page at its route", async () => {
    window.history.pushState({}, "", "/ui/operations");
    authStore.setState("authenticated");
    render(<App />);
    expect(await screen.findByTestId("operations-page")).toBeInTheDocument();
    expect(screen.getByTestId("tree-admin-operations")).toBeInTheDocument();
    await act(async () => {});
  });
});
