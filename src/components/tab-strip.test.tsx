import { render, screen } from "@testing-library/react";
import { TabStrip } from "./tab-strip";

const base = { onSwitch: () => {}, onClose: () => {}, onReorder: () => {}, onRename: () => {}, onAdd: () => {} };

describe("TabStrip theming", () => {
  const tabs = [
    { id: "a", label: "alpha", icon: "shell" as const },
    { id: "b", label: "beta", icon: "shell" as const, color: "#d29922" },
  ];

  it("styles the active default tab with theme tokens, not a hardcoded dark colour", () => {
    render(<TabStrip {...base} tabs={tabs} activeId="a" />);
    const active = screen.getByTestId("tab-strip-a");
    expect(active.className).toContain("bg-surface-950");
    expect(active.className).toContain("text-text-primary");
    expect(active.style.backgroundColor).toBe("");
    expect(active.outerHTML).not.toMatch(/#191817/i);
  });

  it("has no accent line on the active tab", () => {
    render(<TabStrip {...base} tabs={tabs} activeId="a" />);
    expect(screen.getByTestId("tab-strip-a").className).not.toContain("shadow");
    expect(screen.getByTestId("tab-strip-a").className).not.toContain("accent");
  });

  it("keeps close buttons readable: theme text colours, never white", () => {
    render(<TabStrip {...base} tabs={tabs} activeId="a" />);
    for (const id of ["a", "b"]) {
      const cls = screen.getByTestId(`tab-strip-close-${id}`).className;
      expect(cls).not.toMatch(/text-white/);
      expect(cls).not.toMatch(/\/40/);
      expect(cls).toMatch(/text-text-(secondary|tertiary)/);
    }
    expect(screen.getByTestId("tab-strip-close-a").className).toContain("text-text-secondary");
    expect(screen.getByTestId("tab-strip-close-b").className).toContain("text-text-tertiary");
  });

  it("tints custom-coloured tabs translucently so text stays legible", () => {
    render(<TabStrip {...base} tabs={tabs} activeId="b" />);
    expect(screen.getByTestId("tab-strip-b").style.backgroundColor).toContain("rgba(210, 153, 34, 0.45)");
  });
});
