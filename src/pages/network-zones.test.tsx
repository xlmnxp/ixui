import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressSetsPage, NetworkZonesPage } from "./network-zones";
import { networkExtrasApi } from "../api";

vi.mock("../api", () => ({
  networkExtrasApi: {
    listZones: vi.fn(),
    listAddressSets: vi.fn(),
    createZone: vi.fn().mockResolvedValue(null),
    updateZone: vi.fn().mockResolvedValue(null),
    deleteZone: vi.fn().mockResolvedValue(undefined),
    createAddressSet: vi.fn().mockResolvedValue(null),
    updateAddressSet: vi.fn().mockResolvedValue(null),
    deleteAddressSet: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("network zones & address sets pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(networkExtrasApi.listZones).mockResolvedValue([{ name: "example.org", description: "main", used_by: ["/1.0/networks/br0"] }]);
    vi.mocked(networkExtrasApi.listAddressSets).mockResolvedValue([{ name: "office", description: "", addresses: ["10.0.0.0/24", "10.1.0.1"], used_by: [] }]);
  });

  it("zones page lists zones and does not load address sets", async () => {
    render(<NetworkZonesPage />);
    expect(await screen.findByText("example.org")).toBeInTheDocument();
    expect(networkExtrasApi.listAddressSets).not.toHaveBeenCalled();
  });

  it("address sets page lists addresses", async () => {
    render(<AddressSetsPage />);
    expect(await screen.findByText("10.0.0.0/24, 10.1.0.1")).toBeInTheDocument();
    expect(networkExtrasApi.listZones).not.toHaveBeenCalled();
  });

  it("registers its create button in the host bar", async () => {
    const registerBar = vi.fn();
    render(<NetworkZonesPage registerBar={registerBar} />);
    await screen.findByText("example.org");
    expect(registerBar).toHaveBeenCalledWith(expect.objectContaining({ title: "Network zones" }));
  });

  it("creates a zone", async () => {
    const user = userEvent.setup();
    render(<NetworkZonesPage />);
    await screen.findByText("example.org");
    await user.click(screen.getByTestId("netobj-create-open"));
    expect(screen.getByTestId("step-next")).toBeDisabled();
    await user.type(screen.getByTestId("netobj-name"), "new.zone");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByTestId("review-list")).toHaveTextContent("new.zone");
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() => expect(networkExtrasApi.createZone).toHaveBeenCalledWith({ name: "new.zone", description: "", config: {} }));
  });

  it("edits an address set's addresses, one per line", async () => {
    const user = userEvent.setup();
    render(<AddressSetsPage />);
    await user.click(await screen.findByTestId("sets-edit-office"));
    await user.click(screen.getByTestId("step-tab-addresses"));
    const box = screen.getByLabelText(/Addresses/);
    await user.clear(box);
    await user.type(box, "192.168.0.0/16{Enter}fd00::/8");
    expect(screen.getByTestId("address-count")).toHaveTextContent("2 addresses");
    await user.click(screen.getByTestId("step-tab-review"));
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() =>
      expect(networkExtrasApi.updateAddressSet).toHaveBeenCalledWith("office", { description: "", addresses: ["192.168.0.0/16", "fd00::/8"] }),
    );
  });

  it("blocks the addresses step while an entry is invalid", async () => {
    const user = userEvent.setup();
    render(<AddressSetsPage />);
    await user.click(await screen.findByTestId("sets-edit-office"));
    await user.click(screen.getByTestId("step-tab-addresses"));
    await user.type(screen.getByLabelText(/Addresses/), "{Enter}999.1.1.1");
    expect(screen.getByTestId("address-count")).toHaveTextContent("1 invalid");
    expect(screen.getByTestId("step-hint")).toHaveTextContent("999.1.1.1");
    expect(screen.getByTestId("step-next")).toBeDisabled();
    expect(screen.getByTestId("step-tab-review")).toBeDisabled();
  });

  it("saves zone settings from the edit steps", async () => {
    const user = userEvent.setup();
    vi.mocked(networkExtrasApi.listZones).mockResolvedValue([{ name: "example.org", description: "main", config: { "dns.nameservers": "ns1" }, used_by: [] }]);
    render(<NetworkZonesPage />);
    await user.click(await screen.findByTestId("zones-edit-example.org"));
    await user.click(screen.getByTestId("step-tab-settings"));
    expect(screen.getByTestId("kv-key-dns.nameservers")).toBeInTheDocument();
    await user.click(screen.getByTestId("step-tab-review"));
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() => expect(networkExtrasApi.updateZone).toHaveBeenCalledWith("example.org", { description: "main", config: { "dns.nameservers": "ns1" } }));
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    render(<NetworkZonesPage />);
    await user.click(await screen.findByTestId("zones-delete-example.org"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deleteZone).toHaveBeenCalledWith("example.org"));
  });
});
