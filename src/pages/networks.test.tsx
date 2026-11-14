import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworksPage } from "./networks";

const NETWORKS = [
  {
    name: "br0",
    description: "bridge",
    type: "bridge",
    managed: true,
    used_by: ["/1.0/instances/web1"],
    status: "Created",
    config: { "bridge.mode": "standard", "ipv4.address": "10.0.0.1/24", "ipv6.address": "none" },
  },
  { name: "lan0", description: "lan", type: "ovn", managed: true, used_by: [], status: "Created", config: { "ipv4.address": "10.20.0.1/24" } },
  { name: "eth0", description: "uplink", type: "physical", managed: false, used_by: [], status: "Created", config: {} },
];

vi.mock("../api", () => ({
  infraApi: {
    listNetworks: vi.fn(async () => NETWORKS),
    createNetwork: vi.fn().mockResolvedValue(null),
    getNetwork: vi.fn(async (name: string) => NETWORKS.find((n) => n.name === name) ?? NETWORKS[0]),
    updateNetworkConfig: vi.fn().mockResolvedValue(null),
    deleteNetwork: vi.fn().mockResolvedValue(undefined),
    setNetworkState: vi.fn().mockResolvedValue(null),
  },
  networkExtrasApi: {
    listLeases: vi.fn(async () => [
      { address: "10.0.0.5", hostname: "web1", hwaddr: "00:11:22:33:44:55", type: "static", expires_at: "2027-01-01T00:00:00Z" },
    ]),
    listForwards: vi.fn(async () => [{ listen_address: "10.0.0.1", description: "web forward" }]),
    createForward: vi.fn().mockResolvedValue(null),
    deleteForward: vi.fn().mockResolvedValue(undefined),
    listLoadBalancers: vi.fn(async () => []),
    listPeers: vi.fn(async () => []),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({
      configs: { network: { network: { keys: [{ "bridge.mode": { shortdesc: "Bridge mode" } }] } } },
    }),
  },
}));

describe("NetworksPage", () => {
  it("lists networks with their prefixes", async () => {
    render(<NetworksPage />);
    expect(await screen.findByText("br0")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1/24")).toBeInTheDocument();
    expect(screen.getByText("10.20.0.1/24")).toBeInTheDocument();
    // A network without an address renders a dash, never "undefined".
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("starts and stops the network from the manage window", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-manage-br0"));
    expect(await screen.findByTestId("network-manage")).toBeInTheDocument();
    await user.click(screen.getByTestId("network-manage-up"));
    await waitFor(() => expect(infraApi.setNetworkState).toHaveBeenCalledWith("br0", "up"));
    await user.click(screen.getByTestId("network-manage-down"));
    await waitFor(() => expect(infraApi.setNetworkState).toHaveBeenCalledWith("br0", "down"));
  });

  it("creates a bridge network", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-create-open"));
    expect(screen.getByTestId("step-next")).toBeDisabled();
    await user.type(screen.getByTestId("network-name"), "lan9");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByTestId("review-list")).toHaveTextContent("lan9");
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() =>
      expect(infraApi.createNetwork).toHaveBeenCalledWith({ name: "lan9", type: "bridge", description: "", config: {} })
    );
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

  it("shows the settings, prefixes and config editor in the manage window", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-manage-br0"));
    expect(await screen.findByTestId("network-prefix-ipv4")).toHaveTextContent("10.0.0.1/24");
    expect(screen.getByTestId("network-prefix-ipv6")).toHaveTextContent("—");
    expect(await screen.findByText("Bridge mode")).toBeInTheDocument();

    await user.dblClick(screen.getByTestId("kv-value-ipv4.address"));
    await user.clear(screen.getByTestId("kv-value-edit-ipv4.address"));
    await user.type(screen.getByTestId("kv-value-edit-ipv4.address"), "10.0.0.2/24");
    await user.keyboard("{Enter}");
    await user.click(screen.getByTestId("network-manage-save"));
    await waitFor(() =>
      expect(infraApi.updateNetworkConfig).toHaveBeenCalledWith("br0", {
        description: "bridge",
        config: { "bridge.mode": "standard", "ipv4.address": "10.0.0.2/24", "ipv6.address": "none" },
      })
    );
  });

  it("lists leases on the Leases tab", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-manage-br0"));
    await user.click(await screen.findByTestId("tab-leases"));
    expect(await screen.findByTestId("network-leases")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.5")).toBeInTheDocument();
    expect(screen.getByText("web1")).toBeInTheDocument();
    expect(networkExtrasApi.listLeases).toHaveBeenCalledWith("br0");
  });

  it("opens load balancers inside the manage window", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("lan0");
    await user.click(screen.getByTestId("network-manage-lan0"));
    await user.click(await screen.findByTestId("tab-links"));
    expect(await screen.findByTestId("network-links")).toBeInTheDocument();
    expect(screen.getByTestId("network-links-panel")).toBeInTheDocument();
    expect(networkExtrasApi.listLoadBalancers).toHaveBeenCalledWith("lan0");
    // Peers only exist on OVN networks.
    expect(screen.getByText("Peers")).toBeInTheDocument();
  });

  it("creates and deletes a forward from the Forwards tab", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<NetworksPage />);
    await screen.findByText("br0");
    await user.click(screen.getByTestId("network-manage-br0"));
    await user.click(await screen.findByTestId("tab-forwards"));
    expect(await screen.findByTestId("network-forwards")).toBeInTheDocument();
    expect(screen.getByText("web forward")).toBeInTheDocument();

    await user.type(screen.getByTestId("network-forward-address"), "10.0.0.2");
    await user.click(screen.getByTestId("network-forward-create"));
    await waitFor(() =>
      expect(networkExtrasApi.createForward).toHaveBeenCalledWith("br0", {
        listen_address: "10.0.0.2",
        description: "",
      })
    );

    await user.click(screen.getByTestId("network-forward-delete-10.0.0.1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deleteForward).toHaveBeenCalledWith("br0", "10.0.0.1"));
  });
});