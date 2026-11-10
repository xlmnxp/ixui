import { render } from "@testing-library/react";
import { CollapseAllIcon } from "./collapse-all-icon";

describe("CollapseAllIcon", () => {
  it("renders the square-with-chevron glyph at the requested size", () => {
    const { container } = render(<CollapseAllIcon size={13} />);
    const svg = container.querySelector('[data-testid="collapse-all-icon"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "13");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // rounded square + top rule + chevron pointing up at it
    expect(svg?.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });
});
