import { render, screen } from "@testing-library/react";
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
});
