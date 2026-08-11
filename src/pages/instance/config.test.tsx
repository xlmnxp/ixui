import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigTab } from "./config";
import type { ConfigActions } from "./config";

vi.mock("../../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue({ name: "web1", status: "Stopped", type: "container", description: "old", created_at: "t", last_used_at: "t", config: { "limits.memory": "512MiB" }, devices: {}, profiles: [], project: "default", ephemeral: false }),
    update: vi.fn().mockResolvedValue(null),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: [{ key: "limits.memory", description: "Memory limit" }] }),
  },
}));

function renderTab() {
  let actions: ConfigActions | null = null;
  render(<ConfigTab instanceName="web1" registerActions={(a) => { actions = a; }} />);
  return {
    getActions: () => actions,
  };
}

describe("ConfigTab", () => {
  it("loads config and exposes actions", async () => {
    const { getActions } = renderTab();
    expect(await screen.findByTestId("kv-key-limits.memory")).toHaveTextContent("limits.memory");
    expect(getActions()).not.toBeNull();
    expect(getActions()?.dirty).toBe(false);
    expect(getActions()?.selectedCount).toBe(0);
  });

  it("saves via the exposed action", async () => {
    const { getActions } = renderTab();
    const { instancesApi } = await import("../../api");
    await screen.findByTestId("kv-key-limits.memory");
    await act(async () => { await getActions()?.save(); });
    await waitFor(() => expect(instancesApi.update).toHaveBeenCalledWith("web1", expect.objectContaining({ config: { "limits.memory": "512MiB" }, description: "old" })));
  });

  it("tracks dirty state and cancels", async () => {
    const user = userEvent.setup();
    const { getActions } = renderTab();
    await screen.findByTestId("kv-value-limits.memory");
    await user.dblClick(screen.getByTestId("kv-value-limits.memory"));
    await user.clear(screen.getByTestId("kv-value-edit-limits.memory"));
    await user.type(screen.getByTestId("kv-value-edit-limits.memory"), "1GiB");
    await user.keyboard("{Enter}");
    expect(getActions()?.dirty).toBe(true);
    act(() => { getActions()?.cancel(); });
    expect(screen.getByTestId("kv-value-limits.memory")).toHaveTextContent("512MiB");
    expect(getActions()?.dirty).toBe(false);
  });

  it("renders the description as an editable row and validates keys on save", async () => {
    const user = userEvent.setup();
    const { getActions } = renderTab();
    expect(await screen.findByTestId("kv-value-Description")).toHaveTextContent("old");
    await user.dblClick(screen.getByTestId("kv-value-Description"));
    await user.type(screen.getByTestId("kv-value-edit-__description__"), " server");
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("kv-value-Description")).toHaveTextContent("old server");
    await user.dblClick(screen.getByTestId("kv-key-limits.memory"));
    await user.type(screen.getByTestId("kv-key-edit-limits.memory"), " X");
    await user.keyboard("{Enter}");
    await act(async () => { await getActions()?.save(); });
    expect(screen.getByText(/Key must start with a letter/)).toBeInTheDocument();
  });

  it("deletes selected rows via the exposed action", async () => {
    const user = userEvent.setup();
    const { getActions } = renderTab();
    await screen.findByTestId("kv-check-limits.memory");
    await user.click(screen.getByTestId("kv-check-limits.memory"));
    expect(getActions()?.selectedCount).toBe(1);
    act(() => { getActions()?.removeSelected(); });
    expect(screen.queryByTestId("kv-row-limits.memory")).not.toBeInTheDocument();
  });
});
