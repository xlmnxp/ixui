import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2 GiB");
    expect(formatBytes(-1)).toBe("—");
  });
});
