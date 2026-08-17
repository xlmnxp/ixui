import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnapshotsTab } from "./snapshots";
import type { Instance } from "../../api/types";

function snapshot(name: string) {
  return { name, status: "Stopped", type: "container", description: "", created_at: "2026-01-01T00:00:00Z", last_used_at: "", config: {}, devices: {}, profiles: [], project: "default", ephemeral: false };
}

function renderTab() {
  const actions: { create: () => void }[] = [];
  const view = render(<SnapshotsTab instanceName="web1" registerActions={(a) => { if (a) actions.push(a); }} />);
  return { actions, ...view };
}

vi.mock("../../api", () => {
  const get = vi.fn().mockResolvedValue({ ...snapshot("web1"), config: { "snapshots.schedule": "@daily", "snapshots.expiry": "1d" } });
  const update = vi.fn().mockResolvedValue(null);
  const mergeUpdate = vi.fn().mockImplementation(async (name: string, changes: { config?: Record<string, string>; devices?: Record<string, Record<string, string>>; profiles?: string[]; ephemeral?: boolean; description?: string }, project?: string) => {
    const current = await get(name, project);
    await update(name, {
      config: changes.config ?? current.config,
      description: changes.description ?? current.description,
      ephemeral: changes.ephemeral ?? current.ephemeral,
      devices: changes.devices ?? current.devices,
      profiles: changes.profiles ?? current.profiles,
    }, project);
    return null;
  });
  return {
    instancesApi: {
      listSnapshots: vi.fn().mockResolvedValue([snapshot("snap1"), snapshot("snap2")]),
      createSnapshot: vi.fn().mockResolvedValue(null),
      restoreSnapshot: vi.fn().mockResolvedValue(null),
      deleteSnapshot: vi.fn().mockResolvedValue(undefined),
      get,
      update,
      mergeUpdate,
    },
    serverApi: { metadata: vi.fn().mockResolvedValue({ configs: {} }) },
  };
});

describe("SnapshotsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists snapshots", async () => {
    render(<SnapshotsTab instanceName="web1" />);
    expect(await screen.findByText("snap1")).toBeInTheDocument();
    expect(screen.getByText("snap2")).toBeInTheDocument();
  });

  it("edits snapshots.schedule and snapshots.expiry", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByTestId("schedule-input");
    await user.clear(screen.getByTestId("schedule-input"));
    await user.type(screen.getByTestId("schedule-input"), "0 3 * * *");
    await user.clear(screen.getByTestId("expiry-input"));
    await user.type(screen.getByTestId("expiry-input"), "7d");
    await user.click(screen.getByTestId("schedule-save"));
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith(
        "web1",
        expect.objectContaining({ config: expect.objectContaining({ "snapshots.schedule": "0 3 * * *", "snapshots.expiry": "7d" }) }),
        undefined
      )
    );
  });

  it("enables automatic snapshots from the toggle", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    vi.mocked(instancesApi.get).mockResolvedValueOnce({ ...snapshot("web1"), config: {} } as Instance);
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByTestId("snapshot-schedule");
    expect(screen.queryByTestId("schedule-input")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("schedule-enable"));
    expect(screen.getByTestId("schedule-input")).toBeInTheDocument();
    await user.type(screen.getByTestId("schedule-input"), "@weekly");
    await user.click(screen.getByTestId("schedule-save"));
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith(
        "web1",
        expect.objectContaining({ config: expect.objectContaining({ "snapshots.schedule": "@weekly" }) }),
        undefined
      )
    );
  });

  it("disables automatic snapshots when toggled off", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByTestId("schedule-input");
    await user.click(screen.getByTestId("schedule-enable"));
    expect(screen.queryByTestId("schedule-input")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("schedule-save"));
    await waitFor(() => expect(instancesApi.update).toHaveBeenCalled());
    const [, body] = vi.mocked(instancesApi.update).mock.calls[0]!;
    const config = (body as { config?: Record<string, string> }).config;
    expect(config).not.toHaveProperty("snapshots.schedule");
    expect(config).not.toHaveProperty("snapshots.expiry");
  });

  it("creates a snapshot via the bar action", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    const { actions } = renderTab();
    await screen.findByText("snap1");
    act(() => actions[0]!.create());
    await user.type(screen.getByTestId("snap-name"), "backup");
    await user.click(screen.getByTestId("snap-create-submit"));
    await waitFor(() => expect(instancesApi.createSnapshot).toHaveBeenCalledWith("web1", "backup", false, undefined));
  });

  it("restores with confirmation", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<SnapshotsTab instanceName="web1" />);
    await screen.findByText("snap1");
    await user.click(screen.getByTestId(`snap-restore-snap1`));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.restoreSnapshot).toHaveBeenCalledWith("web1", "snap1", undefined));
  });
});
