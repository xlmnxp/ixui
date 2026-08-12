import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClusterGroupsPage } from "./cluster-groups";
import { clusterApi } from "../api";

const groups = [
  { name: "g1", description: "web group", members: ["incus-1", "incus-2"] },
  { name: "g2", description: "", members: [] },
];

vi.mock("../api", () => ({
  clusterApi: {
    listGroups: vi.fn(),
    createGroup: vi.fn().mockResolvedValue(null),
    updateGroup: vi.fn().mockResolvedValue(null),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("ClusterGroupsPage", () => {
  beforeEach(() => {
    vi.mocked(clusterApi.listGroups).mockResolvedValue(groups);
  });

  it("renders groups with name, description and members", async () => {
    render(<ClusterGroupsPage />);
    expect(await screen.findByTestId("cluster-groups-page")).toBeInTheDocument();
    expect(screen.getByText("g1")).toBeInTheDocument();
    expect(screen.getByText("web group")).toBeInTheDocument();
    expect(screen.getByText("incus-1, incus-2")).toBeInTheDocument();
    expect(screen.getByText("g2")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("creates a group via the create dialog", async () => {
    const user = userEvent.setup();
    render(<ClusterGroupsPage />);
    await screen.findByTestId("cluster-groups-page");
    await user.click(screen.getByTestId("group-create-open"));
    const dialog = screen.getByTestId("dialog");
    await user.type(within(dialog).getByTestId("group-name"), "g3");
    await user.type(within(dialog).getByTestId("group-desc"), "storage");
    await user.click(within(dialog).getByTestId("group-create-submit"));
    expect(clusterApi.createGroup).toHaveBeenCalledWith({ name: "g3", description: "storage" });
  });

  it("edits a group description via the edit dialog", async () => {
    const user = userEvent.setup();
    render(<ClusterGroupsPage />);
    await screen.findByTestId("cluster-groups-page");
    await user.click(screen.getByTestId("group-edit-g1"));
    const dialog = screen.getByTestId("dialog");
    const desc = within(dialog).getByTestId("group-edit-desc");
    await user.clear(desc);
    await user.type(desc, "web servers");
    await user.click(within(dialog).getByTestId("group-save"));
    expect(clusterApi.updateGroup).toHaveBeenCalledWith("g1", { description: "web servers" });
  });

  it("deletes a group after confirmation", async () => {
    const user = userEvent.setup();
    render(<ClusterGroupsPage />);
    await screen.findByTestId("cluster-groups-page");
    await user.click(screen.getByTestId("group-delete-g2"));
    expect(screen.getByTestId("dialog")).toHaveTextContent("Delete group g2");
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(clusterApi.deleteGroup).toHaveBeenCalledWith("g2");
  });
});
