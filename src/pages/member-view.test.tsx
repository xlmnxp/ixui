import { render, screen } from "@testing-library/react";
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
  it("shows member info and the instances table", async () => {
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("member-view")).toBeInTheDocument();
    expect(screen.getByText("incus-1")).toBeInTheDocument();
    expect(screen.getByText("x86_64")).toBeInTheDocument();
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
