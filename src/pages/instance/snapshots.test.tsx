import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnapshotsTab } from "./snapshots";

function snapshot(name: string) {
  return { name, status: "Stopped", type: "container", description: "", created_at: "2026-01-01T00:00:00Z", last_used_at: "", config: {}, devices: {}, profiles: [], project: "default", ephemeral: false };
}

function renderTab() {
  const actions: { create: () => void }[] = [];
  const view = render(<SnapshotsTab instanceName="web1" registerActions={(a) => { if (a) actions.push(a); }} />);
  return { actions, ...view };
}

vi.mock("../../api", () => ({
  instancesApi: {
    listSnapshots: vi.fn().mockResolvedValue([snapshot("snap1"), snapshot("snap2")]),
    createSnapshot: vi.fn().mockResolvedValue(null),
    restoreSnapshot: vi.fn().mockResolvedValue(null),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("SnapshotsTab", () => {
  it("lists snapshots", async () => {
    render(<SnapshotsTab instanceName="web1" />);
    expect(await screen.findByText("snap1")).toBeInTheDocument();
    expect(screen.getByText("snap2")).toBeInTheDocument();
  });

  it("creates a snapshot via the bar action", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    const { actions } = renderTab();
    await screen.findByText("snap1");
    act(() => actions[0]!.create());
    await user.type(screen.getByTestId("snap-name"), "backup");
    await user.click(screen.getByTestId("snap-create-submit"));
    await waitFor(() => expect(instancesApi.createSnapshot).toHaveBeenCalledWith("web1", "backup", false));
  });

  it("restores with confirmation", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByText("snap1");
    await user.click(screen.getByTestId(`snap-restore-snap1`));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.restoreSnapshot).toHaveBeenCalledWith("web1", "snap1"));
  });
});
