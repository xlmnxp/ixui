import { render } from "@testing-library/react";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders a baseline for fewer than two points", () => {
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector("line")).toBeInTheDocument();
    expect(container.querySelector("polyline")).not.toBeInTheDocument();
  });

  it("draws a polyline and area for samples", () => {
    const { container } = render(<Sparkline points={[1, 2, 3, 1]} />);
    const line = container.querySelector("polyline");
    expect(line).toBeInTheDocument();
    expect(line?.getAttribute("points")).toContain("53.3");
    expect(container.querySelector("polygon")).toBeInTheDocument();
  });

  it("can render without the area fill", () => {
    const { container } = render(<Sparkline points={[1, 2]} fill={false} />);
    expect(container.querySelector("polygon")).not.toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });
});
