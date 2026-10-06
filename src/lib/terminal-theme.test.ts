import { terminalTheme } from "./terminal-theme";

describe("terminalTheme", () => {
  it("keeps the dark background used by the page surface", () => {
    expect(terminalTheme("dark").background).toBe("#191817");
  });

  it("returns a light background with dark text and a readable palette", () => {
    const t = terminalTheme("light");
    expect(t.background).toBe("#f6f5f4");
    expect(t.foreground).toBe("#1f1e1d");
    expect(t.cursor).toBe("#1f1e1d");
    // No near-white text colours on a near-white background.
    expect(t.brightWhite).not.toBe("#ffffff");
    expect(t.white).not.toBe("#e5e5e5");
  });
});
