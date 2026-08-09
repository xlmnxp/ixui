import { validateConfigKey } from "./config";

describe("validateConfigKey", () => {
  it("accepts valid keys", () => {
    expect(validateConfigKey("limits.memory")).toBeNull();
    expect(validateConfigKey("boot.autostart")).toBeNull();
    expect(validateConfigKey("a1_b-c")).toBeNull();
  });

  it("rejects invalid keys", () => {
    expect(validateConfigKey("Bad Key")).not.toBeNull();
    expect(validateConfigKey("1bad")).not.toBeNull();
    expect(validateConfigKey("")).not.toBeNull();
  });
});
