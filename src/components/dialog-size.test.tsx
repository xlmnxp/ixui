import { render, screen } from "@testing-library/react";
import { Dialog } from "./dialog";

describe("Dialog sizes", () => {
  it("defaults to a narrow panel", () => {
    render(<Dialog open onClose={() => {}} title="T">body</Dialog>);
    const panel = screen.getByRole("dialog").querySelector("div.relative");
    expect(panel?.className).toContain("max-w-lg");
  });

  it("supports wide and xl tiers", () => {
    const { unmount } = render(<Dialog open onClose={() => {}} title="T" wide>body</Dialog>);
    expect(screen.getByRole("dialog").querySelector("div.relative")?.className).toContain("max-w-5xl");
    unmount();

    render(<Dialog open onClose={() => {}} title="T" size="xl">body</Dialog>);
    const panel = screen.getByRole("dialog").querySelector("div.relative");
    expect(panel?.className).toContain("max-w-7xl");
    expect(panel?.className).toContain("max-h-[88vh]");
  });
});
