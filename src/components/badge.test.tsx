import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders label with tone class", () => {
    render(<Badge tone="success">Started</Badge>);
    expect(screen.getByTestId("badge")).toHaveTextContent("Started");
    expect(screen.getByTestId("badge")).toHaveClass("bg-green-500/15");
  });
});
