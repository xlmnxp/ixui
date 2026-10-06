import { APP_VERSION, versionLabel, versionTitle } from "./version";

describe("version", () => {
  it("exposes the package version baked in at build time", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(versionLabel()).toBe(`v${APP_VERSION}`);
  });

  it("includes the commit in the tooltip when known", () => {
    expect(versionTitle()).toContain(versionLabel());
  });
});
