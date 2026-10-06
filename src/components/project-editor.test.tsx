import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectEditor, configChanges } from "./project-editor";
import type { Project } from "../api/types";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    updateProject: vi.fn().mockResolvedValue(null),
    createProject: vi.fn().mockResolvedValue(null),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: [] }),
  },
}));

const project: Project = { name: "prod", description: "production", config: {} };
type User = ReturnType<typeof userEvent.setup>;

const goto = (user: User, step: string) => user.click(screen.getByTestId(`step-tab-${step}`));
const saveFromReview = async (user: User) => {
  await goto(user, "review");
  await user.click(screen.getByTestId("step-submit"));
};

describe("ProjectEditor (edit)", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => currentProjectStore.setState("default"));

  it("checks a feature to set its key to true and sends the description too", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "features");

    const images = screen.getByTestId("project-feature-images");
    const volumes = screen.getByTestId("project-feature-storage-volumes");
    expect(images).not.toBeChecked();
    await user.click(images);
    await user.click(volumes);
    await saveFromReview(user);

    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        description: "production",
        config: { "features.images": "true", "features.storage.volumes": "true" },
      })
    );
  });

  it("unchecks a feature to remove its key", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={{ ...project, config: { "features.images": "true" } }} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "features");
    expect(screen.getByTestId("project-feature-images")).toBeChecked();
    await user.click(screen.getByTestId("project-feature-images"));
    await saveFromReview(user);
    await waitFor(() => expect(infraApi.updateProject).toHaveBeenCalledWith("prod", { description: "production", config: {} }));
  });

  it("edits the description and keeps the name read-only", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByTestId("project-name")).toBeDisabled();
    await user.clear(screen.getByTestId("project-description"));
    await user.type(screen.getByTestId("project-description"), "live");
    await saveFromReview(user);
    await waitFor(() => expect(infraApi.updateProject).toHaveBeenCalledWith("prod", { description: "live", config: {} }));
    expect(onSaved).toHaveBeenCalled();
  });

  it("renders limits with usage bars for the active project and clamps percentages to 100", async () => {
    currentProjectStore.setState("prod");
    const user = userEvent.setup();
    render(
      <ProjectEditor
        project={{ ...project, config: { "limits.instances": "5", "limits.containers": "10", "limits.networks": "2", "limits.memory": "4GB" } }}
        usage={{ "limits.instances": 12, "limits.containers": 2, "limits.networks": 1 }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    await goto(user, "limits");

    expect(screen.getByTestId("project-limit-instances")).toHaveValue(5);
    expect(screen.getByTestId("project-limit-memory")).toHaveValue("4GB");
    expect(screen.getByTestId("project-limit-cpu")).toHaveValue("");
    const bars = screen.getAllByRole("progressbar").map((b) => Number(b.getAttribute("aria-valuenow"))).sort((a, b) => a - b);
    expect(bars).toEqual([20, 50, 100]);
    expect(screen.queryByText("Usage shown for the active project")).not.toBeInTheDocument();
  });

  it("shows a dash and a note instead of usage bars for a non-active project", async () => {
    currentProjectStore.setState("default");
    const user = userEvent.setup();
    render(<ProjectEditor project={{ ...project, config: { "limits.instances": "5" } }} usage={{ "limits.instances": 3 }} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "limits");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Usage shown for the active project")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps the disk limit input but drops its usage bar", async () => {
    currentProjectStore.setState("prod");
    const user = userEvent.setup();
    render(<ProjectEditor project={{ ...project, config: { "limits.disk": "10GB" } }} usage={{ "limits.disk": 5 }} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "limits");
    expect(screen.getByTestId("project-limit-disk")).toHaveValue("10GB");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders restriction toggles and flips keys", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "restricted");

    const nesting = screen.getByRole("switch", { name: "Container nesting" });
    expect(nesting).not.toBeChecked();
    expect(screen.getByText(/nested containers/i)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Enable restrictions" }));
    await user.click(nesting);
    await saveFromReview(user);

    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        description: "production",
        config: { restricted: "true", "restricted.containers.nesting": "true" },
      })
    );
  });

  it("lists exactly what changed on the review step", async () => {
    const user = userEvent.setup();
    render(<ProjectEditor project={{ ...project, config: { "limits.cpu": "2" } }} onClose={onClose} onSaved={onSaved} />);
    await goto(user, "limits");
    await user.clear(screen.getByTestId("project-limit-cpu"));
    await user.type(screen.getByTestId("project-limit-cpu"), "4");
    await goto(user, "review");
    expect(screen.getByTestId("project-changes")).toHaveTextContent("limits.cpu: 2 → 4");
  });

  it("cancel closes without saving", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);
    await user.click(screen.getByTestId("step-cancel"));
    expect(infraApi.updateProject).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ProjectEditor (create)", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it("requires a valid name before continuing", async () => {
    const user = userEvent.setup();
    render(<ProjectEditor project={null} onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByTestId("step-next")).toBeDisabled();
    await user.type(screen.getByTestId("project-name"), "bad name!");
    expect(screen.getByTestId("step-next")).toBeDisabled();
    expect(screen.getByTestId("step-hint")).toHaveTextContent("Use letters, numbers and dashes only");
    await user.clear(screen.getByTestId("project-name"));
    await user.type(screen.getByTestId("project-name"), "staging");
    expect(screen.getByTestId("step-next")).toBeEnabled();
  });

  it("creates a project with description, features and limits", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={null} onClose={onClose} onSaved={onSaved} />);
    await user.type(screen.getByTestId("project-name"), "staging");
    await user.type(screen.getByTestId("project-description"), "pre-prod");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("project-feature-networks"));
    await user.click(screen.getByTestId("step-next"));
    await user.type(screen.getByTestId("project-limit-instances"), "5");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByTestId("project-changes")).toHaveTextContent("limits.instances: 5");
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() =>
      expect(infraApi.createProject).toHaveBeenCalledWith({
        name: "staging",
        description: "pre-prod",
        config: { "features.networks": "true", "limits.instances": "5" },
      })
    );
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("configChanges", () => {
  it("reports added, removed and changed keys in sorted order", () => {
    expect(configChanges({ a: "1", b: "2" }, { b: "3", c: "4" })).toEqual([
      { key: "a", from: "1", to: undefined },
      { key: "b", from: "2", to: "3" },
      { key: "c", from: undefined, to: "4" },
    ]);
    expect(configChanges({ a: "1" }, { a: "1" })).toEqual([]);
  });
});
