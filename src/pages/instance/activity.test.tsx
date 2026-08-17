import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ActivityTab } from "./activity";
import { activityStore } from "../../state/activity";
import type { ActivityEvent } from "../../state/activity";

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

describe("ActivityTab", () => {
  beforeEach(() => {
    localStorage.clear();
    activityStore.setState([
      event("a", { action: "instance-started", instance: "web1", project: "default", username: "alice" }),
      event("b", { action: "instance-stopped", instance: "web1", project: "default", username: "bob" }),
      event("c", { action: "instance-started", instance: "other", project: "default" }),
      event("d", { action: "instance-started", instance: "web1", project: "prod" }),
    ]);
  });

  const renderTab = (project?: string) =>
    render(
      <MemoryRouter>
        <ActivityTab instanceName="web1" project={project} />
      </MemoryRouter>
    );

  it("shows only events for the instance", async () => {
    renderTab("default");
    expect(await screen.findByText("instance-started")).toBeInTheDocument();
    expect(screen.getByText("instance-stopped")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("prod")).not.toBeInTheDocument();
  });

  it("ignores events from other instances", () => {
    renderTab("default");
    expect(screen.queryAllByText("instance-started")).toHaveLength(1);
  });

  it("filters by project when provided", () => {
    renderTab("prod");
    expect(screen.queryAllByText("instance-started")).toHaveLength(1);
  });

  it("includes same-named instances across projects when no project is given", () => {
    renderTab();
    expect(screen.queryAllByText("instance-started")).toHaveLength(2);
  });

  it("treats a null project (default project sources omit ?project) as default", () => {
    activityStore.setState([
      event("n", { action: "instance-restarted", instance: "web1", project: null, username: "carol" }),
    ]);
    renderTab("default");
    expect(screen.getByText("instance-restarted")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
  });

  it("shows the empty state with no matching events", () => {
    activityStore.setState([]);
    renderTab();
    expect(screen.getByText("No activity recorded")).toBeInTheDocument();
  });
});
