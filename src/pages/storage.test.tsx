import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoragePage } from "./storage";

vi.mock("../api", () => ({
  infraApi: {
    listPools: vi.fn().mockResolvedValue([{ name: "data", description: "", driver: "zfs", status: "Created", used_by: ["/1.0/instances/db1"] }]),
    listPoolVolumes: vi.fn().mockResolvedValue([{ name: "db1", type: "container", content_type: "filesystem" }]),
    createPool: vi.fn().mockResolvedValue(null),
    deletePool: vi.fn().mockResolvedValue(undefined),
    deletePoolVolume: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("StoragePage", () => {
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
});
