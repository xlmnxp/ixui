import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DevicesTab } from "./devices";

let devices: Record<string, Record<string, string>> = {
  eth0: { type: "nic", nictype: "bridged", parent: "br0" },
};

vi.mock("../../api", () => ({
  instancesApi: {
    get: vi.fn().mockImplementation(async () => ({
      name: "web1", status: "Stopped", type: "container", description: "",
      created_at: "2026-01-01T00:00:00Z", last_used_at: "2026-01-01T00:00:00Z",
      config: {}, devices, profiles: ["default"], project: "default", ephemeral: false,
    })),
    update: vi.fn().mockImplementation(async (_name: string, body: { devices?: Record<string, Record<string, string>> }) => {
      if (body.devices) devices = body.devices;
      return null;
    }),
  },
}));

describe("DevicesTab", () => {
  afterEach(() => {
    devices = { eth0: { type: "nic", nictype: "bridged", parent: "br0" } };
  });

  it("renders devices with name, type and inline properties", async () => {
    render(<DevicesTab instanceName="web1" />);
    expect(await screen.findByTestId("device-row-eth0")).toBeInTheDocument();
    expect(screen.getByTestId("device-name-eth0")).toHaveTextContent("eth0");
    expect(screen.getByTestId("device-type-eth0")).toHaveTextContent("nic");
    expect(screen.getByTestId("kv-key-nictype")).toHaveTextContent("nictype");
    expect(screen.getByTestId("kv-value-parent")).toHaveTextContent("br0");
  });

  it("shows a validation error for a nic without nictype", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("device-row-eth0");
    await user.click(screen.getByTestId("device-add"));
    await user.type(screen.getByTestId("device-name"), "net1");
    await user.click(screen.getByTestId("device-save"));
    expect(screen.getByTestId("device-error")).toHaveTextContent(/nictype/);
    expect(instancesApi.update).not.toHaveBeenCalled();
  });

  it("validates that disk devices require pool and path", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("device-row-eth0");
    await user.click(screen.getByTestId("device-add"));
    await user.type(screen.getByTestId("device-name"), "disk1");
    await user.selectOptions(screen.getByTestId("device-type"), "disk");
    await user.click(screen.getByTestId("device-save"));
    expect(screen.getByTestId("device-error")).toHaveTextContent(/pool and path/);
    expect(instancesApi.update).not.toHaveBeenCalled();
  });

  it("adds a disk device and saves it via update", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("device-row-eth0");
    await user.click(screen.getByTestId("device-add"));
    const dialog = within(screen.getByTestId("dialog"));
    await user.type(dialog.getByTestId("device-name"), "disk1");
    await user.selectOptions(dialog.getByTestId("device-type"), "disk");
    await user.click(dialog.getByTestId("kv-add-row"));
    await user.type(dialog.getByTestId("kv-key-edit-"), "pool");
    await user.keyboard("{Enter}");
    await user.dblClick(dialog.getByTestId("kv-value-pool"));
    await user.type(dialog.getByTestId("kv-value-edit-pool"), "default");
    await user.keyboard("{Enter}");
    await user.click(dialog.getByTestId("kv-add-row"));
    await user.type(dialog.getByTestId("kv-key-edit-"), "path");
    await user.keyboard("{Enter}");
    await user.dblClick(dialog.getByTestId("kv-value-path"));
    await user.type(dialog.getByTestId("kv-value-edit-path"), "/data");
    await user.keyboard("{Enter}");
    await user.click(screen.getByTestId("device-save"));
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith("web1", {
        devices: {
          eth0: { type: "nic", nictype: "bridged", parent: "br0" },
          disk1: { type: "disk", pool: "default", path: "/data" },
        },
      })
    );
    await waitFor(() => expect(screen.queryByTestId("dialog")).not.toBeInTheDocument());
    expect(await screen.findByTestId("device-row-disk1")).toBeInTheDocument();
  });

  it("edits an existing device through the dialog", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("device-row-eth0");
    await user.click(screen.getByTestId("device-edit-eth0"));
    const dialog = within(screen.getByTestId("dialog"));
    expect(dialog.getByTestId("device-name")).toHaveValue("eth0");
    expect(dialog.getByTestId("device-type")).toHaveValue("nic");
    await user.dblClick(dialog.getByTestId("kv-value-parent"));
    await user.clear(dialog.getByTestId("kv-value-edit-parent"));
    await user.type(dialog.getByTestId("kv-value-edit-parent"), "br1");
    await user.keyboard("{Enter}");
    await user.click(screen.getByTestId("device-save"));
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith("web1", {
        devices: { eth0: { type: "nic", nictype: "bridged", parent: "br1" } },
      })
    );
  });

  it("edits device properties inline and saves via update", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("kv-value-parent");
    await user.dblClick(screen.getByTestId("kv-value-parent"));
    await user.clear(screen.getByTestId("kv-value-edit-parent"));
    await user.type(screen.getByTestId("kv-value-edit-parent"), "br1");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(instancesApi.update).toHaveBeenCalledWith("web1", {
        devices: { eth0: { type: "nic", nictype: "bridged", parent: "br1" } },
      })
    );
  });

  it("removes a device and saves via update", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<DevicesTab instanceName="web1" />);
    await screen.findByTestId("device-row-eth0");
    await user.click(screen.getByTestId("device-remove-eth0"));
    await waitFor(() => expect(instancesApi.update).toHaveBeenCalledWith("web1", { devices: {} }));
    await waitFor(() => expect(screen.queryByTestId("device-row-eth0")).not.toBeInTheDocument());
  });
});
