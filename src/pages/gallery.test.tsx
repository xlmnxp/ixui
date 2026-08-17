import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Gallery } from "./gallery";

describe("Gallery", () => {
  it("renders all sections", () => {
    render(
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>
    );
    expect(screen.getByTestId("gallery")).toBeInTheDocument();
    expect(screen.getByText("Component Gallery")).toBeInTheDocument();
    expect(screen.getAllByTestId("gallery-section").length).toBeGreaterThan(10);
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Table")).toBeInTheDocument();
  });

  it("opens the demo context menu on right-click and closes on select", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("gallery-context-target"));
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByTestId("ctx-demo-stop")).toBeDisabled();
    expect(screen.getByTestId("ctx-demo-move-incus-1")).toBeInTheDocument();
    await user.click(screen.getByTestId("ctx-demo-start"));
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });
});
