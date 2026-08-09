import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MemberView } from "./member-view";

vi.mock("../api", () => ({
  clusterApi: {
    listMembers: vi.fn().mockResolvedValue([
      { server_name: "incus-1", url: "", database: true, status: "Online", message: "", architecture: "x86_64" },
    ]),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  api: { get: vi.fn() },
}));

describe("MemberView", () => {
  it("shows member info in the overview table", async () => {
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("member-view")).toBeInTheDocument();
    expect(screen.getByTestId("member-header")).toHaveTextContent("incus-1");
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
    const table = screen.getByTestId("kv-table");
    expect(within(table).getByText("incus-1")).toBeInTheDocument();
    expect(within(table).getByText("x86_64")).toBeInTheDocument();
  });

  it("switches to the instances tab", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByTestId("kv-table");
    await user.click(screen.getByTestId("vtab-instances"));
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
    await user.click(screen.getByTestId("vtab-overview"));
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
  });

  it("opens the instances tab from a ?tab=instances deep link", async () => {
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
    render(
      <MemoryRouter initialEntries={["/members/ghost"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Member not found")).toBeInTheDocument();
  });
});
