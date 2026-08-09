import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigTab } from "./config";

vi.mock("../../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue({ name: "web1", status: "Stopped", type: "container", description: "old", created_at: "t", last_used_at: "t", config: { "limits.memory": "512MiB" }, devices: {}, profiles: [], project: "default", ephemeral: false }),
    update: vi.fn().mockResolvedValue(null),
  },
}));

describe("ConfigTab", () => {
  it("loads and saves config", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<ConfigTab instanceName="web1" />);
    expect(await screen.findByTestId("kv-key-limits.memory")).toHaveValue("limits.memory");
    await user.click(screen.getByTestId("config-save"));
    await waitFor(() => expect(instancesApi.update).toHaveBeenCalledWith("web1", expect.objectContaining({ config: { "limits.memory": "512MiB" } })));
  });

  it("validates edited keys on save", async () => {
    const user = userEvent.setup();
    render(<ConfigTab instanceName="web1" />);
    await screen.findByTestId("kv-key-limits.memory");
    await user.type(screen.getByTestId("kv-key-limits.memory"), " X");
    await user.click(screen.getByTestId("config-save"));
    expect(screen.getByText(/Key must start with a letter/)).toBeInTheDocument();
  });
});
