import { instanceIps, ipSummary } from "./instance-status";
import type { InstanceStateInfo } from "../api/types";

const state = (addresses: string[]): InstanceStateInfo => ({
  status: "Running",
  cpu: { usage: 0 },
  memory: { usage: 0 },
  network: {
    eth0: { addresses: addresses.map((address) => ({ family: address.includes(".") ? "inet" : "inet6", address, netmask: "" })) },
  },
});

describe("instanceIps", () => {
  it("flattens all ipv4 and ipv6 addresses", () => {
    expect(instanceIps(state(["10.0.0.1", "fe80::1", "10.0.0.2"]))).toEqual(["10.0.0.1", "fe80::1", "10.0.0.2"]);
  });

  it("returns an empty list without network info", () => {
    expect(instanceIps(null)).toEqual([]);
  });
});

describe("ipSummary", () => {
  it("shows one ipv4 and one ipv6 with the extra count", () => {
    expect(ipSummary(state(["10.0.0.1", "fe80::1", "10.0.0.2", "fe80::2", "10.0.0.3"]))).toEqual({
      ipv4: "10.0.0.1",
      ipv6: "fe80::1",
      extra: 3,
    });
  });

  it("shows only ipv4 when no ipv6 exists", () => {
    expect(ipSummary(state(["10.0.0.1", "10.0.0.2"]))).toEqual({ ipv4: "10.0.0.1", ipv6: undefined, extra: 1 });
  });
});
