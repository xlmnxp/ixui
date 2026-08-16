import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworksPage } from "./networks";

vi.mock("../api", () => ({
  infraApi: {
    listNetworks: vi.fn().mockResolvedValue([
      { name: "br0", description: "bridge", type: "bridge", managed: true, used_by: ["/1.0/instances/web1"], status: "Created" },
      { name: "lan0", description: "lan", type: "ovn", managed: true, used_by: [], status: "Created" },
      { name: "eth0", description: "uplink", type: "physical", managed: false, used_by: [], status: "Created" },
    ]),
    createNetwork: vi.fn().mockResolvedValue(null),
    updateNetwork: vi.fn().mockResolvedValue(null),
    getNetwork: vi.fn().mockResolvedValue({
      name: "br0",
      description: "bridge",
      type: "bridge",
      managed: true,
      used_by: ["/1.0/instances/web1"],
      status: "Created",
      config: { "bridge.mode": "standard", "ipv4.address": "10.0.0.1/24" },
    }),
    updateNetworkConfig: vi.fn().mockResolvedValue(null),
    deleteNetwork: vi.fn().mockResolvedValue(undefined),
  },
  networkExtrasApi: {
    listLeases: vi.fn().mockResolvedValue([
      { address: "10.0.0.5", hostname: "web1", hwaddr: "00:11:22:33:44:55", type: "static", expires_at: "2027-01-01T00:00:00Z" },
      { address: "10.0.0.6", hostname: "db1", hwaddr: "aa:bb:cc:dd:ee:ff", type: "dynamic", expires_at: "2026-09-01T00:00:00Z" },
    ]),
    listForwards: vi.fn().mockResolvedValue([
      { listen_address: "10.0.0.1", description: "web forward" },
    ]),
    createForward: vi.fn().mockResolvedValue(null),
    deleteForward: vi.fn().mockResolvedValue(undefined),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: { network: { network: { keys: [{ "bridge.mode": { shortdesc: "Bridge mode" } }] } } } }),
  },
}));

describe("NetworksPage", () => {
  it("lists networks", async () => {
    render(<NetworksPage />);
    expect(await screen.findByText("br0")).toBeInTheDocument();
    expect(screen.getByText("bridge")).toBeInTheDocument();
  });

  it("creates a bridge network", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-create-open"));
    await user.type(screen.getByTestId("network-name"), "lan0");
    await user.click(screen.getByTestId("network-create-submit"));
    await waitFor(() => expect(infraApi.createNetwork).toHaveBeenCalledWith(expect.objectContaining({ name: "lan0", type: "bridge" })));
  });

  it("bulk deletes selected networks", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    const checkboxes = screen.getAllByTestId("row-select");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    await user.click(screen.getByTestId("action-delete"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteNetwork).toHaveBeenCalledWith("br0"));
    await waitFor(() => expect(infraApi.deleteNetwork).toHaveBeenCalledWith("lan0"));
  });

  it("saves config and description from the edit dialog", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-edit-br0"));
    expect(await screen.findByTestId("kv-value-ipv4.address")).toHaveTextContent("10.0.0.1/24");
    await user.dblClick(screen.getByTestId("kv-value-ipv4.address"));
    await user.clear(screen.getByTestId("kv-value-edit-ipv4.address"));
    await user.type(screen.getByTestId("kv-value-edit-ipv4.address"), "10.0.0.2/24");
    await user.keyboard("{Enter}");
    await user.click(screen.getByTestId("network-save"));
    await waitFor(() =>
      expect(infraApi.updateNetworkConfig).toHaveBeenCalledWith("br0", {
        description: "bridge",
        config: { "bridge.mode": "standard", "ipv4.address": "10.0.0.2/24" },
      })
    );
  });

  it("renders metadata descriptions in the config editor", async () => {
    const user = userEvent.setup();
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-edit-br0"));
    expect(await screen.findByText("Bridge mode")).toBeInTheDocument();
  });

  it("shows leases for managed networks only", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-leases-br0"));
    expect(await screen.findByTestId("network-leases-table")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.5")).toBeInTheDocument();
    expect(screen.getByText("web1")).toBeInTheDocument();
    expect(screen.getByText("00:11:22:33:44:55")).toBeInTheDocument();
    expect(screen.getByText("static")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01T00:00:00Z")).toBeInTheDocument();
    expect(networkExtrasApi.listLeases).toHaveBeenCalledWith("br0");
    expect(screen.queryByTestId("network-leases-eth0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("network-forwards-eth0")).not.toBeInTheDocument();
  });

  it("creates and deletes a forward", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-forwards-br0"));
    expect(await screen.findByTestId("network-forwards-table")).toBeInTheDocument();
    expect(screen.getByText("web forward")).toBeInTheDocument();

    await user.click(screen.getByTestId("network-forward-open"));
    await user.type(screen.getByTestId("forward-address"), "10.0.0.2");
    await user.type(screen.getByTestId("forward-description"), "db forward");
    await user.click(screen.getByTestId("network-forward-create-submit"));
    await waitFor(() =>
      expect(networkExtrasApi.createForward).toHaveBeenCalledWith("br0", {
        listen_address: "10.0.0.2",
        description: "db forward",
      })
    );

    await user.click(screen.getByTestId("network-forward-delete-10.0.0.1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deleteForward).toHaveBeenCalledWith("br0", "10.0.0.1"));
  });
});
