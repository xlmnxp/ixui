import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./projects";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    listProjects: vi.fn().mockResolvedValue([
      { name: "default", description: "", config: {} },
      { name: "prod", description: "production", config: { "limits.instances": "2" }, used_by: ["/1.0/instances/web1?project=prod", "/1.0/profiles/default?project=prod"] },
      { name: "scratch", description: "", config: {}, used_by: ["/1.0/profiles/default?project=scratch"] },
    ]),
    createProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(null),
    projectState: vi.fn().mockRejectedValue(new Error("unavailable")),
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
    for (let i = 0; i < 4; i++) await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() => expect(infraApi.createProject).toHaveBeenCalledWith({ name: "staging", description: "", config: {} }));
  });

  it("opens the editor from the row action", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    expect(await screen.findByText("Edit project prod")).toBeInTheDocument();
    expect(screen.getByTestId("step-tab-review")).toBeInTheDocument();
  });

  it("edits a project config via the editor", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    await user.click(await screen.findByTestId("step-tab-features"));
    await user.click(screen.getByTestId("project-feature-images"));
    await user.click(screen.getByTestId("step-tab-review"));
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        description: "production",
        config: { "features.images": "true", "limits.instances": "2" },
      })
    );
  });

  it("shows usage bars from live resource counts", async () => {
    const user = userEvent.setup();
    currentProjectStore.setState("prod");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-edit-prod"));
    await user.click(await screen.findByTestId("step-tab-limits"));
    const bars = (await screen.findAllByRole("progressbar")).map((b) => Number(b.getAttribute("aria-valuenow")));
    expect(bars).toEqual([100]);
  });

  it("uses the project state endpoint for the summary and editor usage", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    vi.mocked(infraApi.projectState).mockImplementation(async (name: string) =>
      name === "prod" ? { resources: { instances: { Limit: 2, Usage: 1 }, memory: { Limit: 2147483648, Usage: 1073741824 } } } : { resources: {} },
    );
    render(<ProjectsPage />);
    await screen.findByText("prod");
    expect(await screen.findByTestId("project-usage-prod")).toHaveTextContent("instances 50%");
    expect(screen.queryByTestId("project-usage-default")).toBeNull();
    await user.click(screen.getByTestId("project-edit-prod"));
    await user.click(await screen.findByTestId("step-tab-limits"));
    expect(await screen.findByText("1 GiB / 2 GiB")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    vi.mocked(infraApi.projectState).mockRejectedValue(new Error("unavailable"));
  });

  it("shows resource counts, ignoring the default profile", async () => {
    render(<ProjectsPage />);
    await screen.findByText("prod");
    expect(screen.getByTestId("project-resources-prod")).toHaveTextContent("1");
    expect(screen.getByTestId("project-resources-scratch")).toHaveTextContent("0");
  });

  it("deletes an empty project only after typing its name", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectsPage />);
    await screen.findByText("scratch");
    await user.click(screen.getByTestId("project-delete-scratch"));
    expect(screen.getByTestId("project-delete-confirm")).toBeDisabled();
    await user.type(screen.getByTestId("project-delete-name"), "scratch");
    await user.click(screen.getByTestId("project-delete-confirm"));
    await waitFor(() => expect(infraApi.deleteProject).toHaveBeenCalledWith("scratch"));
  });

  it("refuses to delete a project that still has resources and lists them", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-delete-prod"));
    expect(screen.getByTestId("project-delete-resources")).toHaveTextContent("instances/web1");
    expect(screen.getByTestId("project-delete-confirm")).toBeDisabled();
    expect(screen.queryByTestId("project-delete-name")).toBeNull();
  });

  it("never allows deleting the default project", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-delete-default"));
    expect(screen.getByText(/can't be deleted/)).toBeInTheDocument();
    expect(screen.getByTestId("project-delete-confirm")).toBeDisabled();
  });

  it("switches away from a deleted current project", async () => {
    const user = userEvent.setup();
    currentProjectStore.setState("scratch");
    render(<ProjectsPage />);
    await screen.findByText("prod");
    await user.click(screen.getByTestId("project-delete-scratch"));
    await user.type(screen.getByTestId("project-delete-name"), "scratch");
    await user.click(screen.getByTestId("project-delete-confirm"));
    await waitFor(() => expect(currentProjectStore.getState()).not.toBe("scratch"));
  });
});
