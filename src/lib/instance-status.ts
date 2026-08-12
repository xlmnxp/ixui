import type { BadgeTone } from "../components/badge";

const STATUS_TONES: Record<string, BadgeTone> = {
  Running: "success",
  Started: "success",
  Stopped: "neutral",
  Frozen: "info",
  Paused: "info",
  Starting: "info",
  Stopping: "warning",
  Freezing: "info",
  Unfreezing: "info",
  Restarting: "info",
  Migrating: "warning",
  Error: "danger",
};

export function instanceStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? "neutral";
}

import type { InstanceStateInfo } from "../api/types";

export function instanceIps(state: InstanceStateInfo | null): string[] {
  if (!state?.network) return [];
  return Object.values(state.network)
    .flatMap((iface) => iface.addresses.filter((a) => a.family === "inet" || a.family === "inet6").map((a) => a.address));
}

export function primaryIp(state: InstanceStateInfo | null): string | undefined {
  const ips = instanceIps(state);
  return ips.find((ip) => ip.includes(".")) ?? ips[0];
}

export interface PrimaryIps {
  ipv4?: string;
  ipv6?: string;
}

export interface IpSummary {
  ipv4?: string;
  ipv6?: string;
  extra: number;
}

export function ipSummary(state: InstanceStateInfo | null): IpSummary {
  const ips = instanceIps(state);
  const ipv4 = ips.find((ip) => ip.includes("."));
  const ipv6 = ips.find((ip) => ip.includes(":"));
  const shown = (ipv4 ? 1 : 0) + (ipv6 ? 1 : 0);
  return { ipv4, ipv6, extra: ips.length - shown };
}
