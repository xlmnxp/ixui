import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./projects";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    listProjects: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {} }, { name: "prod", description: "production", config: {} }]),
    createProject: vi.fn().mockResolvedValue(null),
    deleteProject: vi.fn().mockResolvedValue(undefined),
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
});
