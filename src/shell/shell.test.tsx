import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./layout";
import { operationsStore } from "../state/operations";
import { authStore } from "../auth/status";

vi.mock("../api", () => ({
  api: { setForbiddenHandler: vi.fn() },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
  eventsUrl: vi.fn(),
}));

describe("Shell", () => {
  beforeEach(() => {
    operationsStore.setState([]);
    authStore.setState("authenticated");
  });

  it("renders sidebar, top bar, and task log", async () => {
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
    expect(screen.getByTestId("top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("task-log")).toBeInTheDocument();
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
});
