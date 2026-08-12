import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarningsPage } from "./warnings";

vi.mock("../api", () => ({
  warningsApi: {
    list: vi.fn().mockResolvedValue([
      {
        uuid: "w1",
        location: "none",
        node: "",
        project: "default",
        entity_type: "instance",
        entity_id: "web1",
        type: "disk-usage",
        message: "Instance web1 exceeds disk usage",
        status: "New",
        severity: "high",
        first_seen_at: "2026-08-12T08:00:00Z",
        last_seen_at: "2026-08-12T08:30:00Z",
        last_updated_at: "2026-08-12T08:30:00Z",
      },
      {
        uuid: "w2",
        location: "none",
        node: "",
        project: "default",
        entity_type: "instance",
        entity_id: "db1",
        type: "custom",
        message: "Instance db1 is offline",
        status: "Acknowledged",
        severity: "critical",
        first_seen_at: "2026-08-11T08:00:00Z",
        last_seen_at: "2026-08-11T08:30:00Z",
        last_updated_at: "2026-08-11T08:30:00Z",
      },
    ]),
    ack: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("WarningsPage", () => {
  it("lists warnings with severity, entity, and status", async () => {
    render(<WarningsPage />);
    expect(await screen.findByText("Instance web1 exceeds disk usage")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("instance: web1")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
  });

  it("acks a warning and refreshes the list", async () => {
    const user = userEvent.setup();
    const { warningsApi } = await import("../api");
    vi.mocked(warningsApi.list).mockClear();
    render(<WarningsPage />);
    await screen.findByText("Instance web1 exceeds disk usage");
    await user.click(screen.getByTestId("warning-ack-w1"));
    await waitFor(() => expect(warningsApi.ack).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(warningsApi.list).toHaveBeenCalledTimes(2));
  });
});
