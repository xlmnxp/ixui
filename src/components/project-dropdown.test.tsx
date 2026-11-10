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

  it("tints the selected option so it reads in both themes", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));

    const selected = screen.getByTestId("project-option-default");
    expect(selected).toHaveAttribute("aria-selected", "true");
    // A background tint, not just a text colour: the light theme needs a fill.
    expect(selected.className).toContain("bg-accent-600/15");
    expect(selected.className).toContain("text-accent-300");

    const other = screen.getByTestId("project-option-prod");
    expect(other).toHaveAttribute("aria-selected", "false");
    expect(other.className).not.toContain("bg-accent-600/15");
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
