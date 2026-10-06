import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildLoadBalancer, NetworkLinksDialog } from "./network-links";
import { networkExtrasApi } from "../api";
import type { Network } from "../api/types";

vi.mock("../api", () => ({
  networkExtrasApi: {
    listLoadBalancers: vi.fn(),
    createLoadBalancer: vi.fn().mockResolvedValue(null),
    deleteLoadBalancer: vi.fn().mockResolvedValue(undefined),
    listPeers: vi.fn(),
    createPeer: vi.fn().mockResolvedValue(null),
    deletePeer: vi.fn().mockResolvedValue(undefined),
  },
}));

const net = (type: string): Network => ({ name: "ovn0", description: "", type, managed: true, used_by: [], status: "Created" });

describe("buildLoadBalancer", () => {
  const b = [{ name: "web", address: "10.0.0.2", port: "80" }];
  it("builds a body, dropping blank rows", () => {
    const body = buildLoadBalancer(" 192.0.2.1 ", "d", [...b, { name: "", address: "", port: "" }], [{ protocol: "tcp", listenPort: "80,443", backends: "web" }, { protocol: "udp", listenPort: "", backends: "" }]);
    expect(body).toEqual({
      listen_address: "192.0.2.1",
      description: "d",
      backends: [{ name: "web", target_address: "10.0.0.2", target_port: "80" }],
      ports: [{ protocol: "tcp", listen_port: "80,443", target_backend: ["web"] }],
    });
  });
  it("rejects incomplete or inconsistent input", () => {
    expect(buildLoadBalancer("", "", b, [])).toMatch(/Listen address/);
    expect(buildLoadBalancer("1.1.1.1", "", [{ name: "x", address: "", port: "" }], [])).toMatch(/name and a target/);
    expect(buildLoadBalancer("1.1.1.1", "", b, [{ protocol: "tcp", listenPort: "80", backends: "" }])).toMatch(/at least one/);
    expect(buildLoadBalancer("1.1.1.1", "", b, [{ protocol: "tcp", listenPort: "80", backends: "nope" }])).toMatch(/unknown backend "nope"/);
  });
});

describe("NetworkLinksDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(networkExtrasApi.listLoadBalancers).mockResolvedValue([{ listen_address: "192.0.2.1", description: "", backends: [{ name: "web", target_address: "10.0.0.2" }], ports: [{ protocol: "tcp", listen_port: "80", target_backend: ["web"] }] }]);
    vi.mocked(networkExtrasApi.listPeers).mockResolvedValue([{ name: "p1", description: "", target_project: "prod", target_network: "ovn1", status: "Pending" }]);
  });

  it("lists load balancers and hides peers for non-OVN networks", async () => {
    render(<NetworkLinksDialog network={net("bridge")} onClose={() => {}} />);
    expect(await screen.findByText("192.0.2.1")).toBeInTheDocument();
    expect(screen.getByText("tcp/80")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-peers")).toBeNull();
    expect(networkExtrasApi.listPeers).not.toHaveBeenCalled();
  });

  it("creates a load balancer", async () => {
    const user = userEvent.setup();
    render(<NetworkLinksDialog network={net("ovn")} onClose={() => {}} />);
    await screen.findByText("192.0.2.1");
    await user.click(screen.getByTestId("lb-open"));
    await user.type(screen.getByTestId("lb-listen"), "192.0.2.9");
    await user.type(screen.getByTestId("lb-backend-name-0"), "app");
    await user.type(screen.getByTestId("lb-backend-address-0"), "10.0.0.5");
    await user.type(screen.getByTestId("lb-port-listen-0"), "443");
    await user.type(screen.getByTestId("lb-port-backends-0"), "app");
    await user.click(screen.getByTestId("lb-create-submit"));
    await waitFor(() =>
      expect(networkExtrasApi.createLoadBalancer).toHaveBeenCalledWith("ovn0", {
        listen_address: "192.0.2.9",
        description: "",
        backends: [{ name: "app", target_address: "10.0.0.5" }],
        ports: [{ protocol: "tcp", listen_port: "443", target_backend: ["app"] }],
      }),
    );
  });

  it("manages peers on OVN networks", async () => {
    const user = userEvent.setup();
    render(<NetworkLinksDialog network={net("ovn")} onClose={() => {}} />);
    await screen.findByText("192.0.2.1");
    await user.click(screen.getByTestId("tab-peers"));
    expect(screen.getByText("prod/ovn1")).toBeInTheDocument();
    await user.click(screen.getByTestId("peer-open"));
    await user.type(screen.getByTestId("peer-name"), "p2");
    await user.type(screen.getByTestId("peer-network"), "ovn2");
    await user.click(screen.getByTestId("peer-create-submit"));
    await waitFor(() => expect(networkExtrasApi.createPeer).toHaveBeenCalledWith("ovn0", { name: "p2", target_project: "default", target_network: "ovn2" }));
    await user.click(screen.getByTestId("peer-delete-p1"));
    const confirm = screen.getAllByTestId("dialog").at(-1)!;
    await user.click(within(confirm).getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deletePeer).toHaveBeenCalledWith("ovn0", "p1"));
  });

  it("deletes a load balancer after confirmation", async () => {
    const user = userEvent.setup();
    render(<NetworkLinksDialog network={net("bridge")} onClose={() => {}} />);
    await user.click(await screen.findByTestId("lb-delete-192.0.2.1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deleteLoadBalancer).toHaveBeenCalledWith("ovn0", "192.0.2.1"));
  });
});
