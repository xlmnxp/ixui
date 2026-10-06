import { applyTheme, cycleTheme, resolveTheme, setTheme, themeStore } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setTheme("system");
  });

  it("resolves explicit preferences and falls back to dark for system without matchMedia support", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
  });

  it("follows the OS light preference for system", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn() }));
    expect(resolveTheme("system")).toBe("light");
    vi.unstubAllGlobals();
  });

  it("applies and persists the chosen theme", () => {
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("ixui.ui.theme")).toBe('"light"');
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("cycles system → dark → light → system", () => {
    cycleTheme();
    expect(themeStore.getState()).toBe("dark");
    cycleTheme();
    expect(themeStore.getState()).toBe("light");
    cycleTheme();
    expect(themeStore.getState()).toBe("system");
  });
});
