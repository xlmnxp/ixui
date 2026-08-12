import { useEffect, useState } from "react";
import { instancesApi } from "../api";
import type { Instance, InstanceStateInfo } from "../api/types";
import { Badge } from "../components/badge";
import { KeyValueTable } from "../components/key-value-table";
import { instanceStatusTone } from "../lib/instance-status";

export interface OverviewTabProps {
  instance: Instance;
}

export function OverviewTab({ instance }: OverviewTabProps) {
  const [state, setState] = useState<InstanceStateInfo | null>(null);

  useEffect(() => {
    void instancesApi.state(instance.name).then(setState).catch(() => setState(null));
  }, [instance.name]);

  const ips = state?.network
    ? Object.values(state.network).flatMap((iface) => iface.addresses.filter((a) => a.family === "inet" || a.family === "inet6").map((a) => a.address))
    : [];

  const rows = [
    { key: "Status", value: <Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge> },
    { key: "Type", value: instance.type === "container" ? "Container" : "Virtual machine" },
    { key: "Created", value: new Date(instance.created_at).toLocaleString() },
    { key: "Last used", value: instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never" },
    { key: "Profiles", value: instance.profiles.join(", ") || "—" },
    ...(ips.length > 0
      ? ips.map((ip) => ({ key: "IP address", value: ip }))
      : [{ key: "IP addresses", value: "—" }]),
    { key: "Memory limit", value: instance.config["limits.memory"] ?? "—" },
    { key: "CPU limit", value: instance.config["limits.cpu"] ?? "—" },
  ];

  return (
    <div data-testid="overview-tab">
      <KeyValueTable rows={rows} />
      {instance.description && <p className="mt-2 border-t border-border px-3 py-2 text-sm text-text-secondary">{instance.description}</p>}
    </div>
  );
}
