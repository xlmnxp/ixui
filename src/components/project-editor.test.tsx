import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectEditor } from "./project-editor";
import type { Project } from "../api/types";
import { currentProjectStore } from "../state/projects";

vi.mock("../api", () => ({
  infraApi: {
    updateProject: vi.fn().mockResolvedValue(null),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: [] }),
  },
}));

const project: Project = { name: "prod", description: "production", config: {} };

describe("ProjectEditor", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    currentProjectStore.setState("default");
  });

  it("checks a feature to set its key to true", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);

    const images = screen.getByTestId("project-feature-images");
    const networks = screen.getByTestId("project-feature-networks");
    const profiles = screen.getByTestId("project-feature-profiles");
    const volumes = screen.getByTestId("project-feature-storage-volumes");
    expect(images).not.toBeChecked();
    expect(networks).not.toBeChecked();
    expect(profiles).not.toBeChecked();
    expect(volumes).not.toBeChecked();

    await user.click(images);
    await user.click(volumes);
    await user.click(screen.getByTestId("project-editor-save"));

    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        config: { "features.images": "true", "features.storage.volumes": "true" },
      })
    );
  });

  it("unchecks a feature to remove its key", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(
      <ProjectEditor
        project={{ ...project, config: { "features.images": "true" } }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    expect(screen.getByTestId("project-feature-images")).toBeChecked();
    await user.click(screen.getByTestId("project-feature-images"));
    await user.click(screen.getByTestId("project-editor-save"));

    await waitFor(() => expect(infraApi.updateProject).toHaveBeenCalledWith("prod", { config: {} }));
  });

  it("renders limits with usage bars for the active project and clamps percentages to 100", async () => {
    currentProjectStore.setState("prod");
    render(
      <ProjectEditor
        project={{
          ...project,
          config: {
            "limits.instances": "5",
            "limits.containers": "10",
            "limits.networks": "2",
            "limits.memory": "4GB",
          },
        }}
        usage={{ "limits.instances": 12, "limits.containers": 2, "limits.networks": 1 }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await waitFor(() => expect(screen.getByTestId("project-limit-instances")).toHaveValue(5));
    expect(screen.getByTestId("project-limit-memory")).toHaveValue("4GB");
    expect(screen.getByTestId("project-limit-cpu")).toHaveValue("");

    const bars = screen
      .getAllByRole("progressbar")
      .map((b) => Number(b.getAttribute("aria-valuenow")))
      .sort((a, b) => a - b);
    expect(bars).toEqual([20, 50, 100]);
    expect(screen.queryByText("Usage shown for the active project")).not.toBeInTheDocument();
    expect(screen.queryAllByText("—")).toHaveLength(0);
  });

  it("shows a dash and a note instead of usage bars for a non-active project", async () => {
    currentProjectStore.setState("default");
    render(
      <ProjectEditor
        project={{ ...project, config: { "limits.instances": "5" } }}
        usage={{ "limits.instances": 3 }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await waitFor(() => expect(screen.getByTestId("project-limit-instances")).toHaveValue(5));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Usage shown for the active project")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("keeps the disk limit input but drops its usage bar", async () => {
    currentProjectStore.setState("prod");
    render(
      <ProjectEditor
        project={{ ...project, config: { "limits.disk": "10GB" } }}
        usage={{ "limits.disk": 5 }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    await waitFor(() => expect(screen.getByTestId("project-limit-disk")).toHaveValue("10GB"));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders restricted toggles with descriptions and flips keys", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);

    const nesting = screen.getByRole("switch", { name: "Container nesting" });
    expect(nesting).not.toBeChecked();
    expect(screen.getByText(/nested containers/i)).toBeInTheDocument();
    expect(screen.getByText(/uplink networks/i)).toBeInTheDocument();

    await user.click(nesting);
    await user.click(screen.getByTestId("project-editor-save"));

    await waitFor(() =>
      expect(infraApi.updateProject).toHaveBeenCalledWith("prod", {
        config: { "restricted.containers.nesting": "true" },
      })
    );
  });

  it("save posts config and invokes onSaved", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);

    await user.click(screen.getByTestId("project-editor-save"));

    await waitFor(() => expect(infraApi.updateProject).toHaveBeenCalledWith("prod", { config: {} }));
    expect(onSaved).toHaveBeenCalled();
  });

  it("cancel closes without saving", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProjectEditor project={project} onClose={onClose} onSaved={onSaved} />);

    await user.click(screen.getByTestId("project-editor-cancel"));

    expect(infraApi.updateProject).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
