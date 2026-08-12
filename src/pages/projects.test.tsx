import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./projects";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    listProjects: vi.fn().mockResolvedValue([
      { name: "default", description: "", config: {} },
      { name: "prod", description: "production", config: { "limits.instances": "2" } },
    ]),
    createProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(null),
    listNetworks: vi.fn().mockResolvedValue([{ name: "br0" }]),
    listPools: vi.fn().mockResolvedValue([{ name: "default" }]),
    listPoolVolumes: vi.fn().mockResolvedValue([{ name: "vol1" }]),
  },
  instancesApi: {
    list: vi.fn().mockResolvedValue([
      { name: "c1", type: "container" },
      { name: "vm1", type: "virtual-machine" },
    ]),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: [] }),
  },
}));

describe("ProjectsPage", () => {
  beforeEach(() => currentProjectStore.setState("default"));

  it("lists projects and marks current", async () => {
    render(<ProjectsPage />);
    expect(await screen.findByText("prod")).toBeInTheDocument();
    expect(screen.getByTestId("project-current")).toHaveTextContent("default");
  });

  it("switches default project", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-set-default-prod"));
    expect(currentProjectStore.getState()).toBe("prod");
  });

  it("creates a project", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-create-open"));
    await user.type(screen.getByTestId("project-name"), "staging");
    await user.click(screen.getByTestId("project-create-submit"));
    await waitFor(() => expect(infraApi.createProject).toHaveBeenCalledWith(expect.objectContaining({ name: "staging" })));
  });

  it("opens the editor from the row action", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    expect(await screen.findByText("Edit project prod")).toBeInTheDocument();
    expect(screen.getByTestId("project-editor-save")).toBeInTheDocument();
  });

  it("edits a project config via the editor", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    await user.click(await screen.findByTestId("project-feature-images"));
    await user.click(screen.getByTestId("project-editor-save"));
    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        config: { "features.images": "true", "limits.instances": "2" },
      })
    );
  });

  it("shows usage bars from live resource counts", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    const bars = (await screen.findAllByRole("progressbar")).map((b) => Number(b.getAttribute("aria-valuenow")));
    expect(bars).toEqual([100]);
  });
});
