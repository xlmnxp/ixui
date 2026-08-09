import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProjectOverview } from "./project-overview";

vi.mock("../api", () => ({
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  clusterApi: { listMembers: vi.fn().mockResolvedValue([]) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
    listPoolVolumes: vi.fn().mockResolvedValue([]),
  },
  api: { get: vi.fn() },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
}));

describe("ProjectOverview", () => {
  it("renders vertical tabs and the default instances tab", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<ProjectOverview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("vertical-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("vtab-images")).toBeInTheDocument();
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
    expect(screen.getByTestId("overview-create")).toBeInTheDocument();
  });

  it("switches tabs via query param", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/?tab=images"]}>
        <Routes>
          <Route path="/" element={<ProjectOverview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("images-page")).toBeInTheDocument();
    await user.click(screen.getByTestId("vtab-instances"));
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
  });
});
