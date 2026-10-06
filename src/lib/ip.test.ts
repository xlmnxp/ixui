import { isValidAddressOrCidr } from "./ip";

describe("isValidAddressOrCidr", () => {
  it.each(["10.0.0.1", "10.0.0.0/24", "192.168.1.255/32", "fd00::/8", "2001:db8::1", "::1", "::ffff:10.0.0.1"])("accepts %s", (v) => {
    expect(isValidAddressOrCidr(v)).toBe(true);
  });
  it.each(["", "10.0.0", "10.0.0.256", "10.0.0.0/33", "fd00::/129", "10.0.0.0/", "10.0.0.0/a", "1.2.3.4/5/6", "hello", "2001:::1"])("rejects %j", (v) => {
    expect(isValidAddressOrCidr(v)).toBe(false);
  });
  it("trims surrounding whitespace", () => {
    expect(isValidAddressOrCidr("  10.0.0.1 ")).toBe(true);
  });
});
