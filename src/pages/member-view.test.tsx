import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MemberView } from "./member-view";
import { clusterApi, resourcesApi } from "../api";

const onlineMember = { server_name: "incus-1", url: "", database: true, status: "Online", message: "", architecture: "x86_64" };
const evacuatedMember = { server_name: "incus-1", url: "", database: true, status: "Evacuated", message: "", architecture: "x86_64" };

vi.mock("../api", () => ({
  clusterApi: {
    listMembers: vi.fn(),
    setMemberState: vi.fn().mockResolvedValue(null),
    listGroups: vi.fn().mockResolvedValue([{ name: "g1", description: "web", nodes: [] }]),
    createJoinToken: vi.fn().mockResolvedValue({ token: "TOK123" }),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  resourcesApi: {
    getMemberResources: vi.fn().mockResolvedValue({ cpu: { total: 8 }, memory: { total: 17179869184, used: 4294967296 } }),
  },
  api: { get: vi.fn() },
}));

function renderMember(status: string) {
  vi.mocked(clusterApi.listMembers).mockResolvedValue([{ ...onlineMember, status }]);
  render(
    <MemoryRouter initialEntries={["/members/incus-1"]}>
      <Routes>
        <Route path="/members/:name" element={<MemberView />} />
      </Routes>
    </MemoryRouter>
  );
  return screen.findByTestId("member-header");
}

describe("MemberView", () => {
  it("shows member info in the overview table", async () => {
    await renderMember("Online");
    expect(screen.getByTestId("member-header")).toHaveTextContent("incus-1");
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
    const table = screen.getByTestId("kv-table");
    expect(within(table).getByText("incus-1")).toBeInTheDocument();
    expect(within(table).getByText("x86_64")).toBeInTheDocument();
  });

  it("switches to the instances tab", async () => {
    const user = userEvent.setup();
    await renderMember("Online");
    await user.click(screen.getByTestId("vtab-instances"));
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
    await user.click(screen.getByTestId("vtab-overview"));
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
  });

  it("opens the instances tab from a ?tab=instances deep link", async () => {
    vi.mocked(clusterApi.listMembers).mockResolvedValue([onlineMember]);
    render(
      <MemoryRouter initialEntries={["/members/incus-1?tab=instances"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("instances-page")).toBeInTheDocument();
  });

  it("shows not found for unknown members", async () => {
    vi.mocked(clusterApi.listMembers).mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={["/members/ghost"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Member not found")).toBeInTheDocument();
  });

  it("shows evacuate for online members and restores after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(clusterApi.listMembers)
      .mockResolvedValueOnce([onlineMember])
      .mockResolvedValue([evacuatedMember]);
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId("member-evacuate");
    expect(screen.queryByTestId("member-restore")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("member-evacuate"));
    expect(screen.getByTestId("dialog")).toHaveTextContent("Evacuate member incus-1");
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(clusterApi.setMemberState).toHaveBeenCalledWith("incus-1", "evacuate");
    expect(await screen.findByTestId("member-restore")).toBeInTheDocument();
    expect(screen.queryByTestId("member-evacuate")).not.toBeInTheDocument();
  });

  it("shows restore for evacuated members and restores after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(clusterApi.listMembers)
      .mockResolvedValueOnce([evacuatedMember])
      .mockResolvedValue([onlineMember]);
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId("member-restore");
    expect(screen.queryByTestId("member-evacuate")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("member-restore"));
    expect(screen.getByTestId("dialog")).toHaveTextContent("Restore member incus-1");
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(clusterApi.setMemberState).toHaveBeenCalledWith("incus-1", "restore");
    expect(await screen.findByTestId("member-evacuate")).toBeInTheDocument();
  });

  it("creates a join token with selected groups and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderMember("Online");
    await user.click(screen.getByTestId("member-join-token"));
    const dialog = screen.getByTestId("dialog");
    expect(within(dialog).getByDisplayValue("incus-1")).toBeInTheDocument();
    await user.click(within(dialog).getByTestId("token-group-g1"));
    await user.click(within(dialog).getByTestId("token-submit"));
    expect(clusterApi.createJoinToken).toHaveBeenCalledWith("incus-1", ["g1"]);
    expect(await within(dialog).findByTestId("token-value")).toHaveTextContent("TOK123");
    await user.click(within(dialog).getByTestId("token-copy"));
    expect(writeText).toHaveBeenCalledWith("TOK123");
  });

  it("renders member capacity from resources", async () => {
    await renderMember("Online");
    const capacity = await screen.findByTestId("member-capacity");
    expect(within(capacity).getByText("8")).toBeInTheDocument();
    expect(within(capacity).getByText("16 GiB")).toBeInTheDocument();
    expect(within(capacity).getByText("4 GiB")).toBeInTheDocument();
  });

  it("falls back to dashes when capacity fails to load", async () => {
    vi.mocked(resourcesApi.getMemberResources).mockRejectedValueOnce(new Error("nope"));
    await renderMember("Online");
    const capacity = await screen.findByTestId("member-capacity");
    expect(within(capacity).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
