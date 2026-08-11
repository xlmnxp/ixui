import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworksPage } from "./networks";

vi.mock("../api", () => ({
  infraApi: {
    listNetworks: vi.fn().mockResolvedValue([
      { name: "br0", description: "bridge", type: "bridge", managed: true, used_by: ["/1.0/instances/web1"], status: "Created" },
      { name: "lan0", description: "lan", type: "ovn", managed: true, used_by: [], status: "Created" },
    ]),
    createNetwork: vi.fn().mockResolvedValue(null),
    updateNetwork: vi.fn().mockResolvedValue(null),
    deleteNetwork: vi.fn().mockResolvedValue(undefined),
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
});
