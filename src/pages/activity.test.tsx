import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ActivityPage } from "./activity";
import { activityStore } from "../state/activity";
import type { ActivityEvent } from "../state/activity";

const event = (id: string, overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id,
  timestamp: "2026-01-01T00:00:00Z",
  receivedAt: 1_700_000_000_000,
  action: "instance-started",
  source: "/1.0/instances/web1",
  instance: "web1",
  project: "default",
  username: "alice",
  address: "10.0.0.5",
  ...overrides,
});

describe("ActivityPage", () => {
  beforeEach(() => {
    localStorage.clear();
    activityStore.setState([
      event("a", { action: "instance-started", instance: "web1", project: "default", username: "alice" }),
      event("b", { action: "instance-deleted", instance: "db1", project: "prod", username: "bob", receivedAt: 1_700_000_000_001 }),
    ]);
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/activity"]}>
        <Routes>
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/instances/:name" element={<div data-testid="detail-stub" />} />
        </Routes>
      </MemoryRouter>
    );

  it("lists recorded events with instance links", async () => {
    renderPage();
    expect(await screen.findByText("instance-started")).toBeInTheDocument();
    expect(screen.getByText("instance-deleted")).toBeInTheDocument();
    expect(screen.getByText("web1")).toBeInTheDocument();
    expect(screen.getByText("db1")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("filters events by instance, action, or user", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("instance-started");
    await user.type(screen.getByTestId("activity-filter"), "db1");
    expect(screen.queryByText("instance-started")).not.toBeInTheDocument();
    expect(screen.getByText("instance-deleted")).toBeInTheDocument();
    await user.clear(screen.getByTestId("activity-filter"));
    await user.type(screen.getByTestId("activity-filter"), "bob");
    expect(screen.getByText("instance-deleted")).toBeInTheDocument();
    expect(screen.queryByText("instance-started")).not.toBeInTheDocument();
  });

  it("clears events after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("instance-started");
    await user.click(screen.getByTestId("activity-clear"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(screen.queryByText("instance-started")).not.toBeInTheDocument());
    expect(screen.getByText("No activity recorded")).toBeInTheDocument();
  });

  it("navigates to the instance from the row link", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("instance-started");
    await user.click(screen.getByTestId("activity-instance-a"));
    expect(await screen.findByTestId("detail-stub")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is recorded", () => {
    activityStore.setState([]);
    renderPage();
    expect(screen.getByText("No activity recorded")).toBeInTheDocument();
  });
});
