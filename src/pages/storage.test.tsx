import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoragePage } from "./storage";

vi.mock("../api", () => ({
  infraApi: {
    listPools: vi.fn().mockResolvedValue([
      { name: "data", description: "", driver: "zfs", status: "Created", used_by: ["/1.0/instances/db1"] },
      { name: "fast", description: "", driver: "dir", status: "Created", used_by: [] },
    ]),
    createPool: vi.fn().mockResolvedValue(null),
    deletePool: vi.fn().mockResolvedValue(undefined),
  },
  volumesApi: {
    list: vi.fn().mockResolvedValue([{ name: "db1", type: "custom", content_type: "filesystem" }]),
    get: vi.fn().mockResolvedValue({ name: "db1", type: "custom", content_type: "filesystem", config: { size: "10GB" }, created_at: "2026-01-01T00:00:00Z" }),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(null),
    rename: vi.fn().mockResolvedValue(null),
    listSnapshots: vi.fn().mockResolvedValue([
      { name: "snap1", type: "custom", content_type: "filesystem", config: {}, created_at: "2026-01-02T00:00:00Z" },
    ]),
    createSnapshot: vi.fn().mockResolvedValue(null),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
    restoreSnapshot: vi.fn().mockResolvedValue(null),
    uploadIso: vi.fn().mockResolvedValue(null),
  },
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      { name: "vm1", type: "virtual-machine", status: "Running", description: "", created_at: "", last_used_at: "", config: {}, devices: { nic0: { type: "nic" } }, profiles: [], project: "default", ephemeral: false },
    ]),
    update: vi.fn().mockResolvedValue(null),
  },
}));

const openVolumes = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText("data");
  await user.click(screen.getByTestId("pool-volumes-data"));
  await screen.findByTestId("volume-table-data");
};

describe("StoragePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists pools and volumes", async () => {
    render(<StoragePage />);
    expect(await screen.findByText("data")).toBeInTheDocument();
    expect(screen.getByText("zfs")).toBeInTheDocument();
  });

  it("creates a pool", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<StoragePage />);
    await screen.findByText("data");
    await user.click(screen.getByTestId("pool-create-open"));
    await user.type(screen.getByTestId("pool-name"), "fast");
    await user.click(screen.getByTestId("pool-create-submit"));
    await waitFor(() => expect(infraApi.createPool).toHaveBeenCalledWith(expect.objectContaining({ name: "fast", driver: "dir" })));
  });

  it("bulk deletes selected pools", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<StoragePage />);
    await screen.findByText("data");
    const checkboxes = screen.getAllByTestId("row-select");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    await user.click(screen.getByTestId("action-delete"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deletePool).toHaveBeenCalledWith("data"));
    await waitFor(() => expect(infraApi.deletePool).toHaveBeenCalledWith("fast"));
  });

  it("creates a volume", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-create-data"));
    await user.type(screen.getByTestId("volume-name"), "vol2");
    await user.selectOptions(screen.getByTestId("volume-content-type"), "block");
    await user.type(screen.getByTestId("volume-size"), "10GB");
    await user.click(screen.getByTestId("volume-create-submit"));
    await waitFor(() =>
      expect(volumesApi.create).toHaveBeenCalledWith("data", {
        name: "vol2",
        type: "custom",
        content_type: "block",
        config: { size: "10GB" },
      })
    );
  });

  it("renames a volume", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-rename-db1"));
    const input = screen.getByTestId("volume-rename-name");
    await user.clear(input);
    await user.type(input, "db2");
    await user.click(screen.getByTestId("volume-rename-submit"));
    await waitFor(() => expect(volumesApi.rename).toHaveBeenCalledWith("data", "custom", "db1", "db2"));
  });

  it("resizes a volume", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-resize-db1"));
    await user.type(await screen.findByTestId("volume-resize-size"), "20GB");
    await user.click(screen.getByTestId("volume-resize-submit"));
    await waitFor(() => expect(volumesApi.resize).toHaveBeenCalledWith("data", "custom", "db1", "20GB"));
  });

  it("rejects a resize below the current size", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-resize-db1"));
    await user.type(await screen.findByTestId("volume-resize-size"), "5GB");
    await user.click(screen.getByTestId("volume-resize-submit"));
    expect(await screen.findByTestId("resize-error")).toBeInTheDocument();
    expect(volumesApi.resize).not.toHaveBeenCalled();
  });

  it("deletes a volume", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-delete-db1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(volumesApi.delete).toHaveBeenCalledWith("data", "custom", "db1"));
  });

  it("creates a snapshot", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-snapshots-db1"));
    await user.click(await screen.findByTestId("snapshot-create-db1"));
    await user.type(screen.getByTestId("snapshot-name"), "snap2");
    await user.click(screen.getByTestId("snapshot-create-submit"));
    await waitFor(() => expect(volumesApi.createSnapshot).toHaveBeenCalledWith("data", "custom", "db1", "snap2"));
  });

  it("restores a snapshot", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-snapshots-db1"));
    await user.click(await screen.findByTestId("snapshot-restore-db1-snap1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(volumesApi.restoreSnapshot).toHaveBeenCalledWith("data", "custom", "db1", "snap1"));
  });

  it("deletes a snapshot", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-snapshots-db1"));
    await user.click(await screen.findByTestId("snapshot-delete-db1-snap1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(volumesApi.deleteSnapshot).toHaveBeenCalledWith("data", "custom", "db1", "snap1"));
  });

  it("attaches a volume to an instance", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(<StoragePage />);
    await openVolumes(user);
    await user.click(screen.getByTestId("volume-attach-db1"));
    const select = await screen.findByTestId("attach-instance");
    await user.selectOptions(select, "vm1");
    await user.click(screen.getByTestId("volume-attach-submit"));
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith("vm1", {
        devices: expect.objectContaining({
          disk0: { type: "disk", pool: "data", source: "db1", path: "/mnt/db1" },
        }),
      })
    );
  });

  it("imports an ISO into a pool", async () => {
    const user = userEvent.setup();
    const { volumesApi } = await import("../api");
    render(<StoragePage />);
    await screen.findByText("data");
    await user.click(screen.getByTestId("iso-import"));
    await user.selectOptions(screen.getByTestId("iso-pool"), "fast");
    const file = new File(["iso-bytes"], "ubuntu.iso", { type: "application/octet-stream" });
    await user.upload(screen.getByTestId("iso-file"), file);
    await user.click(screen.getByTestId("iso-import-submit"));
    await waitFor(() =>
      expect(volumesApi.create).toHaveBeenCalledWith("fast", { name: "ubuntu", type: "iso", content_type: "iso" })
    );
    await waitFor(() => expect(volumesApi.uploadIso).toHaveBeenCalledWith("fast", "ubuntu", file));
  });
});
