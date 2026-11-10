import { render } from "@testing-library/react";
import { CreateInstanceIcon } from "./create-instance-icon";

describe("CreateInstanceIcon", () => {
  it("renders the shared create glyph at the requested size", () => {
    const { container } = render(<CreateInstanceIcon size={15} />);
    const svg = container.querySelector('[data-testid="create-instance-icon"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "15");
    // Rendered through lucide, so it carries the lucide class hooks.
    expect(svg?.getAttribute("class") ?? "").toContain("lucide");
  });
});
