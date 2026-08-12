import { validateInstanceName } from "./instance-name";

describe("validateInstanceName", () => {
  it("returns null for valid names", () => {
    expect(validateInstanceName("web1")).toBeNull();
    expect(validateInstanceName("my-instance")).toBeNull();
    expect(validateInstanceName("A-z0-9")).toBeNull();
  });

  it("accepts names up to 63 characters", () => {
    expect(validateInstanceName("a".repeat(63))).toBeNull();
  });

  it("rejects empty and whitespace-only names", () => {
    expect(validateInstanceName("")).toBe("Name is required");
    expect(validateInstanceName("   ")).toBe("Name is required");
  });

  it("rejects names longer than 63 characters", () => {
    expect(validateInstanceName("a".repeat(64))).toBe("Name must be 63 characters or fewer");
  });

  it("rejects characters other than letters, numbers, and hyphens", () => {
    expect(validateInstanceName("web_1")).toBe("Name must contain only letters, numbers, and hyphens");
    expect(validateInstanceName("bad name")).toBe("Name must contain only letters, numbers, and hyphens");
    expect(validateInstanceName("web.1")).toBe("Name must contain only letters, numbers, and hyphens");
  });

  it("rejects names starting with a digit or hyphen", () => {
    expect(validateInstanceName("1web")).toBe("Name must start with a letter");
    expect(validateInstanceName("-web")).toBe("Name must start with a letter");
  });

  it("rejects names ending with a hyphen", () => {
    expect(validateInstanceName("web-")).toBe("Name must not end with a hyphen");
  });
});
