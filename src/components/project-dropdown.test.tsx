import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDropdown } from "./project-dropdown";
import { projectsStore, currentProjectStore } from "../state/projects";

describe("ProjectDropdown", () => {
  beforeEach(() => {
    projectsStore.setState([
      { name: "default", description: "", config: {} },
      { name: "prod", description: "", config: {} },
    ]);
    currentProjectStore.setState("default");
  });

  it("shows the current project", () => {
    render(<ProjectDropdown />);
    expect(screen.getByTestId("project-selector")).toHaveTextContent("default");
  });

  it("shows all projects and switches to it", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));
    expect(screen.getByTestId("project-option-all")).toBeInTheDocument();
    await user.click(screen.getByTestId("project-option-all"));
    expect(currentProjectStore.getState()).toBe("all");
    expect(screen.getByTestId("project-selector")).toHaveTextContent("All projects");
  });

  it("opens the menu and switches project", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));
    await user.click(screen.getByTestId("project-option-prod"));
    expect(currentProjectStore.getState()).toBe("prod");
    expect(screen.getByTestId("project-selector")).toHaveTextContent("prod");
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));
    expect(screen.getByTestId("project-menu")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByTestId("project-menu")).not.toBeInTheDocument();
  });
});
